/**
 * RPC mínimo sobre postMessage: cada chamada tem um id; o worker responde com
 * { id, ok, result } ou { id, ok: false, error } e pode emitir { id, progress }.
 */
export interface RpcError {
  message: string
  code?: string
  detail?: string
}

export type RpcOutbound = { id: number; method: string; params: unknown }
export type RpcInbound =
  | { id: number; ok: true; result: unknown }
  | { id: number; ok: false; error: RpcError }
  | { id: number; progress: number; detail?: string }

export interface RpcCallOptions {
  transfer?: Transferable[]
  onProgress?: (fraction: number, detail?: string) => void
  signal?: AbortSignal
}

export class RpcAborted extends Error {
  constructor() {
    super('Cancelado.')
    this.name = 'RpcAborted'
  }
}

export class RpcRemoteError extends Error {
  constructor(public readonly remote: RpcError) {
    super(remote.message)
    this.name = 'RpcRemoteError'
  }
}

export class RpcClient {
  private seq = 0
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: unknown) => void; onProgress?: RpcCallOptions['onProgress'] }>()
  private worker: Worker | null

  constructor(private readonly factory: () => Worker) {
    this.worker = null
  }

  private ensure(): Worker {
    if (!this.worker) {
      const w = this.factory()
      w.onmessage = (ev: MessageEvent<RpcInbound>) => this.handle(ev.data)
      w.onerror = (ev) => {
        const err = new Error(ev.message || 'Falha no worker.')
        for (const p of this.pending.values()) p.reject(err)
        this.pending.clear()
        this.terminate()
      }
      this.worker = w
    }
    return this.worker
  }

  private handle(msg: RpcInbound) {
    const p = this.pending.get(msg.id)
    if (!p) return
    if ('progress' in msg) {
      p.onProgress?.(msg.progress, msg.detail)
      return
    }
    this.pending.delete(msg.id)
    if (msg.ok) p.resolve(msg.result)
    else p.reject(new RpcRemoteError(msg.error))
  }

  call<T>(method: string, params: unknown, opts: RpcCallOptions = {}): Promise<T> {
    if (opts.signal?.aborted) return Promise.reject(new RpcAborted())
    const id = ++this.seq
    const w = this.ensure()
    return new Promise<T>((resolve, reject) => {
      const onAbort = () => {
        this.pending.delete(id)
        // Cancelar = matar o worker (o trabalho é síncrono lá dentro).
        this.terminate()
        reject(new RpcAborted())
      }
      opts.signal?.addEventListener('abort', onAbort, { once: true })
      this.pending.set(id, {
        resolve: (v) => { opts.signal?.removeEventListener('abort', onAbort); resolve(v as T) },
        reject: (e) => { opts.signal?.removeEventListener('abort', onAbort); reject(e) },
        onProgress: opts.onProgress,
      })
      const msg: RpcOutbound = { id, method, params }
      w.postMessage(msg, opts.transfer ?? [])
    })
  }

  terminate() {
    this.worker?.terminate()
    this.worker = null
    const err = new Error('Worker encerrado.')
    for (const p of this.pending.values()) p.reject(err)
    this.pending.clear()
  }
}

/** Lado do worker: registra handlers e cuida do protocolo. */
export function serveRpc(
  scope: { postMessage: (msg: unknown, transfer: Transferable[]) => void; onmessage: ((ev: MessageEvent) => void) | null },
  handlers: Record<string, (params: never, ctx: { progress: (fraction: number, detail?: string) => void }) => Promise<{ result: unknown; transfer?: Transferable[] }>>,
  toError: (e: unknown) => RpcError = (e) => ({ message: e instanceof Error ? e.message : String(e) }),
) {
  scope.onmessage = async (ev: MessageEvent<RpcOutbound>) => {
    const { id, method, params } = ev.data
    const handler = handlers[method]
    if (!handler) {
      scope.postMessage({ id, ok: false, error: { message: `Método desconhecido: ${method}` } } satisfies RpcInbound, [])
      return
    }
    try {
      const { result, transfer } = await handler(params as never, {
        progress: (fraction, detail) => scope.postMessage({ id, progress: fraction, detail } satisfies RpcInbound, []),
      })
      scope.postMessage({ id, ok: true, result } satisfies RpcInbound, transfer ?? [])
    } catch (e) {
      scope.postMessage({ id, ok: false, error: toError(e) } satisfies RpcInbound, [])
    }
  }
}
