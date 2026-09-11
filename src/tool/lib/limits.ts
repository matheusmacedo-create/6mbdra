import { SITE } from '../../config/site'
import { mbToBytes } from './format'
import { metaBytes, limiteBytes, regraPorId } from './regras'
import type { ProcessSettings, Settings } from './types'

export const CUSTOM_MB_MIN = 0.5
export const CUSTOM_MB_MAX = 500

/** Meta segura para um limite manual: limite decimal × percentual padrão. */
export function targetForLimit(limitBytes: number, percent = SITE.safetyMarginPercent): number {
  return Math.floor((limitBytes * percent) / 100)
}

/** Resolve as preferências em limite/meta concretos. Regra inexistente cai no limite manual. */
export function resolveSettings(s: Settings): ProcessSettings {
  const regra = s.ruleId ? regraPorId(s.ruleId) : undefined
  if (regra) {
    return { limitBytes: limiteBytes(regra), targetBytes: metaBytes(regra), autoSplit: s.autoSplit, grayscale: s.grayscale }
  }
  const mb = Number.isFinite(s.customMb) ? Math.min(CUSTOM_MB_MAX, Math.max(CUSTOM_MB_MIN, s.customMb)) : 6
  const limitBytes = mbToBytes(mb)
  return { limitBytes, targetBytes: targetForLimit(limitBytes), autoSplit: s.autoSplit, grayscale: s.grayscale }
}

/** Alerta de capacidade do dispositivo (RF14): heurísticas simples, sem bloquear. */
export function deviceCapacityWarning(files: { size: number }[]): string | null {
  if (files.length === 0) return null
  const max = Math.max(...files.map((f) => f.size))
  const total = files.reduce((a, f) => a + f.size, 0)
  const memGb = typeof navigator !== 'undefined' ? (navigator as Navigator & { deviceMemory?: number }).deviceMemory : undefined
  const lowMem = memGb !== undefined && memGb <= 4
  if (max > 300 * 1_000_000) return 'Há um arquivo com mais de 300 MB. Navegadores costumam não ter memória para isso; divida o PDF antes em um programa de desktop.'
  if (lowMem && max > 80 * 1_000_000) return 'Este dispositivo tem pouca memória e há arquivos grandes no lote. Se o navegador travar, processe menos arquivos por vez ou use um computador.'
  if (total > 1_000 * 1_000_000) return 'O lote passa de 1 GB. Processe em partes menores para não esgotar a memória do navegador.'
  return null
}
