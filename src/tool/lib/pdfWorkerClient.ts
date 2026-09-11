import { RpcClient, RpcRemoteError } from './rpc'
import { SplitError, type SplitPart } from './split'
import type { Analysis } from './analyze'
import type { SplitResultPart } from '../workers/pdf.worker'

/** Cliente do worker de pdf-lib (análise, contagem de páginas e divisão em partes). */
export class PdfWorkerClient {
  private client = new RpcClient(() => new Worker(new URL('../workers/pdf.worker.ts', import.meta.url), { type: 'module' }))

  async analyze(bytes: Uint8Array, signal?: AbortSignal): Promise<Analysis> {
    const buf = bytes.slice().buffer as ArrayBuffer
    return this.client.call<Analysis>('analyze', { input: buf }, { transfer: [buf], signal })
  }

  async countPages(bytes: Uint8Array, signal?: AbortSignal): Promise<number> {
    const buf = bytes.slice().buffer as ArrayBuffer
    return this.client.call<number>('count', { input: buf }, { transfer: [buf], signal })
  }

  async split(bytes: Uint8Array, maxBytes: number, onProgress?: (done: number, total: number) => void, signal?: AbortSignal): Promise<SplitPart[]> {
    const buf = bytes.slice().buffer as ArrayBuffer
    try {
      const parts = await this.client.call<SplitResultPart[]>(
        'split',
        { input: buf, maxBytes },
        {
          transfer: [buf],
          signal,
          onProgress: (_f, detail) => {
            if (!detail) return
            const [d, t] = detail.split('/').map(Number)
            if (Number.isFinite(d) && Number.isFinite(t)) onProgress?.(d, t)
          },
        },
      )
      return parts.map((p) => ({ bytes: new Uint8Array(p.bytes), size: p.bytes.byteLength, from: p.from, to: p.to }))
    } catch (e) {
      if (e instanceof RpcRemoteError && (e.remote.code === 'PAGE_TOO_BIG' || e.remote.code === 'EMPTY' || e.remote.code === 'LOAD')) {
        throw new SplitError(e.remote.message, e.remote.code)
      }
      throw e
    }
  }

  dispose() {
    this.client.terminate()
  }
}
