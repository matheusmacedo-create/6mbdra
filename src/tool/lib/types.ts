import { budgetFor, type Analysis, type SplitBudget } from './splitTypes'

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
  | 'restricted' // só restrições de edição (abre sem senha); excluído por padrão
  | 'protected' // exige senha de abertura; recusado
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
  /** Usuário optou por processar mesmo com assinatura ou restrições detectadas */
  force?: boolean
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
  /** Sigla do tribunal escolhido quando a regra é nacional (herdada); null = o tribunal da própria regra */
  tribunal?: string | null
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
  /** Meta por arquivo (limite × percentual) */
  targetBytes: number
  /** Percentual da meta segura aplicado */
  percent: number
  /** Meta adicional por página (sistemas e-SAJ), já com o percentual */
  perPageBytes?: number
  /** Meta para a soma dos arquivos de uma petição, já com o percentual */
  totalPetitionBytes?: number
  /** Meta maior quando o arquivo tem pelo menos minPages páginas */
  conditional?: { minPages: number; targetBytes: number }
  /** O sistema exige PDF/A (a ferramenta não converte: só avisa) */
  exigePdfa: boolean
  autoSplit: boolean
  grayscale: boolean
}

/**
 * Meta efetiva de um arquivo: a meta por arquivo (ou a condicional, se o arquivo tem páginas
 * suficientes), limitada pela meta por página × número de páginas quando a regra tem limite por página.
 */
export function targetFor(job: Pick<Job, 'analysis'>, p: ProcessSettings): number {
  const pages = job.analysis?.pages
  if (!pages) return p.targetBytes
  return budgetFor(splitBudget(p), pages)
}

/** Orçamento por parte (mesmas regras de targetFor, aplicadas a cada parte da divisão). */
export function splitBudget(p: ProcessSettings): SplitBudget {
  return {
    maxBytes: p.targetBytes,
    perPageBytes: p.perPageBytes,
    conditional: p.conditional ? { minPages: p.conditional.minPages, maxBytes: p.conditional.targetBytes } : undefined,
  }
}

export const DEFAULT_SETTINGS: Settings = {
  ruleId: null,
  tribunal: null,
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

export function deriveKind(j: Job, target: number | ProcessSettings): JobKind {
  const targetBytes = typeof target === 'number' ? target : targetFor(j, target)
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
      // Já cabe: mantido intacto mesmo se assinado (não precisa de processamento).
      if (j.originalSize <= targetBytes) return 'unchanged'
      if (a.signed && !j.force) return 'signed'
      if (a.restricted && !j.force) return 'restricted'
      return 'ready'
    }
  }
}

/** Pode entrar na fila quando o usuário clicar em "Preparar arquivos"? */
export function isProcessable(j: Job, target: number | ProcessSettings): boolean {
  return deriveKind(j, target) === 'ready'
}

/** Resultado preparado para outra meta e que não cabe na meta atual. */
export function isStale(j: Job, p: ProcessSettings): boolean {
  if (j.status !== 'done' || j.targetBytes === undefined) return false
  const current = targetFor(j, p)
  return j.targetBytes !== current && j.outputs.some((o) => o.size > current)
}
