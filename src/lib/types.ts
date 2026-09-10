/** Status de um arquivo na fila de processamento. */
export type JobStatus =
  | 'queued'      // aguardando na fila
  | 'analyzing'   // lendo metadados (páginas, criptografia)
  | 'compressing' // rodando compressão
  | 'splitting'   // dividindo em partes
  | 'done'        // concluído com sucesso (outputs preenchidos)
  | 'skipped'     // já estava dentro do limite; nada a fazer
  | 'error'       // falhou (error preenchido)

export type Method = 'none' | 'ghostscript' | 'raster'

export interface OutputFile {
  /** Nome sugerido para download, já com .pdf */
  name: string
  bytes: Uint8Array
  size: number
  /** Índice da parte (1-based) quando o arquivo foi dividido */
  part?: number
  totalParts?: number
  pageRange?: [number, number]
}

export interface Job {
  id: string
  file: File
  name: string
  originalSize: number
  pages?: number
  status: JobStatus
  /** 0..1 */
  progress: number
  /** Texto curto em pt-BR do que está acontecendo agora */
  stage: string
  /** Nível de compressão que produziu o resultado (1 = mais leve) */
  level?: number
  method: Method
  outputs: OutputFile[]
  error?: string
  warning?: string
  startedAt?: number
  finishedAt?: number
}

export interface Settings {
  /** Limite por arquivo, em bytes */
  limitBytes: number
  /** Dividir em partes quando nem a compressão máxima couber no limite */
  autoSplit: boolean
  /** Converter para tons de cinza (reduz muito o tamanho de digitalizações coloridas) */
  grayscale: boolean
  /** Permitir o modo de emergência (transforma páginas em imagem; perde texto pesquisável) */
  allowRasterFallback: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  limitBytes: 6 * 1024 * 1024,
  autoSplit: true,
  grayscale: false,
  allowRasterFallback: true,
}
