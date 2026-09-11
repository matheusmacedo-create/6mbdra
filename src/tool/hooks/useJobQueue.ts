import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import { type Job, type ProcessSettings, isBusy, isProcessable, targetFor } from '../lib/types'
import { processPdf, type PipelineDeps } from '../lib/engine/pipeline'
import { EngineError } from '../lib/engine/types'
import { createEngine, GhostscriptEngine } from '../lib/engine'
import { PdfWorkerClient } from '../lib/pdfWorkerClient'
import { SplitError } from '../lib/split'
import type { Analysis } from '../lib/analyze'
import { sizeBucket, track } from '../lib/analytics'

type Action =
  | { type: 'add'; jobs: Job[] }
  | { type: 'patch'; id: string; patch: Partial<Job> }
  | { type: 'remove'; id: string }
  | { type: 'clear' }
  | { type: 'enqueue'; ids: string[] }
  | { type: 'unqueue' }

function reducer(state: Job[], action: Action): Job[] {
  switch (action.type) {
    case 'add':
      return [...state, ...action.jobs]
    case 'patch':
      return state.map((j) => (j.id === action.id ? { ...j, ...action.patch } : j))
    case 'remove':
      return state.filter((j) => j.id !== action.id)
    case 'clear':
      return []
    case 'enqueue':
      return state.map((j) => (action.ids.includes(j.id) ? { ...resetJob(j), status: 'queued', stage: 'Na fila' } : j))
    case 'unqueue':
      return state.map((j) => (j.status === 'queued' ? { ...j, status: 'analyzed', stage: '' } : j))
  }
}

function resetJob(j: Job): Job {
  return { ...j, progress: 0, stage: '', outputs: [], error: undefined, warnings: [], level: undefined, contentUntouched: undefined, targetBytes: undefined, startedAt: undefined, finishedAt: undefined }
}

let seq = 0
function newId() {
  seq += 1
  return `${Date.now().toString(36)}-${seq}`
}

function describeError(e: unknown): string {
  if (e instanceof EngineError) {
    switch (e.code) {
      case 'PASSWORD':
        return 'Este PDF exige senha. Abra-o no programa de origem, salve uma cópia sem senha e adicione de novo.'
      case 'INVALID':
        return 'Não foi possível ler este arquivo. Ele pode estar corrompido ou não ser um PDF de verdade.'
      case 'OOM':
        return 'Este arquivo é grande demais para a memória do navegador. Feche outras abas ou divida o PDF antes.'
      case 'PAGES_MISMATCH':
        return 'A compressão não preservou todas as páginas deste arquivo e a divisão também falhou. Tente dividir o PDF no programa de origem.'
      case 'TIMEOUT':
        return 'O processamento deste arquivo demorou demais e foi interrompido. Tente dividir o PDF em partes menores no programa de origem.'
      case 'UNSUPPORTED':
        return 'Seu navegador não conseguiu carregar o motor de compressão. Tente o Chrome, Edge, Firefox ou Safari atualizados.'
      case 'ABORTED':
        return 'Cancelado.'
      default:
        return e.message
    }
  }
  if (e instanceof SplitError) return e.message
  if (e instanceof Error) return e.message
  return String(e)
}

export interface EngineStatus {
  state: 'idle' | 'loading' | 'ready' | 'error'
  message?: string
}

export function useJobQueue(process: ProcessSettings, onEngineStatus?: (s: EngineStatus) => void) {
  const [jobs, dispatch] = useReducer(reducer, [])
  const processRef = useRef(process)
  processRef.current = process
  const runningRef = useRef<string | null>(null)
  const abortRef = useRef<Map<string, AbortController>>(new Map())
  const batchRef = useRef<{ startedAt: number; count: number } | null>(null)

  // Dois workers de pdf-lib: um só para análise prévia (nunca é abortado) e outro para o
  // processamento (contagem de verificação + divisão), que o cancelamento pode encerrar.
  const deps = useMemo<PipelineDeps & { pdfAnalyze: PdfWorkerClient; pdfWork: PdfWorkerClient }>(() => {
    const engine = createEngine()
    const pdfAnalyze = new PdfWorkerClient()
    const pdfWork = new PdfWorkerClient()
    return {
      engine,
      pdfAnalyze,
      pdfWork,
      countPages: (bytes, signal) => pdfWork.countPages(bytes, signal),
      split: (bytes, maxBytes, onProgress, signal) => pdfWork.split(bytes, maxBytes, onProgress, signal),
    }
  }, [])

  // Pré-carrega o motor (16 MB) assim que a ferramenta monta, para o primeiro arquivo não esperar.
  useEffect(() => {
    const gs = deps.engine instanceof GhostscriptEngine ? deps.engine : null
    if (!gs) {
      onEngineStatus?.({ state: 'error', message: 'Navegador sem suporte a WebAssembly ou Web Workers.' })
      return
    }
    onEngineStatus?.({ state: 'loading' })
    gs.warmUp().then(
      () => onEngineStatus?.({ state: 'ready' }),
      (e) => onEngineStatus?.({ state: 'error', message: describeError(e) }),
    )
    return () => {
      deps.engine?.dispose?.()
      deps.pdfAnalyze.dispose()
      deps.pdfWork.dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deps])

  /** Análise prévia (sem alterar nada): páginas, senha, assinatura, validade. */
  const analyze = useCallback(
    async (job: Job) => {
      const patch = (p: Partial<Job>) => dispatch({ type: 'patch', id: job.id, patch: p })
      try {
        const bytes = new Uint8Array(await job.file.arrayBuffer())
        const analysis: Analysis = await deps.pdfAnalyze.analyze(bytes)
        patch({ status: 'analyzed', analysis })
      } catch (e) {
        patch({ status: 'analyzed', analysis: { valid: false, pages: 0, encrypted: false, signed: false, reason: describeError(e) } })
      }
    },
    [deps],
  )

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const list = Array.from(files).filter((f) => /\.pdf$/i.test(f.name) || f.type === 'application/pdf')
      if (list.length === 0) return 0
      const newJobs: Job[] = list.map((file) => ({
        id: newId(),
        file,
        name: file.name,
        originalSize: file.size,
        status: 'analyzing',
        progress: 0,
        stage: 'Analisando…',
        outputs: [],
        warnings: [],
      }))
      dispatch({ type: 'add', jobs: newJobs })
      // Análise em série para não abrir vários arquivos grandes ao mesmo tempo.
      ;(async () => {
        for (const j of newJobs) await analyze(j)
      })()
      return newJobs.length
    },
    [analyze],
  )

  const remove = useCallback((id: string) => {
    abortRef.current.get(id)?.abort()
    abortRef.current.delete(id)
    dispatch({ type: 'remove', id })
  }, [])

  const clear = useCallback(() => {
    for (const c of abortRef.current.values()) c.abort()
    abortRef.current.clear()
    dispatch({ type: 'clear' })
  }, [])

  /** Coloca na fila todos os arquivos prontos (ou só os ids informados). */
  const start = useCallback(
    (ids?: string[]) => {
      const p = processRef.current
      // Sem ids: todos os prontos. Com ids (tentar de novo / reprocessar): também os com erro ou já concluídos.
      const chosen = jobs.filter((j) => (ids ? ids.includes(j.id) : true) && (isProcessable(j, p) || (ids && (j.status === 'error' || j.status === 'done'))))
      if (chosen.length === 0) return 0
      batchRef.current = { startedAt: Date.now(), count: chosen.length }
      track('lote_iniciado', { quantidade: chosen.length, meta_mb: Math.round(p.targetBytes / 100_000) / 10 })
      dispatch({ type: 'enqueue', ids: chosen.map((j) => j.id) })
      return chosen.length
    },
    [jobs],
  )

  /** Cancela o processamento: aborta o atual e devolve os da fila ao estado analisado. */
  const cancel = useCallback(() => {
    dispatch({ type: 'unqueue' })
    for (const c of abortRef.current.values()) c.abort()
    abortRef.current.clear()
    batchRef.current = null
  }, [])

  const retry = useCallback((id: string) => start([id]), [start])

  const allowSigned = useCallback((id: string) => dispatch({ type: 'patch', id, patch: { forceSigned: true } }), [])

  // Processa a fila, um arquivo por vez.
  useEffect(() => {
    if (runningRef.current && jobs.some((j) => j.id === runningRef.current && isBusy(j))) return
    const next = jobs.find((j) => j.status === 'queued')
    if (!next) {
      runningRef.current = null
      if (batchRef.current && !jobs.some(isBusy)) {
        const b = batchRef.current
        batchRef.current = null
        track('lote_concluido', { quantidade: b.count, segundos: Math.round((Date.now() - b.startedAt) / 1000) })
      }
      return
    }
    runningRef.current = next.id
    const controller = new AbortController()
    abortRef.current.set(next.id, controller)
    const id = next.id
    const patch = (p: Partial<Job>) => dispatch({ type: 'patch', id, patch: p })
    // Meta efetiva deste arquivo (limite por página / condicional entram aqui).
    const settings: ProcessSettings = { ...processRef.current, targetBytes: targetFor(next, processRef.current) }

    ;(async () => {
      const startedAt = Date.now()
      patch({ status: 'compressing', stage: 'Preparando…', progress: 0, startedAt, targetBytes: settings.targetBytes })
      try {
        const bytes = new Uint8Array(await next.file.arrayBuffer())
        const result = await processPdf(bytes, next.name, settings, deps, {
          signal: controller.signal,
          pages: next.analysis?.pages,
          onStage: (stage, progress) => patch({ stage, progress, status: /Dividindo/.test(stage) ? 'splitting' : 'compressing' }),
        })
        const finishedAt = Date.now()
        if (controller.signal.aborted) {
          patch({ status: 'analyzed', stage: '', progress: 0 })
          return
        }
        if (result.status === 'unchanged') {
          patch({ status: 'done', stage: 'Mantido', progress: 1, finishedAt, outputs: [], warnings: [], contentUntouched: true })
        } else if (result.status === 'over') {
          patch({ status: 'error', stage: 'Acima do limite', progress: 1, finishedAt, outputs: result.outputs, level: result.level, warnings: result.warnings, error: result.warnings[result.warnings.length - 1], contentUntouched: result.contentUntouched })
          track('arquivo_resultado', { situacao: 'acima_do_limite', faixa: sizeBucket(next.originalSize) })
        } else {
          patch({ status: 'done', stage: 'Pronto', progress: 1, finishedAt, outputs: result.outputs, level: result.level, warnings: result.warnings, contentUntouched: result.contentUntouched })
          track('arquivo_resultado', {
            situacao: result.outputs.length > 1 ? 'dividido' : 'otimizado',
            faixa: sizeBucket(next.originalSize),
            nivel: result.level ?? 0,
            partes: result.outputs.length,
            segundos: Math.round((finishedAt - startedAt) / 1000),
          })
        }
      } catch (e) {
        if (controller.signal.aborted) {
          patch({ status: 'analyzed', stage: '', progress: 0 })
          return
        }
        // Em produção não registramos o detalhe (cauda do log do motor pode ecoar metadados do documento).
        if (import.meta.env.DEV) console.error('[6MB] Falha ao processar um arquivo:', e, e instanceof EngineError ? e.detail : '')
        else console.error('[6MB] Falha ao processar um arquivo:', e instanceof EngineError ? e.code : 'UNKNOWN')
        const code = e instanceof EngineError ? e.code : e instanceof SplitError ? e.code : 'UNKNOWN'
        track('erro', { categoria: code, faixa: sizeBucket(next.originalSize) })
        patch({ status: 'error', stage: 'Erro', progress: 0, finishedAt: Date.now(), error: describeError(e) })
      } finally {
        abortRef.current.delete(id)
        if (runningRef.current === id) runningRef.current = null
      }
    })()
  }, [jobs, deps])

  return { jobs, addFiles, remove, clear, start, cancel, retry, allowSigned }
}
