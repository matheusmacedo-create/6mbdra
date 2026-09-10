import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import type { Job, Settings } from '../lib/types'
import { processPdf, type PipelineDeps } from '../lib/engine/pipeline'
import { EngineError } from '../lib/engine/types'
import { createEngines, GhostscriptEngine } from '../lib/engine'
import { PdfWorkerClient } from '../lib/pdfWorkerClient'
import { SplitError } from '../lib/split'

type Action =
  | { type: 'add'; jobs: Job[] }
  | { type: 'patch'; id: string; patch: Partial<Job> }
  | { type: 'remove'; id: string }
  | { type: 'clear' }
  | { type: 'retry'; id: string }

function reducer(state: Job[], action: Action): Job[] {
  switch (action.type) {
    case 'add':
      return [...state, ...action.jobs]
    case 'patch':
      return state.map((j) => (j.id === action.id ? { ...j, ...action.patch } : j))
    case 'remove':
      return state.filter((j) => j.id !== action.id)
    case 'clear':
      return state.filter((j) => j.status === 'analyzing' || j.status === 'compressing' || j.status === 'splitting')
    case 'retry':
      return state.map((j) =>
        j.id === action.id
          ? { ...j, status: 'queued', progress: 0, stage: 'Na fila', outputs: [], error: undefined, warning: undefined, level: undefined, method: 'none', startedAt: undefined, finishedAt: undefined }
          : j,
      )
  }
}

let seq = 0
function newId() {
  seq += 1
  return `${Date.now().toString(36)}-${seq}`
}

function isRunning(j: Job) {
  return j.status === 'analyzing' || j.status === 'compressing' || j.status === 'splitting'
}

function describeError(e: unknown): string {
  if (e instanceof EngineError) {
    switch (e.code) {
      case 'PASSWORD':
        return 'Este PDF está protegido por senha. Abra-o no leitor de PDF, salve uma cópia sem senha e tente de novo.'
      case 'INVALID':
        return 'Não foi possível ler este arquivo. Ele pode estar corrompido ou não ser um PDF de verdade.'
      case 'OOM':
        return 'Este arquivo é grande demais para a memória do navegador. Tente fechar outras abas ou dividir o PDF antes.'
      case 'UNSUPPORTED':
        return 'Seu navegador não conseguiu carregar o motor de compressão. Tente o Chrome, Edge ou Firefox atualizados.'
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

export function useJobQueue(settings: Settings, onEngineStatus?: (s: EngineStatus) => void) {
  const [jobs, dispatch] = useReducer(reducer, [])
  const settingsRef = useRef(settings)
  settingsRef.current = settings
  const runningRef = useRef<string | null>(null)
  const abortRef = useRef<Map<string, AbortController>>(new Map())

  const deps = useMemo<PipelineDeps & { pdf: PdfWorkerClient }>(() => {
    const engines = createEngines()
    const pdf = new PdfWorkerClient()
    return {
      engines,
      pdf,
      countPages: (bytes) => pdf.countPages(bytes),
      split: (bytes, maxBytes, onProgress) => pdf.split(bytes, maxBytes, onProgress),
    }
  }, [])

  // Pré-carrega o motor (16 MB) assim que a página abre, para o primeiro arquivo não esperar.
  useEffect(() => {
    const gs = deps.engines.find((e): e is GhostscriptEngine => e instanceof GhostscriptEngine)
    if (!gs) {
      onEngineStatus?.({ state: 'error', message: 'Navegador sem suporte a WebAssembly.' })
      return
    }
    onEngineStatus?.({ state: 'loading' })
    gs.warmUp().then(
      () => onEngineStatus?.({ state: 'ready' }),
      (e) => onEngineStatus?.({ state: 'error', message: describeError(e) }),
    )
    return () => {
      for (const e of deps.engines) e.dispose?.()
      deps.pdf.dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deps])

  const addFiles = useCallback((files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => /\.pdf$/i.test(f.name) || f.type === 'application/pdf')
    if (list.length === 0) return 0
    const newJobs: Job[] = list.map((file) => ({
      id: newId(),
      file,
      name: file.name,
      originalSize: file.size,
      status: 'queued',
      progress: 0,
      stage: 'Na fila',
      method: 'none',
      outputs: [],
    }))
    dispatch({ type: 'add', jobs: newJobs })
    return newJobs.length
  }, [])

  const remove = useCallback((id: string) => {
    abortRef.current.get(id)?.abort()
    abortRef.current.delete(id)
    dispatch({ type: 'remove', id })
  }, [])

  const retry = useCallback((id: string) => dispatch({ type: 'retry', id }), [])
  const clearFinished = useCallback(() => dispatch({ type: 'clear' }), [])

  // Processa a fila, um arquivo por vez.
  useEffect(() => {
    if (runningRef.current && jobs.some((j) => j.id === runningRef.current && isRunning(j))) return
    const next = jobs.find((j) => j.status === 'queued')
    if (!next) {
      runningRef.current = null
      return
    }
    runningRef.current = next.id
    const controller = new AbortController()
    abortRef.current.set(next.id, controller)
    const id = next.id
    const patch = (p: Partial<Job>) => dispatch({ type: 'patch', id, patch: p })

    ;(async () => {
      patch({ status: 'analyzing', stage: 'Lendo o arquivo…', progress: 0, startedAt: Date.now() })
      try {
        const bytes = new Uint8Array(await next.file.arrayBuffer())
        const result = await processPdf(bytes, next.name, settingsRef.current, deps, {
          signal: controller.signal,
          onPages: (pages) => patch({ pages }),
          onStage: (stage, progress) => {
            const status: Job['status'] = /Dividindo/.test(stage) ? 'splitting' : /Compactando|Refinando|falhou/.test(stage) ? 'compressing' : 'analyzing'
            patch({ stage, progress, status })
          },
        })
        if (result.status === 'skipped') {
          patch({ status: 'skipped', stage: 'Já está dentro do limite', progress: 1, finishedAt: Date.now(), method: 'none' })
        } else if (result.status === 'over') {
          patch({ status: 'error', stage: 'Acima do limite', progress: 1, finishedAt: Date.now(), outputs: result.outputs, level: result.level, method: result.method, pages: result.pages, error: result.warning })
        } else {
          patch({ status: 'done', stage: 'Pronto', progress: 1, finishedAt: Date.now(), outputs: result.outputs, level: result.level, method: result.method, pages: result.pages, warning: result.warning })
        }
      } catch (e) {
        if (controller.signal.aborted) return
        console.error(`[6MB] Falha ao processar "${next.name}":`, e, e instanceof EngineError ? e.detail : '')
        patch({ status: 'error', stage: 'Erro', progress: 0, finishedAt: Date.now(), error: describeError(e) })
      } finally {
        abortRef.current.delete(id)
        if (runningRef.current === id) runningRef.current = null
      }
    })()
  }, [jobs, deps])

  return { jobs, addFiles, remove, retry, clearFinished }
}
