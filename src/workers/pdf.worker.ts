/// <reference lib="webworker" />
import { serveRpc } from '../lib/rpc'
import { countPages, splitPdf, SplitError } from '../lib/split'

declare const self: DedicatedWorkerGlobalScope

interface CountParams { input: ArrayBuffer }
interface SplitParams { input: ArrayBuffer; maxBytes: number }
export interface SplitResultPart { bytes: ArrayBuffer; from: number; to: number }

serveRpc(
  self,
  {
    count: async (p: CountParams) => ({ result: await countPages(new Uint8Array(p.input)) }),
    split: async (p: SplitParams, ctx) => {
      const parts = await splitPdf(new Uint8Array(p.input), {
        maxBytes: p.maxBytes,
        onProgress: (done, total) => ctx.progress(done / total, `${done}/${total}`),
      })
      const result: SplitResultPart[] = parts.map((x) => ({ bytes: x.bytes.buffer as ArrayBuffer, from: x.from, to: x.to }))
      return { result, transfer: result.map((r) => r.bytes) }
    },
  },
  (e) => ({
    message: e instanceof Error ? e.message : String(e),
    code: e instanceof SplitError ? e.code : undefined,
  }),
)
