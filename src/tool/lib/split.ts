import { PDFDocument, PDFName } from 'pdf-lib'

import { SplitError, budgetFor, type SplitBudget, type SplitPart, type SplitResult } from './splitTypes'

export { SplitError }
export type { SplitPart, SplitResult }

export interface SplitOptions {
  /** Tamanho máximo de cada parte, em bytes */
  maxBytes: number
  /** Orçamento dependente do número de páginas da parte (limite por página / condicional). Prevalece sobre maxBytes. */
  budget?: SplitBudget
  /** Chamado a cada parte concluída (para progresso) */
  onProgress?: (pagesDone: number, totalPages: number) => void
  signal?: AbortSignal
}


async function loadDoc(bytes: Uint8Array): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false })
  } catch (e) {
    throw new SplitError(`Não foi possível ler o PDF para dividir: ${(e as Error).message}`, 'LOAD')
  }
}

async function buildRange(src: PDFDocument, from: number, to: number): Promise<Uint8Array> {
  const out = await PDFDocument.create()
  const indices: number[] = []
  for (let i = from; i <= to; i++) indices.push(i)
  const pages = await out.copyPages(src, indices)
  for (const p of pages) out.addPage(p)
  return out.save({ useObjectStreams: true, addDefaultPage: false })
}

/**
 * Divide um PDF em partes sequenciais, cada uma com no máximo `maxBytes`.
 *
 * Estratégia: estima quantas páginas cabem por parte pela média de bytes/página,
 * monta a parte, mede o tamanho real e ajusta (recursos compartilhados como fontes
 * e imagens fazem o tamanho real não ser exatamente proporcional).
 */
/** Estruturas do catálogo que copyPages não leva junto (spec: avisar em vez de prometer "intacto"). */
export function droppedFeatures(src: PDFDocument): string[] {
  const has = (k: string) => src.catalog.has(PDFName.of(k))
  const out: string[] = []
  if (has('AcroForm')) out.push('campos de formulário')
  if (has('Outlines')) out.push('marcadores (índice)')
  if (has('Dests') || has('Names')) out.push('links internos entre páginas')
  return out
}

export async function splitPdf(bytes: Uint8Array, opts: SplitOptions): Promise<SplitResult> {
  const src = await loadDoc(bytes)
  const total = src.getPageCount()
  if (total === 0) throw new SplitError('O PDF não tem páginas.', 'EMPTY')
  const dropped = droppedFeatures(src)
  const avisos = dropped.length ? [`As partes não mantêm ${dropped.join(', ')} do original; cada parte contém só as páginas copiadas.`] : []
  const checkAbort = () => {
    if (opts.signal?.aborted) throw new SplitError('Cancelado.', 'ABORTED')
  }

  const avgPerPage = bytes.byteLength / total
  const parts: SplitPart[] = []
  let from = 0
  /** Limite da parte em função de quantas páginas ela tem. */
  const limitFor = (n: number) => (opts.budget ? budgetFor(opts.budget, n) : opts.maxBytes)

  while (from < total) {
    checkAbort()
    // Chute inicial conservador (90% do que caberia pela média).
    let count = Math.max(1, Math.floor((opts.maxBytes / avgPerPage) * 0.9))
    count = Math.min(count, total - from)
    // Com limite por página, o chute não pode passar do que o orçamento permite para essas páginas.
    while (count > 1 && limitFor(count) < avgPerPage * count * 0.9) count = Math.max(1, Math.floor(count / 2))

    let built = await buildRange(src, from, from + count - 1)

    // Se coube com folga e ainda há páginas, tenta crescer (poucas iterações).
    let grow = 0
    while (built.byteLength < limitFor(count) * 0.8 && from + count < total && grow < 4) {
      const extra = Math.max(1, Math.floor(((limitFor(count) - built.byteLength) / avgPerPage) * 0.8))
      const nextCount = Math.min(total - from, count + extra)
      const candidate = await buildRange(src, from, from + nextCount - 1)
      if (candidate.byteLength <= limitFor(nextCount)) {
        built = candidate
        count = nextCount
        grow++
      } else {
        break
      }
    }

    // Se estourou, encolhe até caber.
    while (built.byteLength > limitFor(count)) {
      if (count === 1) {
        throw new SplitError(
          `A página ${from + 1} sozinha tem ${Math.ceil(built.byteLength / 1024)} KB e não cabe no limite de ${Math.floor(limitFor(1) / 1024)} KB.`,
          'PAGE_TOO_BIG',
        )
      }
      const ratio = limitFor(count) / built.byteLength
      count = Math.max(1, Math.min(count - 1, Math.floor(count * ratio * 0.95)))
      built = await buildRange(src, from, from + count - 1)
    }

    parts.push({ bytes: built, size: built.byteLength, from: from + 1, to: from + count })
    from += count
    opts.onProgress?.(from, total)
  }

  return { parts, avisos }
}

/** Conta páginas com pdf-lib (usa ignoreEncryption para PDFs com senha de dono). */
export async function countPages(bytes: Uint8Array): Promise<number> {
  const doc = await loadDoc(bytes)
  return doc.getPageCount()
}
