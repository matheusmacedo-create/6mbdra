import type { Analysis } from './analyze'

/** Ciclo de vida de um arquivo no lote. O que mostrar ao usuário vem de deriveKind(). */
export type JobStatus =
  | 'analyzing' // análise prévia rodando
  | 'analyzed' // analisado, aguardando "Preparar arquivos"
  | 'queued' // na fila de processamento
  | 'compressing'
  | 'splitting'
  | 'done'
  | 'error'

/** Situação apresentada ao usuário, derivada do status + análise + limite atual. */
export type JobKind =
  | 'analyzing'
  | 'ready' // acima do limite; será otimizado
  | 'unchanged' // já cabe; será mantido idêntico
  | 'signed' // assinatura digital detectada; excluído por padrão
  | 'protected' // protegido por senha; recusado
  | 'invalid' // não é um PDF legível
  | 'queued'
  | 'processing'
  | 'done'
  | 'error'

export type OutputKind = 'compressed' | 'part' | 'original'

export interface OutputFile {
  /** Nome sugerido para download, já com .pdf */
  name: string
  bytes: Uint8Array
  size: number
  kind: OutputKind
  part?: number
  totalParts?: number
  pageRange?: [number, number]
}

export interface Job {
  id: string
  file: File
  name: string
  originalSize: number
  status: JobStatus
  analysis?: Analysis
  /** Usuário optou por processar mesmo com assinatura detectada */
  forceSigned?: boolean
  /** 0..1 */
  progress: number
  /** Texto curto em pt-BR do que está acontecendo agora */
  stage: string
  /** Nível de compressão que produziu o resultado (1 = estrutural) */
  level?: number
  outputs: OutputFile[]
  error?: string
  warnings: string[]
  /** Resultado saiu com conteúdo idêntico ao original (só dividido) */
  contentUntouched?: boolean
  /** Meta (bytes) usada quando o arquivo foi processado */
  targetBytes?: number
  startedAt?: number
  finishedAt?: number
}

/** Preferências do usuário (persistidas). */
export interface Settings {
  /** id da regra de tribunal escolhida, ou null para limite manual */
  ruleId: string | null
  /** Limite manual em MB (decimal) */
  customMb: number
  /** Dividir em partes quando nem a compressão máxima couber */
  autoSplit: boolean
  /** Converter para tons de cinza */
  grayscale: boolean
}

/** O que o pipeline precisa saber para processar um arquivo. */
export interface ProcessSettings {
  limitBytes: number
  targetBytes: number
  autoSplit: boolean
  grayscale: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  ruleId: null,
  customMb: 6,
  autoSplit: true,
  grayscale: false,
}

export function isBusy(j: Job): boolean {
  return j.status === 'queued' || j.status === 'compressing' || j.status === 'splitting'
}

export function isFinished(j: Job): boolean {
  return j.status === 'done' || j.status === 'error'
}

export function deriveKind(j: Job, targetBytes: number): JobKind {
  switch (j.status) {
    case 'analyzing':
      return 'analyzing'
    case 'queued':
      return 'queued'
    case 'compressing':
    case 'splitting':
      return 'processing'
    case 'done':
      return 'done'
    case 'error':
      return 'error'
    case 'analyzed': {
      const a = j.analysis
      if (!a || !a.valid) return 'invalid'
      if (a.encrypted) return 'protected'
      if (a.signed && !j.forceSigned) return 'signed'
      if (j.originalSize <= targetBytes) return 'unchanged'
      return 'ready'
    }
  }
}

/** Pode entrar na fila quando o usuário clicar em "Preparar arquivos"? */
export function isProcessable(j: Job, targetBytes: number): boolean {
  return deriveKind(j, targetBytes) === 'ready'
}
