import { RpcAborted, RpcClient, RpcRemoteError } from '../rpc'
import { buildGsArgs } from './gsArgs'
import type { GsInitParams, GsRunParams, GsRunResult } from './gsProtocol'
import { EngineError, type CompressionEngine, type CompressOptions, type CompressResult } from './types'

const GS_VERSION_DIR = 'gs'

export function ghostscriptAssetUrls(): GsInitParams {
  const base = new URL(import.meta.env.BASE_URL, window.location.href).href
  return {
    jsUrl: new URL(`${GS_VERSION_DIR}/gs.js`, base).href,
    wasmUrl: new URL(`${GS_VERSION_DIR}/gs.wasm`, base).href,
  }
}

function classifyFailure(r: GsRunResult): EngineError {
  const text = `${r.stderr}\n${r.stdout}`
  if (/requires a password for access|Password did not work|PDFPassword/i.test(text)) {
    return new EngineError('Este PDF está protegido por senha. Remova a senha e tente novamente.', 'PASSWORD', text.slice(-2000))
  }
  if (/out of memory|VMerror|Memory allocation failed/i.test(text)) {
    return new EngineError('Faltou memória para processar este arquivo neste navegador.', 'OOM', text.slice(-2000))
  }
  if (/Catalog dictionary not located|unable to proceed|Unrecoverable error|Cannot open|not a PDF|Couldn't find trailer|Failed to read|No pages will be processed|File does not begin with %PDF|Error: \/undefined/i.test(text)) {
    return new EngineError('O arquivo parece estar corrompido ou não é um PDF válido.', 'INVALID', text.slice(-2000))
  }
  return new EngineError(`O motor de compressão falhou (código ${r.exitCode}).`, 'UNKNOWN', text.slice(-2000))
}

/** Sinais no log de que a saída não é confiável, mesmo com código de saída 0. */
function hasFatalMarkers(r: GsRunResult): boolean {
  const text = `${r.stderr}\n${r.stdout}`
  return /requires a password for access|Catalog dictionary not located|unable to proceed|Unrecoverable error|No pages will be processed|Memory allocation failed/i.test(text)
}

/** Quantas linhas "Page N" o pdfwrite imprimiu (= páginas efetivamente processadas). */
function pagesProcessed(r: GsRunResult): number {
  const m = r.stdout.match(/^Page \d+/gm)
  return m ? m.length : 0
}

/** Motor principal: Ghostscript (pdfwrite) rodando em WebAssembly dentro de um Web Worker. */
export class GhostscriptEngine implements CompressionEngine {
  readonly id = 'ghostscript' as const
  readonly label = 'Ghostscript'
  readonly preservesText = true
  private client: RpcClient
  private initPromise: Promise<void> | null = null

  constructor(private readonly urls: GsInitParams = ghostscriptAssetUrls()) {
    this.client = new RpcClient(() => new Worker(new URL('../../workers/gs.worker.ts', import.meta.url), { type: 'module' }))
  }

  static isSupported(): boolean {
    return typeof WebAssembly === 'object' && typeof Worker === 'function'
  }

  /** Baixa e compila o motor (16 MB, fica em cache). Idempotente. */
  warmUp(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.client.call<void>('init', this.urls).catch((e) => {
        this.initPromise = null
        throw new EngineError('Não foi possível carregar o motor de compressão.', 'UNSUPPORTED', e instanceof Error ? e.message : String(e))
      })
    }
    return this.initPromise
  }

  async compress(input: Uint8Array, opts: CompressOptions): Promise<CompressResult> {
    await this.warmUp()
    const args = buildGsArgs({ level: opts.level, grayscale: opts.grayscale, password: opts.password })
    // Copia o buffer para poder transferi-lo sem invalidar o original do chamador.
    const buffer = input.slice().buffer as ArrayBuffer
    const params: GsRunParams = { input: buffer, args, pages: opts.pages }
    let r: GsRunResult
    try {
      r = await this.client.call<GsRunResult>('run', params, {
        transfer: [buffer],
        onProgress: opts.onProgress,
        signal: opts.signal,
      })
    } catch (e) {
      if (e instanceof RpcAborted) throw new EngineError('Cancelado.', 'ABORTED')
      if (e instanceof RpcRemoteError) {
        // Worker morreu ou falhou fora do fluxo normal: força reinício na próxima chamada.
        this.client.terminate()
        this.initPromise = null
        throw new EngineError('O motor de compressão falhou.', 'UNKNOWN', e.remote.detail ?? e.message)
      }
      this.client.terminate()
      this.initPromise = null
      throw new EngineError('O motor de compressão parou de responder.', 'UNKNOWN', e instanceof Error ? e.message : String(e))
    }
    const out = new Uint8Array(r.output)
    const processed = pagesProcessed(r)
    if (r.exitCode !== 0 || out.byteLength < 100 || !startsWithPdfHeader(out) || hasFatalMarkers(r) || processed === 0) {
      throw classifyFailure(r)
    }
    if (opts.pages && processed < opts.pages) {
      throw new EngineError(
        `O motor processou só ${processed} de ${opts.pages} páginas; o arquivo pode estar danificado.`,
        'INVALID',
        r.stderr.slice(-2000),
      )
    }
    return { bytes: out, log: r.stderr, pages: processed }
  }

  dispose() {
    this.client.terminate()
    this.initPromise = null
  }
}

function startsWithPdfHeader(bytes: Uint8Array): boolean {
  return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 // %PDF
}
