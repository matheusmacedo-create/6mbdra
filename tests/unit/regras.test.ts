import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { REGRAS, limiteBytes, metaBytes, regrasVigentes, rotuloRegra, rotuloContexto, tituloRegra, type Regra } from '../../src/tool/lib/regras'
import { resolveSettings, targetForLimit } from '../../src/tool/lib/limits'
import { DEFAULT_SETTINGS, deriveKind, targetFor, isStale, type Job, type ProcessSettings } from '../../src/tool/lib/types'
import { track } from '../../src/tool/lib/analytics'

describe('regras', () => {
  it('validator script accepts the committed base', () => {
    const out = execFileSync('node', ['scripts/validate-rules.mjs'], { encoding: 'utf8' })
    expect(out).toMatch(/OK/)
  })
  it('computes conservative limits and the 95% target', () => {
    const r: Regra = {
      id: 'x-pje', tribunal_sigla: 'X', tribunal_nome: 'Tribunal X', sistema: 'PJe', instancia: 'não se aplica', tipo_peticionamento: 'geral',
      formato: 'PDF', limite_valor: 6, limite_unidade: 'MB', fonte_url: 'https://www.x.jus.br/pje', fonte_titulo: 'FAQ', verificado_em: '2026-09-10', situacao: 'vigente',
    }
    expect(limiteBytes(r)).toBe(6_000_000)
    expect(metaBytes(r)).toBe(5_700_000)
    expect(metaBytes({ ...r, meta_segura_percentual: 90 })).toBe(5_400_000)
    expect(limiteBytes({ ...r, limite_unidade: 'MiB' })).toBe(6_291_456)
    expect(rotuloRegra(r)).toBe('X · PJe · 6 MB')
    expect(rotuloContexto({ ...r, instancia: 'ambos', tipo_peticionamento: 'inicial' })).toBe('1º e 2º graus, petição inicial')
    expect(rotuloRegra({ ...r, instancia: 'ambos' })).toBe('X · PJe · 6 MB')
    expect(tituloRegra({ ...r, tipo_peticionamento: 'principal' })).toMatch(/documento principal/)
    expect(tituloRegra({ ...r, sistema: 'Portal próprio', sistema_rotulo: 'e-STF' })).toBe('Limite de PDF no e-STF do X: 6 MB')
  })

  it('rules with per-page / conditional limits resolve to per-file targets', () => {
    const esaj = resolveSettings({ ...DEFAULT_SETTINGS, ruleId: 'tjsp-esaj' })
    expect(esaj.perPageBytes).toBe(285_000) // 300 KB × 95 %
    expect(esaj.totalPetitionBytes).toBe(76_000_000)
    const job = (pages: number, size: number): Job => ({ id: 'j', file: new File([], 'a.pdf'), name: 'a.pdf', originalSize: size, status: 'analyzed', analysis: { valid: true, pages, encrypted: false, signed: false }, progress: 0, stage: '', outputs: [], warnings: [] })
    expect(targetFor(job(5, 1), esaj)).toBe(1_425_000) // 5 páginas × 285 KB < 28,5 MB
    expect(targetFor(job(200, 1), esaj)).toBe(esaj.targetBytes)
    const go = resolveSettings({ ...DEFAULT_SETTINGS, ruleId: 'tjgo-projudi' })
    expect(targetFor(job(10, 1), go)).toBe(2_850_000)
    expect(targetFor(job(30, 1), go)).toBe(5_700_000)
    expect(deriveKind(job(30, 5_000_000), go)).toBe('unchanged')
    expect(deriveKind(job(10, 5_000_000), go)).toBe('ready')
  })

  it('keeps signed files that already fit, and flags stale results', () => {
    const p: ProcessSettings = { limitBytes: 6_000_000, targetBytes: 5_700_000, percent: 95, exigePdfa: false, autoSplit: true, grayscale: false }
    const base: Job = { id: 'j', file: new File([], 'a.pdf'), name: 'a.pdf', originalSize: 1_000_000, status: 'analyzed', analysis: { valid: true, pages: 3, encrypted: false, signed: true }, progress: 0, stage: '', outputs: [], warnings: [] }
    expect(deriveKind(base, p)).toBe('unchanged')
    expect(deriveKind({ ...base, originalSize: 9_000_000 }, p)).toBe('signed')
    expect(deriveKind({ ...base, originalSize: 9_000_000, force: true }, p)).toBe('ready')
    const done: Job = { ...base, status: 'done', targetBytes: 9_500_000, outputs: [{ name: 'a_otimizado.pdf', bytes: new Uint8Array(0), size: 8_000_000, kind: 'compressed' }] }
    expect(isStale(done, p)).toBe(true)
    expect(isStale({ ...done, targetBytes: 5_700_000, outputs: [{ ...done.outputs[0], size: 5_000_000 }] }, p)).toBe(false)
  })

  it('analytics keeps aggregate counts and drops document-identifying keys', () => {
    const got: Array<[string, Record<string, unknown>]> = []
    ;(globalThis as unknown as { window: unknown }).window = { __analytics: (e: string, props: Record<string, unknown>) => got.push([e, props]) }
    try {
      track('lote_iniciado', { quantidade: 3, meta_mb: 5.7, nome: 'x.pdf', filename: 'y', hash: 'abc', partes: 2 })
      expect(got[0][1]).toEqual({ quantidade: 3, meta_mb: 5.7, partes: 2 })
    } finally {
      delete (globalThis as unknown as { window?: unknown }).window
    }
  })
  it('all committed rules are vigentes or em revisão with official https sources', () => {
    for (const r of REGRAS.regras) {
      expect(r.fonte_url).toMatch(/^https:\/\/([a-z0-9-]+\.)*(jus\.br|gov\.br)\//i)
      expect(metaBytes(r)).toBeLessThan(limiteBytes(r))
    }
    expect(regrasVigentes().length).toBeLessThanOrEqual(REGRAS.regras.length)
  })
  it('resolves manual limits with the safety margin', () => {
    const s = resolveSettings({ ...DEFAULT_SETTINGS, ruleId: null, customMb: 6 })
    expect(s.limitBytes).toBe(6_000_000)
    expect(s.targetBytes).toBe(targetForLimit(6_000_000))
    expect(s.targetBytes).toBe(5_700_000)
    const unknown = resolveSettings({ ...DEFAULT_SETTINGS, ruleId: 'nao-existe', customMb: 10 })
    expect(unknown.limitBytes).toBe(10_000_000)
  })
})
