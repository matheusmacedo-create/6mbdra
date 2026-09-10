import type { Level } from './levels'

export interface CompressOptions {
  level: Level
  grayscale: boolean
  password?: string
  /** Total de páginas, se conhecido (melhora a barra de progresso) */
  pages?: number
  /** Progresso 0..1 (quando o motor consegue estimar) */
  onProgress?: (fraction: number, detail?: string) => void
  signal?: AbortSignal
}

export interface CompressResult {
  bytes: Uint8Array
  /** Diagnóstico (stdout/stderr do motor), útil para depuração */
  log?: string
  /** Páginas no resultado, quando o motor sabe */
  pages?: number
}

export class EngineError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'UNSUPPORTED'   // navegador sem suporte (ex.: WebAssembly)
      | 'PASSWORD'      // PDF exige senha
      | 'INVALID'       // PDF corrompido / não é PDF
      | 'OOM'           // memória insuficiente
      | 'ABORTED'
      | 'UNKNOWN',
    public readonly detail?: string,
  ) {
    super(message)
    this.name = 'EngineError'
  }
}

/** Um motor de compressão: recebe um PDF e devolve outro, menor. */
export interface CompressionEngine {
  readonly id: 'ghostscript' | 'raster'
  /** Nome curto exibido ao usuário */
  readonly label: string
  /** Verdadeiro quando o resultado mantém o texto pesquisável do original */
  readonly preservesText: boolean
  compress(input: Uint8Array, opts: CompressOptions): Promise<CompressResult>
  /** Libera recursos (workers) */
  dispose?(): void
}
