import { mbToBytes } from './format'
import { metaBytes, limiteBytes, regraPorId, percentualMeta, unidadeParaBytes, META_PERCENTUAL_PADRAO } from './regras'
import type { ProcessSettings, Settings } from './types'

export const CUSTOM_MB_MIN = 0.5
export const CUSTOM_MB_MAX = 500

/** Meta segura para um limite manual: limite decimal × percentual padrão (único valor: o do arquivo de regras). */
export function targetForLimit(limitBytes: number, percent = META_PERCENTUAL_PADRAO): number {
  return Math.floor((limitBytes * percent) / 100)
}

/** Resolve as preferências em limite/meta concretos. Regra inexistente cai no limite manual. */
export function resolveSettings(s: Settings): ProcessSettings {
  const regra = s.ruleId ? regraPorId(s.ruleId) : undefined
  if (regra) {
    const pct = percentualMeta(regra)
    return {
      limitBytes: limiteBytes(regra),
      targetBytes: metaBytes(regra),
      percent: pct,
      perPageBytes: regra.limite_por_pagina_kb ? Math.floor((regra.limite_por_pagina_kb * 1_000 * pct) / 100) : undefined,
      totalPetitionBytes: regra.limite_total_peticao_mb ? Math.floor((regra.limite_total_peticao_mb * 1_000_000 * pct) / 100) : undefined,
      conditional: regra.limite_condicional
        ? { minPages: regra.limite_condicional.min_paginas, targetBytes: Math.floor((unidadeParaBytes(regra.limite_condicional.limite_valor, regra.limite_condicional.limite_unidade) * pct) / 100) }
        : undefined,
      exigePdfa: regra.exige_pdfa === true,
      autoSplit: s.autoSplit,
      grayscale: s.grayscale,
    }
  }
  const mb = Number.isFinite(s.customMb) ? Math.min(CUSTOM_MB_MAX, Math.max(CUSTOM_MB_MIN, s.customMb)) : 6
  const limitBytes = mbToBytes(mb)
  return { limitBytes, targetBytes: targetForLimit(limitBytes), percent: META_PERCENTUAL_PADRAO, exigePdfa: false, autoSplit: s.autoSplit, grayscale: s.grayscale }
}

/** Dispositivo provavelmente móvel/limitado (Safari e Firefox não expõem deviceMemory). */
export function isConstrainedDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  const memGb = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  if (memGb !== undefined && memGb <= 4) return true
  const ua = navigator.userAgent || ''
  if (/iPhone|iPad|iPod|Android/i.test(ua)) return true
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches && navigator.maxTouchPoints > 1) return true
  return false
}

/** Alerta de capacidade do dispositivo (RF14): heurísticas simples, sem bloquear. */
export function deviceCapacityWarning(files: { size: number }[]): string | null {
  if (files.length === 0) return null
  const max = Math.max(...files.map((f) => f.size))
  const total = files.reduce((a, f) => a + f.size, 0)
  const constrained = isConstrainedDevice()
  if (max > 300 * 1_000_000) return 'Há um arquivo com mais de 300 MB. Navegadores costumam não ter memória para isso; divida o PDF antes em um programa de desktop.'
  if (constrained && max > 50 * 1_000_000) return 'Este dispositivo (celular/tablet ou pouca memória) pode não dar conta de arquivos acima de 50 MB. Se o navegador travar, use um computador ou processe menos arquivos por vez.'
  if (constrained && total > 150 * 1_000_000) return 'Lote grande para um dispositivo com pouca memória. Processe poucos arquivos por vez ou use um computador.'
  if (total > 1_000 * 1_000_000) return 'O lote passa de 1 GB. Processe em partes menores para não esgotar a memória do navegador.'
  return null
}
