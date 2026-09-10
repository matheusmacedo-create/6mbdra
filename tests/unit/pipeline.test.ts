import { describe, it, expect } from 'vitest'
import { processPdf, type PipelineDeps } from '../../src/lib/engine/pipeline'
import { EngineError, type CompressionEngine, type CompressOptions } from '../../src/lib/engine/types'
import { DEFAULT_SETTINGS, type Settings } from '../../src/lib/types'
import { LEVELS } from '../../src/lib/engine/levels'

const MB = 1024 * 1024

/** Motor falso: tamanho de saída = entrada * fator do nível. */
function fakeEngine(factors: Record<number, number>, opts: { id?: 'ghostscript' | 'raster'; fail?: EngineError; calls?: CompressOptions[] } = {}): CompressionEngine {
  return {
    id: opts.id ?? 'ghostscript',
    label: 'fake',
    preservesText: (opts.id ?? 'ghostscript') === 'ghostscript',
    async compress(input, o) {
      opts.calls?.push(o)
      if (opts.fail) throw opts.fail
      const size = Math.round(input.byteLength * factors[o.level.id])
      const bytes = new Uint8Array(size)
      bytes[0] = o.level.id
      return { bytes, pages: 10 }
    },
  }
}

function deps(engines: CompressionEngine[], pages = 10): PipelineDeps {
  return {
    engines,
    countPages: async () => pages,
    split: async (bytes, maxBytes) => {
      const n = Math.ceil(bytes.byteLength / maxBytes)
      const per = Math.ceil(bytes.byteLength / n)
      return Array.from({ length: n }, (_, i) => ({ bytes: new Uint8Array(per), size: per, from: i + 1, to: i + 1 }))
    },
  }
}

const settings: Settings = { ...DEFAULT_SETTINGS, limitBytes: 6 * MB }

describe('processPdf', () => {
  it('skips files already under the limit', async () => {
    const r = await processPdf(new Uint8Array(5 * MB), 'a.pdf', settings, deps([fakeEngine({ 1: 0.5 })]))
    expect(r.status).toBe('skipped')
    expect(r.outputs).toHaveLength(0)
  })

  it('stops at the lightest level that fits', async () => {
    const calls: CompressOptions[] = []
    const eng = fakeEngine({ 1: 0.5, 2: 0.3, 3: 0.1, 4: 0.05 }, { calls })
    const r = await processPdf(new Uint8Array(10 * MB), 'a.pdf', settings, deps([eng]))
    expect(r.status).toBe('done')
    expect(r.level).toBe(1) // 10 MB * 0.5 = 5 MB <= 6 MB * 0.97
    expect(r.outputs[0].name).toBe('a - compactado.pdf')
    expect(calls.map((c) => c.level.id)).toEqual([1])
  })

  it('escalates levels until it fits', async () => {
    const calls: CompressOptions[] = []
    // pickStartLevel(20 MB, 5.82 MB): 20*0.45=9 > 5.82; 20*0.22=4.4 <= 5.82 -> starts at 2
    const eng = fakeEngine({ 1: 0.9, 2: 0.5, 3: 0.4, 4: 0.2 }, { calls })
    const r = await processPdf(new Uint8Array(20 * MB), 'a.pdf', settings, deps([eng]))
    expect(r.status).toBe('done')
    expect(calls.map((c) => c.level.id)).toEqual([2, 3, 4])
    expect(r.level).toBe(4)
  })

  it('refines to a lighter level when it fits with a lot of room', async () => {
    const calls: CompressOptions[] = []
    // starts at level 2 (20 MB), level 2 gives 2 MB (< 55% of target) -> tries level 1 -> 5 MB fits
    const eng = fakeEngine({ 1: 0.25, 2: 0.1, 3: 0.05, 4: 0.02 }, { calls })
    const r = await processPdf(new Uint8Array(20 * MB), 'a.pdf', settings, deps([eng]))
    expect(calls.map((c) => c.level.id)).toEqual([2, 1])
    expect(r.level).toBe(1)
  })

  it('keeps refining upward while there is room (start at 3, end at 1)', async () => {
    const calls: CompressOptions[] = []
    // 40 MB: 40*0.45=18, 40*0.22=8.8, 40*0.12=4.8 <= 5.82 -> starts at 3
    const eng = fakeEngine({ 1: 0.1, 2: 0.05, 3: 0.02, 4: 0.01 }, { calls })
    const r = await processPdf(new Uint8Array(40 * MB), 'a.pdf', settings, deps([eng]))
    expect(calls.map((c) => c.level.id)).toEqual([3, 2, 1])
    expect(r.level).toBe(1)
  })

  it('rejects an output with fewer pages than the input', async () => {
    const eng = fakeEngine({ 1: 0.5, 2: 0.3, 3: 0.1, 4: 0.05 })
    const d = deps([eng], 10)
    d.countPages = async (bytes) => (bytes.byteLength === 10 * MB ? 10 : 0) // entrada: 10 páginas; saída: 0
    await expect(processPdf(new Uint8Array(10 * MB), 'a.pdf', settings, d)).rejects.toMatchObject({ code: 'INVALID' })
  })

  it('keeps the tighter level when refinement does not fit', async () => {
    const calls: CompressOptions[] = []
    const eng = fakeEngine({ 1: 0.5, 2: 0.1, 3: 0.05, 4: 0.02 }, { calls })
    const r = await processPdf(new Uint8Array(20 * MB), 'a.pdf', settings, deps([eng]))
    expect(calls.map((c) => c.level.id)).toEqual([2, 1])
    expect(r.level).toBe(2)
  })

  it('splits when even the maximum level is over the limit', async () => {
    const eng = fakeEngine({ 1: 0.9, 2: 0.8, 3: 0.7, 4: 0.5 })
    const r = await processPdf(new Uint8Array(40 * MB), 'grande.pdf', settings, deps([eng]))
    expect(r.status).toBe('done')
    expect(r.outputs.length).toBeGreaterThan(1)
    expect(r.outputs[0].name).toBe(`grande - parte 1 de ${r.outputs.length}.pdf`)
    expect(r.warning).toMatch(/dividido/i)
    for (const o of r.outputs) expect(o.size).toBeLessThanOrEqual(6 * MB)
  })

  it('returns "over" with the best attempt when splitting is disabled', async () => {
    const eng = fakeEngine({ 1: 0.9, 2: 0.8, 3: 0.7, 4: 0.5 })
    const r = await processPdf(new Uint8Array(40 * MB), 'grande.pdf', { ...settings, autoSplit: false }, deps([eng]))
    expect(r.status).toBe('over')
    expect(r.outputs).toHaveLength(1)
    expect(r.outputs[0].size).toBe(20 * MB)
    expect(r.level).toBe(4)
  })

  it('falls back to the raster engine when ghostscript crashes', async () => {
    const gs = fakeEngine({ 1: 0.5 }, { fail: new EngineError('boom', 'UNKNOWN') })
    const raster = fakeEngine({ 1: 0.5, 2: 0.3, 3: 0.1, 4: 0.05 }, { id: 'raster' })
    const r = await processPdf(new Uint8Array(10 * MB), 'a.pdf', settings, deps([gs, raster]))
    expect(r.status).toBe('done')
    expect(r.method).toBe('raster')
    expect(r.warning).toMatch(/emergência/i)
  })

  it('does not use raster when the fallback is disabled', async () => {
    const gs = fakeEngine({ 1: 0.5 }, { fail: new EngineError('boom', 'UNKNOWN') })
    const raster = fakeEngine({ 1: 0.5 }, { id: 'raster' })
    await expect(processPdf(new Uint8Array(10 * MB), 'a.pdf', { ...settings, allowRasterFallback: false }, deps([gs, raster]))).rejects.toThrow('boom')
  })

  it('propagates password errors without trying other engines', async () => {
    const gs = fakeEngine({ 1: 0.5 }, { fail: new EngineError('senha', 'PASSWORD') })
    const raster = fakeEngine({ 1: 0.5 }, { id: 'raster' })
    await expect(processPdf(new Uint8Array(10 * MB), 'a.pdf', settings, deps([gs, raster]))).rejects.toMatchObject({ code: 'PASSWORD' })
  })

  it('reports stages and pages', async () => {
    const stages: string[] = []
    let pages = 0
    const eng = fakeEngine({ 1: 0.5, 2: 0.3, 3: 0.1, 4: 0.05 })
    await processPdf(new Uint8Array(10 * MB), 'a.pdf', settings, deps([eng], 42), { onStage: (s) => stages.push(s), onPages: (p) => (pages = p) })
    expect(pages).toBe(42)
    expect(stages.some((s) => /Compactando/.test(s))).toBe(true)
  })

  it('has 4 levels in decreasing dpi order', () => {
    for (let i = 1; i < LEVELS.length; i++) expect(LEVELS[i].colorDpi).toBeLessThan(LEVELS[i - 1].colorDpi)
  })
})
