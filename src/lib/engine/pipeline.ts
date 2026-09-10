import type { Settings, OutputFile, Method } from '../types'
import { targetBytes } from '../limits'
import { compressedName, partName } from '../naming'
import { LEVELS, pickStartLevel, nextLevel, prevLevel, type Level } from './levels'
import { EngineError, type CompressionEngine } from './types'
import type { SplitPart } from '../split'

export interface PipelineDeps {
  /** Motores em ordem de preferência: o primeiro que funcionar é usado. */
  engines: CompressionEngine[]
  countPages: (bytes: Uint8Array) => Promise<number>
  split: (bytes: Uint8Array, maxBytes: number, onProgress?: (done: number, total: number) => void) => Promise<SplitPart[]>
}

export interface PipelineCallbacks {
  onStage?: (stage: string, progress: number) => void
  onPages?: (pages: number) => void
  signal?: AbortSignal
}

export type PipelineStatus = 'done' | 'skipped' | 'over'

export interface PipelineResult {
  status: PipelineStatus
  outputs: OutputFile[]
  method: Method
  level?: number
  pages?: number
  warning?: string
  /** Tamanho do melhor resultado obtido (mesmo quando não coube) */
  bestSize?: number
}

interface Attempt {
  bytes: Uint8Array
  level: Level
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new EngineError('Cancelado.', 'ABORTED')
}

/**
 * Processa um único PDF:
 *  1. se já cabe no limite, não faz nada;
 *  2. comprime do nível mais leve plausível ao mais forte até caber;
 *  3. se coube "fácil", tenta um nível mais leve para ganhar nitidez;
 *  4. se nem o nível máximo coube, divide em partes (se permitido).
 */
export async function processPdf(
  input: Uint8Array,
  fileName: string,
  settings: Settings,
  deps: PipelineDeps,
  cb: PipelineCallbacks = {},
): Promise<PipelineResult> {
  const { signal } = cb
  const stage = (s: string, p: number) => cb.onStage?.(s, Math.max(0, Math.min(1, p)))
  const limit = settings.limitBytes
  const target = targetBytes(limit)

  if (input.byteLength <= limit) {
    return { status: 'skipped', outputs: [], method: 'none' }
  }

  stage('Lendo o arquivo…', 0)
  let pages: number | undefined
  try {
    pages = await deps.countPages(input)
    cb.onPages?.(pages)
  } catch {
    // A contagem é só informativa; o motor dará o erro definitivo se o PDF for inválido.
    pages = undefined
  }
  throwIfAborted(signal)

  // --- Compressão -----------------------------------------------------------
  const { engine, attempts, fits } = await compressUntilFits(input, target, settings, deps, cb, pages)
  const best = attempts.reduce((a, b) => (b.bytes.byteLength < a.bytes.byteLength ? b : a))
  const method: Method = engine.id
  const warningParts: string[] = []
  if (!engine.preservesText) {
    warningParts.push('Usado o modo de emergência: as páginas viraram imagens e o texto deixou de ser pesquisável.')
  }

  if (fits) {
    const chosen = fits
    return {
      status: 'done',
      outputs: [{ name: compressedName(fileName), bytes: chosen.bytes, size: chosen.bytes.byteLength }],
      method,
      level: chosen.level.id,
      pages,
      warning: warningParts.join(' ') || undefined,
      bestSize: chosen.bytes.byteLength,
    }
  }

  // --- Não coube: dividir ---------------------------------------------------
  if (!settings.autoSplit) {
    return {
      status: 'over',
      outputs: [{ name: compressedName(fileName), bytes: best.bytes, size: best.bytes.byteLength }],
      method,
      level: best.level.id,
      pages,
      warning: 'Mesmo na compressão máxima o arquivo ficou acima do limite. Ative "dividir em partes" ou aumente o limite.',
      bestSize: best.bytes.byteLength,
    }
  }

  throwIfAborted(signal)
  stage('Dividindo em partes…', 0.9)
  const parts = await deps.split(best.bytes, target, (done, total) => {
    stage(`Dividindo em partes… (página ${done} de ${total})`, 0.9 + 0.1 * (done / total))
  })
  const outputs: OutputFile[] = parts.map((p, i) => ({
    name: partName(fileName, i + 1, parts.length),
    bytes: p.bytes,
    size: p.size,
    part: i + 1,
    totalParts: parts.length,
    pageRange: [p.from, p.to],
  }))
  warningParts.push(`Não coube em um único arquivo: dividido em ${parts.length} partes.`)
  return {
    status: 'done',
    outputs,
    method,
    level: best.level.id,
    pages,
    warning: warningParts.join(' '),
    bestSize: best.bytes.byteLength,
  }
}

async function compressUntilFits(
  input: Uint8Array,
  target: number,
  settings: Settings,
  deps: PipelineDeps,
  cb: PipelineCallbacks,
  pages?: number,
): Promise<{ engine: CompressionEngine; attempts: Attempt[]; fits?: Attempt }> {
  const { signal } = cb
  const stage = (s: string, p: number) => cb.onStage?.(s, Math.max(0, Math.min(1, p)))
  const engines = deps.engines.filter((e) => e.id === 'ghostscript' || settings.allowRasterFallback)
  if (engines.length === 0) throw new EngineError('Nenhum motor de compressão disponível neste navegador.', 'UNSUPPORTED')

  const runLevel = async (engine: CompressionEngine, level: Level, prefix: string): Promise<Attempt> => {
    throwIfAborted(signal)
    const idx = LEVELS.findIndex((l) => l.id === level.id)
    const base = idx / LEVELS.length
    const span = 1 / LEVELS.length
    const label = `${prefix} (nível ${level.id} de ${LEVELS.length}: ${level.label.toLowerCase()})…`
    stage(label, base)
    const res = await engine.compress(input, {
      level,
      grayscale: settings.grayscale,
      pages,
      signal,
      onProgress: (f, detail) => stage(`${label}${detail ? ' ' + detail : ''}`, base + span * f),
    })
    await verifyIntegrity(res.bytes, res.pages, pages, deps)
    return { bytes: res.bytes, level }
  }

  let lastError: unknown
  for (const engine of engines) {
    const attempts: Attempt[] = []
    let level = pickStartLevel(input.byteLength, target)
    try {
      for (;;) {
        const attempt = await runLevel(engine, level, 'Compactando')
        attempts.push(attempt)

        if (attempt.bytes.byteLength <= target) {
          // Coube. Enquanto sobrar muita folga, tenta níveis mais leves para entregar mais nitidez.
          let chosen = attempt
          let lighter = prevLevel(chosen.level)
          while (lighter && chosen.bytes.byteLength < target * 0.55) {
            try {
              const a2 = await runLevel(engine, lighter, 'Refinando qualidade')
              attempts.push(a2)
              if (a2.bytes.byteLength > target) break
              chosen = a2
              lighter = prevLevel(chosen.level)
            } catch (e) {
              if (e instanceof EngineError && e.code === 'ABORTED') throw e
              break // refinamento é opcional
            }
          }
          return { engine, attempts, fits: chosen }
        }
        const nxt = nextLevel(level)
        if (!nxt) return { engine, attempts }
        level = nxt
      }
    } catch (e) {
      if (e instanceof EngineError && (e.code === 'ABORTED' || e.code === 'PASSWORD' || e.code === 'INVALID')) throw e
      // Outros erros (motor não carregou, memória): tenta o próximo motor.
      console.warn(`[6MB] motor ${engine.id} falhou:`, e, e instanceof EngineError ? e.detail : '')
      lastError = lastError ?? e // o primeiro erro (motor principal) é o mais informativo
      stage(`${engine.label} falhou; tentando alternativa…`, 0)
      continue
    }
  }
  if (lastError instanceof EngineError) throw lastError
  throw new EngineError('A compressão falhou.', 'UNKNOWN', lastError instanceof Error ? lastError.message : String(lastError))
}

/**
 * Garante que a saída é um PDF legível com o mesmo número de páginas da entrada.
 * Protege contra motores que "terminam com sucesso" devolvendo um PDF vazio.
 */
async function verifyIntegrity(output: Uint8Array, reportedPages: number | undefined, inputPages: number | undefined, deps: PipelineDeps) {
  if (output.byteLength < 100) throw new EngineError('O resultado saiu vazio; o arquivo pode estar danificado.', 'INVALID')
  let outPages: number
  try {
    outPages = await deps.countPages(output)
  } catch {
    throw new EngineError('O resultado não pôde ser lido; o arquivo original pode estar danificado.', 'INVALID')
  }
  if (outPages === 0) throw new EngineError('O resultado ficou sem páginas; o arquivo original pode estar danificado.', 'INVALID')
  const expected = inputPages ?? reportedPages
  if (expected && outPages < expected) {
    throw new EngineError(`O resultado ficou com ${outPages} de ${expected} páginas; o arquivo original pode estar danificado.`, 'INVALID')
  }
}
