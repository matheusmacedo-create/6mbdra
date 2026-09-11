import type { Level } from './levels'

export interface CompressOptions {
  level: Level
  grayscale: boolean
  /** Total de páginas, se conhecido (melhora a barra de progresso e a verificação) */
  pages?: number
  /** Progresso 0..1 (quando o motor consegue estimar) */
  onProgress?: (fraction: number, detail?: string) => void
  signal?: AbortSignal
}

export interface CompressResult {
  bytes: Uint8Array
  /** Páginas processadas, quando o motor sabe */
  pages?: number
  /** Avisos não fatais (ex.: o original tinha defeitos reparados) */
  warnings: string[]
  /** Diagnóstico (stdout/stderr do motor), útil para depuração */
  log?: string
}

export type EngineErrorCode =
  | 'UNSUPPORTED' // navegador sem suporte (ex.: WebAssembly)
  | 'PASSWORD' // PDF exige senha
  | 'INVALID' // PDF corrompido / não é PDF
  | 'OOM' // memória insuficiente
  | 'TIMEOUT' // motor sem progresso por tempo demais
  | 'PAGES_MISMATCH' // saída com menos páginas que a entrada (motor não preservou tudo)
  | 'ABORTED'
  | 'UNKNOWN'

export class EngineError extends Error {
  constructor(
    message: string,
    public readonly code: EngineErrorCode,
    public readonly detail?: string,
  ) {
    super(message)
    this.name = 'EngineError'
  }
}

/** Um motor de compressão: recebe um PDF e devolve outro, menor. */
export interface CompressionEngine {
  readonly id: 'ghostscript'
  readonly label: string
  compress(input: Uint8Array, opts: CompressOptions): Promise<CompressResult>
  /** Libera recursos (workers) */
  dispose?(): void
}
