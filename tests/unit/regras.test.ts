import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { REGRAS, limiteBytes, metaBytes, regrasVigentes, rotuloRegra, type Regra } from '../../src/tool/lib/regras'
import { resolveSettings, targetForLimit } from '../../src/tool/lib/limits'
import { DEFAULT_SETTINGS } from '../../src/tool/lib/types'

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
