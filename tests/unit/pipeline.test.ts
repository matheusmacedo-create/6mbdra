import { describe, it, expect } from 'vitest'
import { processPdf, type PipelineDeps } from '../../src/tool/lib/engine/pipeline'
import { EngineError, type CompressionEngine, type CompressOptions } from '../../src/tool/lib/engine/types'
import type { ProcessSettings } from '../../src/tool/lib/types'
import { SplitError } from '../../src/tool/lib/split'

const MB = 1_000_000
const settings: ProcessSettings = { limitBytes: 6 * MB, targetBytes: 5.7 * MB, autoSplit: true, grayscale: false }

/** Motor falso: tamanho de saída = entrada × fator do nível (ids 1..6). */
function fakeEngine(factors: Record<number, number>, opts: { fail?: EngineError; calls?: CompressOptions[]; pages?: number } = {}): CompressionEngine {
  return {
    id: 'ghostscript',
    label: 'fake',
    async compress(input, o) {
      opts.calls?.push(o)
      if (opts.fail) throw opts.fail
      const f = factors[o.level.id] ?? 1
      const bytes = new Uint8Array(Math.round(input.byteLength * f))
      bytes[0] = o.level.id
      return { bytes, pages: opts.pages ?? 10, warnings: [] }
    },
  }
}

function deps(engine: CompressionEngine | null, pages = 10, opts: { splitPageTooBig?: boolean; avisos?: string[]; abortDuringSplit?: AbortController } = {}): PipelineDeps {
  return {
    engine,
    countPages: async () => pages,
    split: async (bytes, maxBytes, _onProgress, signal) => {
      if (opts.splitPageTooBig) throw new SplitError('A página 1 sozinha não cabe.', 'PAGE_TOO_BIG')
      if (opts.abortDuringSplit) {
        opts.abortDuringSplit.abort()
        if (signal?.aborted) throw new SplitError('Cancelado.', 'ABORTED')
      }
      const n = Math.ceil(bytes.byteLength / maxBytes)
      const per = Math.ceil(bytes.byteLength / n)
      return { parts: Array.from({ length: n }, (_, i) => ({ bytes: new Uint8Array(per), size: per, from: i + 1, to: i + 1 })), avisos: opts.avisos ?? [] }
    },
  }
}

describe('processPdf', () => {
  it('leaves files already under the target untouched', async () => {
    const r = await processPdf(new Uint8Array(5 * MB), 'a.pdf', settings, deps(fakeEngine({ 1: 0.5 })))
    expect(r.status).toBe('unchanged')
    expect(r.outputs).toHaveLength(0)
    expect(r.contentUntouched).toBe(true)
  })

  it('tries structural optimization first when the file is barely over', async () => {
    const calls: CompressOptions[] = []
    const eng = fakeEngine({ 1: 0.9, 2: 0.7 }, { calls })
    const r = await processPdf(new Uint8Array(6 * MB), 'a.pdf', settings, deps(eng))
    expect(calls.map((c) => c.level.id)).toEqual([1])
    expect(r.status).toBe('done')
    expect(r.level).toBe(1)
    expect(r.outputs[0].name).toBe('a_otimizado.pdf')
    expect(r.outputs[0].kind).toBe('compressed')
  })

  it('escalates levels until it fits', async () => {
    const calls: CompressOptions[] = []
    // 20 MB: começa no nível 4 (0.25*20=5 <= 5.7)
    const eng = fakeEngine({ 1: 0.99, 2: 0.9, 3: 0.6, 4: 0.5, 5: 0.4, 6: 0.2 }, { calls })
    const r = await processPdf(new Uint8Array(20 * MB), 'a.pdf', settings, deps(eng))
    expect(calls.map((c) => c.level.id)).toEqual([4, 5, 6])
    expect(r.level).toBe(6)
  })

  it('refines upward while there is a lot of room', async () => {
    const calls: CompressOptions[] = []
    // 40 MB: começa no nível 5 (0.19*40=7.6 > 5.7; 0.12*40=4.8 -> nível 6)
    // Cada nível cabe com muita folga (< 55% da meta), então sobe até o nível 1 não caber.
    const eng = fakeEngine({ 1: 0.5, 2: 0.07, 3: 0.06, 4: 0.05, 5: 0.03, 6: 0.02 }, { calls })
    const r = await processPdf(new Uint8Array(40 * MB), 'a.pdf', settings, deps(eng))
    expect(calls.map((c) => c.level.id)).toEqual([6, 5, 4, 3, 2, 1])
    expect(r.level).toBe(2) // nível 1 daria 20 MB, não cabe
  })

  it('stops refining as soon as a lighter level does not fit', async () => {
    const calls: CompressOptions[] = []
    const eng = fakeEngine({ 1: 0.9, 2: 0.9, 3: 0.9, 4: 0.9, 5: 0.9, 6: 0.02 }, { calls })
    const r = await processPdf(new Uint8Array(40 * MB), 'a.pdf', settings, deps(eng))
    expect(calls.map((c) => c.level.id)).toEqual([6, 5])
    expect(r.level).toBe(6)
  })

  it('splits the compressed output when even the maximum level is over the limit', async () => {
    const eng = fakeEngine({ 1: 0.95, 2: 0.9, 3: 0.8, 4: 0.7, 5: 0.6, 6: 0.5 })
    const r = await processPdf(new Uint8Array(40 * MB), 'grande.pdf', settings, deps(eng))
    expect(r.status).toBe('done')
    expect(r.outputs.length).toBeGreaterThan(1)
    expect(r.outputs[0].name).toBe('grande_parte_01.pdf')
    expect(r.outputs[0].kind).toBe('part')
    expect(r.contentUntouched).toBe(false)
    expect(r.warnings.join(' ')).toMatch(/dividido/i)
    for (const o of r.outputs) expect(o.size).toBeLessThanOrEqual(settings.targetBytes)
  })

  it('splits the ORIGINAL when compression does not help (bilevel/JBIG2 scans)', async () => {
    const eng = fakeEngine({ 1: 1.01, 2: 1.0, 3: 1.0, 4: 1.0, 5: 1.0, 6: 1.0 })
    const r = await processPdf(new Uint8Array(12 * MB), 'pb.pdf', settings, deps(eng))
    expect(r.status).toBe('done')
    expect(r.contentUntouched).toBe(true)
    expect(r.level).toBeUndefined()
    expect(r.outputs.length).toBe(3)
    expect(r.warnings.join(' ')).toMatch(/sem recompressão/)
  })

  it('splits the original when the engine crashes', async () => {
    const eng = fakeEngine({}, { fail: new EngineError('boom', 'UNKNOWN') })
    const r = await processPdf(new Uint8Array(12 * MB), 'x.pdf', settings, deps(eng))
    expect(r.status).toBe('done')
    expect(r.contentUntouched).toBe(true)
    expect(r.warnings.join(' ')).toMatch(/não pôde ser aplicada/)
  })

  it('works with no engine at all (split only)', async () => {
    const r = await processPdf(new Uint8Array(12 * MB), 'x.pdf', settings, deps(null))
    expect(r.status).toBe('done')
    expect(r.outputs.length).toBe(3)
  })

  it('returns "over" with the best attempt when splitting is disabled', async () => {
    const eng = fakeEngine({ 1: 0.95, 2: 0.9, 3: 0.8, 4: 0.7, 5: 0.6, 6: 0.5 })
    const r = await processPdf(new Uint8Array(40 * MB), 'grande.pdf', { ...settings, autoSplit: false }, deps(eng))
    expect(r.status).toBe('over')
    expect(r.outputs).toHaveLength(1)
    expect(r.outputs[0].size).toBe(20 * MB)
    expect(r.level).toBe(6)
  })

  it('propagates password and invalid errors', async () => {
    await expect(processPdf(new Uint8Array(10 * MB), 'a.pdf', settings, deps(fakeEngine({}, { fail: new EngineError('senha', 'PASSWORD') })))).rejects.toMatchObject({ code: 'PASSWORD' })
    await expect(processPdf(new Uint8Array(10 * MB), 'a.pdf', settings, deps(fakeEngine({}, { fail: new EngineError('ruim', 'INVALID') })))).rejects.toMatchObject({ code: 'INVALID' })
  })

  it('never delivers an output with fewer pages than the input as compressed', async () => {
    const eng = fakeEngine({ 1: 0.5, 2: 0.3, 3: 0.2, 4: 0.1, 5: 0.05, 6: 0.02 })
    const d = deps(eng, 10)
    d.countPages = async (bytes) => (bytes.byteLength === 10 * MB ? 10 : 1) // saída: 1 página em branco
    const r = await processPdf(new Uint8Array(10 * MB), 'a.pdf', settings, d)
    expect(r.contentUntouched).toBe(true) // caiu na divisão do original
    expect(r.level).toBeUndefined()
  })

  it('returns "over" with the best attempt (not an error) when a single page cannot fit', async () => {
    const eng = fakeEngine({ 1: 0.9, 2: 0.6, 3: 0.55, 4: 0.5, 5: 0.5, 6: 0.5 })
    const r = await processPdf(new Uint8Array(20 * MB), 'a.pdf', settings, deps(eng, 3, { splitPageTooBig: true }))
    expect(r.status).toBe('over')
    expect(r.outputs).toHaveLength(1)
    expect(r.outputs[0].size).toBe(10 * MB)
    expect(r.warnings.join(' ')).toMatch(/página 1/)
  })

  it('returns "over" with no output when nothing helped and a page cannot fit', async () => {
    const eng = fakeEngine({ 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1 })
    const r = await processPdf(new Uint8Array(12 * MB), 'a.pdf', settings, deps(eng, 1, { splitPageTooBig: true }))
    expect(r.status).toBe('over')
    expect(r.outputs).toHaveLength(0)
  })

  it('stops the ladder early when two consecutive levels give the same size (bilevel scans)', async () => {
    const calls: CompressOptions[] = []
    const eng = fakeEngine({ 1: 1.0, 2: 1.0, 3: 1.0, 4: 1.0, 5: 1.0, 6: 1.0 }, { calls })
    const r = await processPdf(new Uint8Array(12 * MB), 'pb.pdf', settings, deps(eng))
    expect(calls.length).toBe(2) // nível inicial + um a mais, depois divide
    expect(r.status).toBe('done')
    expect(r.contentUntouched).toBe(true)
  })

  it('splits the original when the engine drops pages (PAGES_MISMATCH)', async () => {
    const eng = fakeEngine({ 1: 0.5, 2: 0.3, 3: 0.2, 4: 0.1, 5: 0.05, 6: 0.02 })
    const d = deps(eng, 10)
    d.countPages = async (bytes) => (bytes.byteLength === 12 * MB ? 10 : 9)
    const r = await processPdf(new Uint8Array(12 * MB), 'a.pdf', settings, d)
    expect(r.status).toBe('done')
    expect(r.contentUntouched).toBe(true)
    expect(r.warnings.join(' ')).toMatch(/não preservou todas as páginas/)
  })

  it('surfaces split warnings about dropped bookmarks/forms', async () => {
    const eng = fakeEngine({ 1: 0.95, 2: 0.9, 3: 0.8, 4: 0.7, 5: 0.6, 6: 0.5 })
    const r = await processPdf(new Uint8Array(40 * MB), 'g.pdf', settings, deps(eng, 10, { avisos: ['As partes não mantêm marcadores (índice) do original.'] }))
    expect(r.warnings.join(' ')).toMatch(/marcadores/)
  })

  it('aborts cleanly when cancelled during the split', async () => {
    const ctrl = new AbortController()
    const eng = fakeEngine({ 1: 0.95, 2: 0.9, 3: 0.8, 4: 0.7, 5: 0.6, 6: 0.5 })
    await expect(processPdf(new Uint8Array(40 * MB), 'g.pdf', settings, deps(eng, 10, { abortDuringSplit: ctrl }), { signal: ctrl.signal })).rejects.toMatchObject({ code: 'ABORTED' })
  })

  it('aborts when cancelled while verifying a level that fit', async () => {
    const ctrl = new AbortController()
    const eng = fakeEngine({ 1: 0.5, 2: 0.3, 3: 0.2 })
    const d = deps(eng, 10)
    d.countPages = async () => {
      ctrl.abort()
      return 10
    }
    await expect(processPdf(new Uint8Array(7 * MB), 'a.pdf', settings, d, { signal: ctrl.signal, pages: 10 })).rejects.toMatchObject({ code: 'ABORTED' })
  })

  it('uses the page count from the preliminary analysis and reports stages', async () => {
    const stages: string[] = []
    let counted = 0
    // 7 MB começa no nível 2; 0.75 -> 5,25 MB cabe e não sobra folga para refinar
    const d = deps(fakeEngine({ 1: 0.9, 2: 0.75, 3: 0.5 }), 10)
    d.countPages = async () => {
      counted++
      return 10
    }
    await processPdf(new Uint8Array(7 * MB), 'a.pdf', settings, d, { pages: 10, onStage: (s) => stages.push(s) })
    expect(counted).toBe(1) // só a verificação da saída
    expect(stages.some((s) => /Compactando/.test(s))).toBe(true)
  })
})
