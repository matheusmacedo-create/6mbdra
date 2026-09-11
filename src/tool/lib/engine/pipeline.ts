import type { OutputFile, ProcessSettings } from '../types'
import { compressedName, partName } from '../naming'
import { LEVELS, pickStartLevel, nextLevel, prevLevel, type Level } from './levels'
import { EngineError, type CompressionEngine } from './types'
import type { SplitPart } from '../split'
import { SplitError } from '../split'

export interface PipelineDeps {
  engine: CompressionEngine | null
  countPages: (bytes: Uint8Array) => Promise<number>
  split: (bytes: Uint8Array, maxBytes: number, onProgress?: (done: number, total: number) => void) => Promise<SplitPart[]>
}

export interface PipelineCallbacks {
  onStage?: (stage: string, progress: number) => void
  signal?: AbortSignal
  /** Páginas já contadas na análise prévia (evita contar de novo) */
  pages?: number
}

export type PipelineStatus = 'done' | 'unchanged' | 'over'

export interface PipelineResult {
  status: PipelineStatus
  outputs: OutputFile[]
  /** Nível que produziu o resultado (undefined quando o arquivo foi só dividido) */
  level?: number
  pages?: number
  warnings: string[]
  /** Tamanho do melhor resultado obtido (mesmo quando não coube) */
  bestSize?: number
  /** O conteúdo saiu idêntico ao original (só dividido)? */
  contentUntouched: boolean
}

interface Attempt {
  bytes: Uint8Array
  level: Level
  warnings: string[]
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new EngineError('Cancelado.', 'ABORTED')
}

/**
 * Processa um único PDF (spec §8):
 *  1. se já cabe no limite, não faz nada;
 *  2. otimização estrutural e depois redução gradual das imagens, até caber;
 *  3. se coube com folga, volta a um nível mais leve para ganhar nitidez;
 *  4. verifica a saída (PDF válido, mesmo número de páginas);
 *  5. se nem o nível máximo coube — ou a compressão não ajudou — divide em partes.
 */
export async function processPdf(
  input: Uint8Array,
  fileName: string,
  settings: ProcessSettings,
  deps: PipelineDeps,
  cb: PipelineCallbacks = {},
): Promise<PipelineResult> {
  const { signal } = cb
  const stage = (s: string, p: number) => cb.onStage?.(s, Math.max(0, Math.min(1, p)))
  const target = settings.targetBytes

  if (input.byteLength <= target) {
    return { status: 'unchanged', outputs: [], warnings: [], contentUntouched: true }
  }

  let pages = cb.pages
  if (pages === undefined) {
    stage('Lendo o arquivo…', 0)
    try {
      pages = await deps.countPages(input)
    } catch {
      pages = undefined
    }
  }
  throwIfAborted(signal)

  // --- Compressão -----------------------------------------------------------
  let attempts: Attempt[] = []
  let fits: Attempt | undefined
  let engineFailure: EngineError | undefined
  if (deps.engine) {
    try {
      const r = await compressUntilFits(input, target, settings, deps.engine, deps, cb, pages)
      attempts = r.attempts
      fits = r.fits
    } catch (e) {
      if (e instanceof EngineError && (e.code === 'ABORTED' || e.code === 'PASSWORD' || e.code === 'INVALID')) throw e
      engineFailure = e instanceof EngineError ? e : new EngineError('A compressão falhou.', 'UNKNOWN', e instanceof Error ? e.message : String(e))
      console.warn('[6MB] motor falhou; o arquivo será dividido sem compressão:', engineFailure, engineFailure.detail ?? '')
    }
  }

  if (fits) {
    return {
      status: 'done',
      outputs: [{ name: compressedName(fileName), bytes: fits.bytes, size: fits.bytes.byteLength, kind: 'compressed' }],
      level: fits.level.id,
      pages,
      warnings: fits.warnings,
      bestSize: fits.bytes.byteLength,
      contentUntouched: false,
    }
  }

  // --- Não coube: escolher a fonte da divisão ----------------------------------
  const best = attempts.length ? attempts.reduce((a, b) => (b.bytes.byteLength < a.bytes.byteLength ? b : a)) : undefined
  const compressionHelped = best !== undefined && best.bytes.byteLength < input.byteLength * 0.98
  const warnings: string[] = []

  if (!settings.autoSplit) {
    if (best && compressionHelped) {
      return {
        status: 'over',
        outputs: [{ name: compressedName(fileName), bytes: best.bytes, size: best.bytes.byteLength, kind: 'compressed' }],
        level: best.level.id,
        pages,
        warnings: [...best.warnings, 'Mesmo na compressão máxima o arquivo ficou acima do limite. Ative "dividir em partes" ou escolha outro limite.'],
        bestSize: best.bytes.byteLength,
        contentUntouched: false,
      }
    }
    return {
      status: 'over',
      outputs: [],
      pages,
      warnings: [
        engineFailure
          ? `A compressão não pôde ser aplicada (${engineFailure.message}). Ative "dividir em partes" para protocolar em mais de um arquivo.`
          : 'A compressão não reduziu este arquivo (as imagens já estão otimizadas ou são em preto e branco). Ative "dividir em partes".',
      ],
      bestSize: best?.bytes.byteLength,
      contentUntouched: true,
    }
  }

  throwIfAborted(signal)
  const source = best && compressionHelped ? best.bytes : input
  const contentUntouched = source === input
  if (contentUntouched) {
    warnings.push(
      engineFailure
        ? 'A compressão não pôde ser aplicada a este arquivo; ele foi dividido sem nenhuma alteração de conteúdo.'
        : 'A compressão não reduziria este arquivo (imagens já otimizadas ou em preto e branco); ele foi dividido sem alteração de conteúdo.',
    )
  } else if (best) {
    warnings.push(...best.warnings)
  }

  stage('Dividindo em partes…', 0.9)
  let parts: SplitPart[]
  try {
    parts = await deps.split(source, target, (done, total) => stage(`Dividindo em partes… (página ${done} de ${total})`, 0.9 + 0.1 * (done / total)))
  } catch (e) {
    if (e instanceof SplitError && e.code === 'PAGE_TOO_BIG') {
      throw new EngineError(`${e.message} Reduza essa página no programa de origem (ou digitalize-a novamente em resolução menor).`, 'UNKNOWN', e.message)
    }
    throw e
  }
  if (parts.length === 1) {
    // Cabia afinal (o pdf-lib reescreveu mais compacto): entrega como arquivo único.
    return {
      status: 'done',
      outputs: [{ name: compressedName(fileName), bytes: parts[0].bytes, size: parts[0].size, kind: 'compressed' }],
      level: best && compressionHelped ? best.level.id : undefined,
      pages,
      warnings,
      bestSize: parts[0].size,
      contentUntouched,
    }
  }
  const outputs: OutputFile[] = parts.map((p, i) => ({
    name: partName(fileName, i + 1, parts.length),
    bytes: p.bytes,
    size: p.size,
    kind: 'part',
    part: i + 1,
    totalParts: parts.length,
    pageRange: [p.from, p.to],
  }))
  warnings.push(`Não coube em um único arquivo: dividido em ${parts.length} partes.`)
  return {
    status: 'done',
    outputs,
    level: best && compressionHelped ? best.level.id : undefined,
    pages,
    warnings,
    bestSize: best?.bytes.byteLength,
    contentUntouched,
  }
}

async function compressUntilFits(
  input: Uint8Array,
  target: number,
  settings: ProcessSettings,
  engine: CompressionEngine,
  deps: PipelineDeps,
  cb: PipelineCallbacks,
  pages?: number,
): Promise<{ attempts: Attempt[]; fits?: Attempt }> {
  const { signal } = cb
  const stage = (s: string, p: number) => cb.onStage?.(s, Math.max(0, Math.min(1, p)))

  const runLevel = async (level: Level, prefix: string): Promise<Attempt> => {
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
    return { bytes: res.bytes, level, warnings: res.warnings }
  }

  const attempts: Attempt[] = []
  let level = pickStartLevel(input.byteLength, target)
  for (;;) {
    const attempt = await runLevel(level, 'Compactando')
    attempts.push(attempt)

    if (attempt.bytes.byteLength <= target) {
      // Coube. Enquanto sobrar muita folga, tenta níveis mais leves para entregar mais nitidez.
      let chosen = attempt
      let lighter = prevLevel(chosen.level)
      while (lighter && chosen.bytes.byteLength < target * 0.55) {
        try {
          const a2 = await runLevel(lighter, 'Refinando qualidade')
          attempts.push(a2)
          if (a2.bytes.byteLength > target) break
          chosen = a2
          lighter = prevLevel(chosen.level)
        } catch (e) {
          if (e instanceof EngineError && e.code === 'ABORTED') throw e
          break // refinamento é opcional
        }
      }
      return { attempts, fits: chosen }
    }
    // Se este nível já não reduziu nada em relação à entrada, os próximos tampouco vão (bilevel/JBIG2).
    const nxt = nextLevel(level)
    if (!nxt) return { attempts }
    level = nxt
  }
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
