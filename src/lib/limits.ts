import { mbToBytes } from './format'

export interface LimitPreset {
  mb: number
  label: string
  hint: string
}

/**
 * Limites por arquivo mais comuns nos sistemas de processo eletrônico brasileiros.
 * Os valores variam por tribunal e mudam com o tempo; o usuário pode digitar outro valor.
 */
export const LIMIT_PRESETS: LimitPreset[] = [
  { mb: 1.5, label: '1,5 MB', hint: 'PJe (configuração antiga de alguns tribunais)' },
  { mb: 3, label: '3 MB', hint: 'PJe em vários tribunais' },
  { mb: 5, label: '5 MB', hint: 'Projudi / PJe em alguns tribunais' },
  { mb: 6, label: '6 MB', hint: 'Juizados e tribunais com teto de 6 MB' },
  { mb: 10, label: '10 MB', hint: 'e-SAJ, PJe-JT e outros' },
  { mb: 20, label: '20 MB', hint: 'Sistemas mais permissivos' },
]

export const DEFAULT_LIMIT_MB = 6

/**
 * Margem de segurança: alguns sistemas contam o limite em 1.000.000 bytes por MB,
 * outros em 1.048.576. Mirar um pouco abaixo evita recusa por poucos KB.
 */
export const SAFETY_MARGIN = 0.97

export function limitBytesFor(mb: number): number {
  return mbToBytes(mb)
}

/** Tamanho-alvo efetivo (limite com margem). */
export function targetBytes(limitBytes: number): number {
  return Math.floor(limitBytes * SAFETY_MARGIN)
}
