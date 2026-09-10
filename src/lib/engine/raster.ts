import { PDFDocument } from 'pdf-lib'
import type { PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { EngineError, type CompressionEngine, type CompressOptions, type CompressResult } from './types'

type PdfJs = typeof import('pdfjs-dist/legacy/build/pdf.mjs')

let pdfjsPromise: Promise<PdfJs> | null = null

/** Carrega o pdf.js sob demanda (só é usado no modo de emergência). */
async function loadPdfJs(): Promise<PdfJs> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      // Build "legacy" do pdf.js: funciona em navegadores mais antigos (comuns em escritórios).
      const [lib, worker] = await Promise.all([
        import('pdfjs-dist/legacy/build/pdf.mjs'),
        import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
      ])
      lib.GlobalWorkerOptions.workerSrc = worker.default
      return lib
    })()
  }
  return pdfjsPromise
}

interface RenderTarget {
  canvas: HTMLCanvasElement | OffscreenCanvas
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
}

function makeCanvas(w: number, h: number): RenderTarget {
  if (typeof OffscreenCanvas === 'function') {
    const canvas = new OffscreenCanvas(w, h)
    const ctx = canvas.getContext('2d', { alpha: false })
    if (ctx) return { canvas, ctx }
  }
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) throw new EngineError('Este navegador não permite desenhar páginas.', 'UNSUPPORTED')
  return { canvas, ctx }
}

async function toJpeg(target: RenderTarget, quality: number): Promise<Uint8Array> {
  const q = quality / 100
  let blob: Blob
  if (target.canvas instanceof OffscreenCanvas) {
    blob = await target.canvas.convertToBlob({ type: 'image/jpeg', quality: q })
  } else {
    const el = target.canvas
    blob = await new Promise<Blob>((resolve, reject) =>
      el.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob falhou'))), 'image/jpeg', q),
    )
  }
  return new Uint8Array(await blob.arrayBuffer())
}

function applyGrayscale(target: RenderTarget) {
  const { ctx, canvas } = target
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const y = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000
    d[i] = d[i + 1] = d[i + 2] = y
  }
  ctx.putImageData(img, 0, 0)
}

/**
 * Motor de emergência: renderiza cada página como imagem JPEG e remonta o PDF.
 * Funciona com quase qualquer PDF, mas o texto deixa de ser pesquisável.
 */
export class RasterEngine implements CompressionEngine {
  readonly id = 'raster' as const
  readonly label = 'Modo de emergência (imagem)'
  readonly preservesText = false

  static isSupported(): boolean {
    return typeof document !== 'undefined' && typeof Worker === 'function'
  }

  async compress(input: Uint8Array, opts: CompressOptions): Promise<CompressResult> {
    const pdfjs = await loadPdfJs()
    const { level, onProgress, signal } = opts
    const dpi = level.colorDpi
    const scale = dpi / 72

    let doc: PDFDocumentProxy
    const task = pdfjs.getDocument({ data: input.slice(), password: opts.password })
    try {
      doc = await task.promise
    } catch (e) {
      await task.destroy().catch(() => undefined)
      const name = (e as { name?: string })?.name
      if (name === 'PasswordException') throw new EngineError('Este PDF está protegido por senha. Remova a senha e tente novamente.', 'PASSWORD')
      throw new EngineError('O arquivo parece estar corrompido ou não é um PDF válido.', 'INVALID', (e as Error)?.message)
    }

    try {
      const out = await PDFDocument.create()
      const total = doc.numPages
      for (let i = 1; i <= total; i++) {
        if (signal?.aborted) throw new EngineError('Cancelado.', 'ABORTED')
        const page = await doc.getPage(i)
        const base = page.getViewport({ scale: 1 })
        const viewport = page.getViewport({ scale })
        const w = Math.max(1, Math.round(viewport.width))
        const h = Math.max(1, Math.round(viewport.height))
        const target = makeCanvas(w, h)
        target.ctx.fillStyle = '#ffffff'
        target.ctx.fillRect(0, 0, w, h)
        await page.render({ canvasContext: target.ctx as CanvasRenderingContext2D, viewport, canvas: target.canvas as HTMLCanvasElement }).promise
        if (opts.grayscale) applyGrayscale(target)
        const jpg = await toJpeg(target, level.jpegQuality)
        const img = await out.embedJpg(jpg)
        const p = out.addPage([base.width, base.height])
        p.drawImage(img, { x: 0, y: 0, width: base.width, height: base.height })
        page.cleanup()
        onProgress?.(i / total, `página ${i} de ${total}`)
      }
      const bytes = await out.save({ useObjectStreams: true })
      return { bytes }
    } finally {
      await task.destroy().catch(() => undefined)
    }
  }
}
