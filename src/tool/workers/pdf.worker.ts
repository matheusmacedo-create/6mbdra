/// <reference lib="webworker" />
import { serveRpc } from '../lib/rpc'
import { countPages, splitPdf, SplitError } from '../lib/split'
import { analyzePdf } from '../lib/analyze'

declare const self: DedicatedWorkerGlobalScope

interface BytesParams {
  input: ArrayBuffer
}
interface SplitParams {
  input: ArrayBuffer
  maxBytes: number
}
export interface SplitResultPart {
  bytes: ArrayBuffer
  from: number
  to: number
}
export interface SplitResultMessage {
  parts: SplitResultPart[]
  avisos: string[]
}

serveRpc(
  self,
  {
    analyze: async (p: BytesParams) => ({ result: await analyzePdf(new Uint8Array(p.input)) }),
    count: async (p: BytesParams) => ({ result: await countPages(new Uint8Array(p.input)) }),
    split: async (p: SplitParams, ctx) => {
      const { parts, avisos } = await splitPdf(new Uint8Array(p.input), {
        maxBytes: p.maxBytes,
        onProgress: (done, total) => ctx.progress(done / total, `${done}/${total}`),
      })
      const result: SplitResultMessage = { parts: parts.map((x) => ({ bytes: x.bytes.buffer as ArrayBuffer, from: x.from, to: x.to })), avisos }
      return { result, transfer: result.parts.map((r) => r.bytes) }
    },
  },
  (e) => ({
    message: e instanceof Error ? e.message : String(e),
    code: e instanceof SplitError ? e.code : undefined,
  }),
)
