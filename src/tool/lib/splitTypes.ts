/** Tipos e erros da divisão/análise, sem dependência do pdf-lib (usados na thread principal). */
export interface SplitPart {
  bytes: Uint8Array
  size: number
  /** Intervalo de páginas 1-based, inclusivo */
  from: number
  to: number
}

export interface SplitResult {
  parts: SplitPart[]
  /** Recursos do documento que não acompanham as partes (marcadores, formulários…) */
  avisos: string[]
}

export type SplitErrorCode = 'PAGE_TOO_BIG' | 'EMPTY' | 'LOAD' | 'ABORTED'

export class SplitError extends Error {
  constructor(
    message: string,
    public readonly code: SplitErrorCode,
  ) {
    super(message)
    this.name = 'SplitError'
  }
}

export interface Analysis {
  /** Começa com %PDF e o pdf-lib conseguiu ler a estrutura */
  valid: boolean
  pages: number
  /** Exige senha para abrir (senha de usuário) */
  encrypted: boolean
  /** Criptografado só com restrições de edição/impressão: abre sem senha */
  restricted?: boolean
  /** Indícios de assinatura digital (campo /Sig com /ByteRange) */
  signed: boolean
  /** Motivo quando valid = false */
  reason?: string
}

/**
 * Orçamento de tamanho de uma parte em função do número de páginas que ela contém
 * (regras com limite por página, como o e-SAJ, ou condicional, como o Projudi-GO).
 */
export interface SplitBudget {
  /** Meta base por arquivo (já com a margem) */
  maxBytes: number
  /** Meta adicional por página (já com a margem) */
  perPageBytes?: number
  /** Meta maior para partes com pelo menos minPages páginas */
  conditional?: { minPages: number; maxBytes: number }
}

export function budgetFor(b: SplitBudget, pages: number): number {
  let t = b.maxBytes
  if (b.conditional && pages >= b.conditional.minPages) t = Math.max(t, b.conditional.maxBytes)
  if (b.perPageBytes && pages > 0) t = Math.min(t, b.perPageBytes * pages)
  return t
}
