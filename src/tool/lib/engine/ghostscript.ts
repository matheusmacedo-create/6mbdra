import { RpcAborted, RpcClient, RpcRemoteError } from '../rpc'
import { buildGsArgs } from './gsArgs'
import type { GsRunParams, GsRunResult } from './gsProtocol'
import { EngineError, type CompressionEngine, type CompressOptions, type CompressResult } from './types'

const FATAL = /requires a password for access|Password did not work|Catalog dictionary not located|unable to proceed|Unrecoverable error|No pages will be processed|Couldn't initialise file|Memory allocation failed|VMerror/i

function classifyFailure(r: GsRunResult): EngineError {
  const text = `${r.stderr}\n${r.stdout}`
  if (/requires a password for access|Password did not work|PDFPassword/i.test(text)) {
    return new EngineError('Este PDF está protegido por senha.', 'PASSWORD', text.slice(-2000))
  }
  if (/out of memory|VMerror|Memory allocation failed/i.test(text)) {
    return new EngineError('Faltou memória para processar este arquivo neste navegador.', 'OOM', text.slice(-2000))
  }
  if (/Catalog dictionary not located|unable to proceed|Unrecoverable error|Couldn't initialise file|No pages will be processed|Cannot find a startxref|not a PDF|Couldn't find trailer|File does not begin with %PDF/i.test(text)) {
    return new EngineError('O arquivo parece estar corrompido ou não é um PDF válido.', 'INVALID', text.slice(-2000))
  }
  return new EngineError(`O motor de compressão falhou (código ${r.exitCode}).`, 'UNKNOWN', text.slice(-2000))
}

function collectWarnings(r: GsRunResult): string[] {
  const text = `${r.stderr}\n${r.stdout}`
  const w: string[] = []
  if (/PDF file was repaired|had errors that were repaired or ignored/i.test(text)) {
    w.push('O arquivo original tinha defeitos que foram reparados. Confira o resultado página a página.')
  }
  if (/\*\*\*\* Error reading a content stream|page may be incomplete/i.test(text)) {
    w.push('Uma ou mais páginas do original estavam danificadas e podem ter saído incompletas.')
  }
  return w
}

function startsWithPdfHeader(bytes: Uint8Array): boolean {
  return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 // %PDF
}

/** Motor principal: Ghostscript 9.56 (pdfwrite) em WebAssembly dentro de um Web Worker. */
export class GhostscriptEngine implements CompressionEngine {
  readonly id = 'ghostscript' as const
  readonly label = 'Ghostscript'
  private client: RpcClient
  private initPromise: Promise<void> | null = null

  constructor() {
    this.client = new RpcClient(() => new Worker(new URL('../../workers/gs.worker.ts', import.meta.url), { type: 'module' }))
  }

  static isSupported(): boolean {
    return typeof WebAssembly === 'object' && typeof Worker === 'function'
  }

  /** Baixa e compila o motor (16 MB, fica em cache). Idempotente. */
  warmUp(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.client.call<boolean>('init', null).then(
        () => undefined,
        (e) => {
          this.initPromise = null
          throw new EngineError('Não foi possível carregar o motor de compressão.', 'UNSUPPORTED', e instanceof Error ? e.message : String(e))
        },
      )
    }
    return this.initPromise
  }

  async compress(input: Uint8Array, opts: CompressOptions): Promise<CompressResult> {
    await this.warmUp()
    const args = buildGsArgs({ level: opts.level, grayscale: opts.grayscale })
    // Copia o buffer para poder transferi-lo sem invalidar o original do chamador.
    const buffer = input.slice().buffer as ArrayBuffer
    const params: GsRunParams = { input: buffer, args, pages: opts.pages }
    let r: GsRunResult
    try {
      r = await this.client.call<GsRunResult>('run', params, { transfer: [buffer], onProgress: opts.onProgress, signal: opts.signal })
    } catch (e) {
      if (e instanceof RpcAborted) throw new EngineError('Cancelado.', 'ABORTED')
      // Worker morreu ou falhou fora do fluxo normal: força reinício na próxima chamada.
      this.client.terminate()
      this.initPromise = null
      const detail = e instanceof RpcRemoteError ? (e.remote.detail ?? e.message) : e instanceof Error ? e.message : String(e)
      if (/memory|RangeError|allocation/i.test(detail)) throw new EngineError('Faltou memória para processar este arquivo.', 'OOM', detail)
      throw new EngineError('O motor de compressão falhou.', 'UNKNOWN', detail)
    }
    const out = new Uint8Array(r.output)
    const text = `${r.stderr}\n${r.stdout}`
    if (r.exitCode !== 0 || out.byteLength < 100 || !startsWithPdfHeader(out) || FATAL.test(text) || r.pagesProcessed === 0) {
      throw classifyFailure(r)
    }
    if (opts.pages && r.pagesProcessed < opts.pages) {
      throw new EngineError(`O motor processou só ${r.pagesProcessed} de ${opts.pages} páginas; o arquivo pode estar danificado.`, 'INVALID', r.stderr.slice(-2000))
    }
    return { bytes: out, pages: r.pagesProcessed, warnings: collectWarnings(r), log: r.stderr }
  }

  dispose() {
    this.client.terminate()
    this.initPromise = null
  }
}
