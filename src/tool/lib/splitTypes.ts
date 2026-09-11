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
  /** Tem dicionário /Encrypt (senha de abertura ou só restrições) */
  encrypted: boolean
  /** Indícios de assinatura digital (campo /Sig com /ByteRange) */
  signed: boolean
  /** Motivo quando valid = false */
  reason?: string
}
