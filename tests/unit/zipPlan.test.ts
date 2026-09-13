import { describe, it, expect } from 'vitest'
import { unzipSync } from 'fflate'
import { planZip, groupIntoPetitions, type ZipDoc } from '../../src/tool/lib/zipPlan'
import { buildZipEntries } from '../../src/tool/lib/zip'
import type { OutputFile } from '../../src/tool/lib/types'

const bytes = (n: number) => new Uint8Array(n)
const single = (name: string, size: number, status: ZipDoc['status'] = 'compressed', originalSize = size * 3): ZipDoc => ({
  name,
  originalSize,
  status,
  files: [{ name: `${name}_x.pdf`, bytes: bytes(size), size, kind: status === 'kept' ? 'original' : 'compressed' }],
})
const split = (name: string, sizes: number[]): ZipDoc => ({
  name,
  originalSize: sizes.reduce((a, b) => a + b, 0) * 2,
  status: 'split',
  files: sizes.map<OutputFile>((s, i) => ({ name: `${name}_parte.pdf`, bytes: bytes(s), size: s, kind: 'part', part: i + 1, totalParts: sizes.length, pageRange: [i * 10 + 1, i * 10 + 10] })),
})
const when = new Date(2026, 8, 13, 14, 5)

describe('planZip', () => {
  it('numbers files in batch order, puts parts in their own folder and writes a README', () => {
    const plan = planZip({
      docs: [single('Procuração João.pdf', 100, 'kept'), split('Laudo Pericial.pdf', [300, 300, 120]), single('contrato.pdf', 200)],
      excluded: [{ name: 'assinado.pdf', reason: 'assinado digitalmente' }],
      when,
      tribunal: { sigla: 'TJ/SP', sistema: 'e-SAJ', limite: '30 MB' },
      limitBytes: 30_000_000,
      targetBytes: 28_500_000,
    })
    expect(plan.zipName).toBe('PDFs_preparados_TJ_SP_2026-09-13.zip')
    expect(plan.root).toBe('PDFs_preparados_TJ_SP_2026-09-13')
    expect(plan.petitions).toBe(1)
    expect(plan.fileCount).toBe(5)
    expect(plan.entries.map((e) => e.path)).toEqual([
      'PDFs_preparados_TJ_SP_2026-09-13/LEIA-ME.txt',
      'PDFs_preparados_TJ_SP_2026-09-13/01_Procuracao_Joao.pdf',
      'PDFs_preparados_TJ_SP_2026-09-13/02_Laudo_Pericial/02_Laudo_Pericial_parte_01_de_03.pdf',
      'PDFs_preparados_TJ_SP_2026-09-13/02_Laudo_Pericial/02_Laudo_Pericial_parte_02_de_03.pdf',
      'PDFs_preparados_TJ_SP_2026-09-13/02_Laudo_Pericial/02_Laudo_Pericial_parte_03_de_03.pdf',
      'PDFs_preparados_TJ_SP_2026-09-13/03_contrato.pdf',
    ])
    expect(plan.readme).toContain('13/09/2026 as 14:05')
    expect(plan.readme).toContain('TJ/SP - e-SAJ')
    expect(plan.readme).toContain('01_Procuracao_Joao.pdf  -  mantido como estava')
    expect(plan.readme).toContain('02_Laudo_Pericial/  -  dividido em partes (3)')
    expect(plan.readme).toContain('paginas 11-20')
    expect(plan.readme).toContain('assinado.pdf  -  assinado digitalmente')
    expect(plan.readme).not.toMatch(/peticao_/)
    // O ZIP real abre e tem as mesmas entradas.
    const zip = unzipSync(buildZipEntries(plan.entries))
    expect(Object.keys(zip)).toEqual(plan.entries.map((e) => e.path))
    expect(new TextDecoder().decode(zip['PDFs_preparados_TJ_SP_2026-09-13/LEIA-ME.txt'])).toBe(plan.readme)
  })

  it('splits the batch into petition folders when the sum exceeds the per-petition limit, keeping documents whole when possible', () => {
    const docs = [single('a.pdf', 60), single('b.pdf', 30), single('c.pdf', 50), split('d.pdf', [70, 70, 20]), single('e.pdf', 10)]
    const plan = planZip({ docs, when, limitBytes: 100, targetBytes: 95, petitionBytes: 100 })
    expect(plan.petitions).toBe(4)
    const byFolder: Record<string, string[]> = {}
    for (const e of plan.entries.slice(1)) {
      const [, folder, ...rest] = e.path.split('/')
      ;(byFolder[folder] ??= []).push(rest.join('/'))
    }
    expect(byFolder).toEqual({
      peticao_01: ['01_a.pdf', '02_b.pdf'],
      peticao_02: ['03_c.pdf'],
      peticao_03: ['04_d/04_d_parte_01_de_03.pdf'],
      peticao_04: ['04_d/04_d_parte_02_de_03.pdf', '04_d/04_d_parte_03_de_03.pdf', '05_e.pdf'],
    })
    expect(plan.readme).toContain('separados em 4 pastas')
    expect(plan.readme).toContain('Pasta peticao_01/')
  })

  it('does not create petition folders when everything fits in one petition', () => {
    const plan = planZip({ docs: [single('a.pdf', 60), single('b.pdf', 30)], when, limitBytes: 100, targetBytes: 95, petitionBytes: 100 })
    expect(plan.petitions).toBe(1)
    expect(plan.entries.every((e) => !e.path.includes('peticao_'))).toBe(true)
  })

  it('groupIntoPetitions puts an oversized file alone and never loses a file', () => {
    const planned = [
      { doc: single('a.pdf', 150), base: '01_a', files: [{ rel: '01_a.pdf', file: single('a.pdf', 150).files[0] }], total: 150 },
      { doc: single('b.pdf', 10), base: '02_b', files: [{ rel: '02_b.pdf', file: single('b.pdf', 10).files[0] }], total: 10 },
    ]
    const groups = groupIntoPetitions(planned, 100)
    expect(groups.map((g) => g.map((f) => f.rel))).toEqual([['01_a.pdf'], ['02_b.pdf']])
  })
})
