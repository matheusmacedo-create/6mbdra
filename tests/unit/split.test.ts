import { describe, it, expect } from 'vitest'
import { PDFDocument, pushGraphicsState, popGraphicsState, concatTransformationMatrix, drawObject } from 'pdf-lib'
import { zlibSync } from 'fflate'
import { splitPdf } from '../../src/tool/lib/split'
import { budgetFor, type SplitBudget } from '../../src/tool/lib/splitTypes'
import { splitBudget, targetFor, type ProcessSettings } from '../../src/tool/lib/types'

/** PDF com N páginas, cada uma com uma imagem incompressível de ~bytesPerPage. */
async function noisyPdf(pages: number, bytesPerPage: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const side = Math.ceil(Math.sqrt(bytesPerPage))
  for (let p = 0; p < pages; p++) {
    const data = new Uint8Array(side * side)
    let s = 0x9e3779b9 ^ (p + 1)
    for (let i = 0; i < data.length; i++) {
      s ^= s << 13
      s ^= s >>> 17
      s ^= s << 5
      data[i] = s & 0xff
    }
    const stream = doc.context.stream(zlibSync(data, { level: 1 }), {
      Type: 'XObject',
      Subtype: 'Image',
      Width: side,
      Height: side,
      ColorSpace: 'DeviceGray',
      BitsPerComponent: 8,
      Filter: 'FlateDecode',
    })
    const ref = doc.context.register(stream)
    const page = doc.addPage([595, 842])
    const name = page.node.newXObject('Im', ref)
    page.pushOperators(pushGraphicsState(), concatTransformationMatrix(595, 0, 0, 842, 0, 0), drawObject(name), popGraphicsState())
  }
  return doc.save({ useObjectStreams: false })
}

describe('budgetFor / targetFor', () => {
  const base: ProcessSettings = { limitBytes: 3_000_000, targetBytes: 2_850_000, percent: 95, exigePdfa: false, autoSplit: true, grayscale: false }
  it('raises the budget for parts with enough pages (conditional rule)', () => {
    const b: SplitBudget = { maxBytes: 2_850_000, conditional: { minPages: 30, maxBytes: 5_700_000 } }
    expect(budgetFor(b, 29)).toBe(2_850_000)
    expect(budgetFor(b, 30)).toBe(5_700_000)
  })
  it('caps the budget by pages (per-page rule)', () => {
    const b: SplitBudget = { maxBytes: 28_500_000, perPageBytes: 285_000 }
    expect(budgetFor(b, 10)).toBe(2_850_000)
    expect(budgetFor(b, 1000)).toBe(28_500_000)
  })
  it('targetFor and splitBudget agree', () => {
    const p: ProcessSettings = { ...base, conditional: { minPages: 30, targetBytes: 5_700_000 }, perPageBytes: 285_000 }
    for (const pages of [1, 5, 29, 30, 100]) expect(targetFor({ analysis: { valid: true, pages, encrypted: false, signed: false } }, p)).toBe(budgetFor(splitBudget(p), pages))
  })
})

describe('splitPdf with a page-dependent budget', () => {
  it('keeps every part within the budget for its own page count (per-page limit)', async () => {
    const bytes = await noisyPdf(12, 60_000)
    const budget: SplitBudget = { maxBytes: 250_000, perPageBytes: 100_000 }
    const r = await splitPdf(bytes, { maxBytes: budget.maxBytes, budget })
    expect(r.parts.length).toBeGreaterThan(1)
    let pages = 0
    for (const part of r.parts) {
      const n = part.to - part.from + 1
      expect(part.size).toBeLessThanOrEqual(budgetFor(budget, n))
      pages += n
    }
    expect(pages).toBe(12)
  }, 60_000)

  it('does not give short parts the conditional budget that only long files get (Projudi-GO)', async () => {
    // Arquivo de 40 páginas: a meta do arquivo inteiro é a condicional (600 KB, pois tem 30+ páginas),
    // mas cada parte com menos de 30 páginas só pode ter 200 KB.
    const bytes = await noisyPdf(40, 30_000)
    const budget: SplitBudget = { maxBytes: 200_000, conditional: { minPages: 30, maxBytes: 600_000 } }
    const r = await splitPdf(bytes, { maxBytes: budget.maxBytes, budget })
    expect(r.parts.reduce((a, p) => a + (p.to - p.from + 1), 0)).toBe(40)
    for (const part of r.parts) expect(part.size).toBeLessThanOrEqual(budgetFor(budget, part.to - part.from + 1))
    // Sem o orçamento por parte (comportamento antigo: meta do arquivo inteiro), sairiam partes curtas de até 600 KB.
    const old = await splitPdf(bytes, { maxBytes: 600_000 })
    expect(old.parts.some((p) => p.to - p.from + 1 < 30 && p.size > 200_000)).toBe(true)
  }, 120_000)

  it('names the effective limit when a single page does not fit', async () => {
    const bytes = await noisyPdf(2, 120_000)
    const budget: SplitBudget = { maxBytes: 1_000_000, perPageBytes: 50_000 }
    await expect(splitPdf(bytes, { maxBytes: budget.maxBytes, budget })).rejects.toMatchObject({ code: 'PAGE_TOO_BIG', message: expect.stringMatching(/limite de 48 KB/) })
  }, 60_000)
})
