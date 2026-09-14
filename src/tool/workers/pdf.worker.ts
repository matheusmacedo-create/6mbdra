/// <reference lib="webworker" />
import { serveRpc } from '../lib/rpc'
import { countPages, splitPdf, SplitError } from '../lib/split'
import { analyzePdf } from '../lib/analyze'
import { mergePdfs } from '../lib/merge'
import type { SplitBudget } from '../lib/splitTypes'

declare const self: DedicatedWorkerGlobalScope

interface BytesParams {
  input: ArrayBuffer
}
interface SplitParams {
  input: ArrayBuffer
  maxBytes: number
  budget?: SplitBudget
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
interface MergeParams {
  /** Documentos na ordem em que devem aparecer no arquivo final */
  inputs: { nome: string; bytes: ArrayBuffer }[]
}
export interface MergeResultMessage {
  bytes: ArrayBuffer
  paginas: number
  avisos: string[]
}

serveRpc(
  self,
  {
    analyze: async (p: BytesParams) => ({ result: await analyzePdf(new Uint8Array(p.input)) }),
    count: async (p: BytesParams) => ({ result: await countPages(new Uint8Array(p.input)) }),
    merge: async (p: MergeParams, ctx) => {
      const r = await mergePdfs(
        p.inputs.map((x) => ({ nome: x.nome, bytes: new Uint8Array(x.bytes) })),
        (feitos, total) => ctx.progress(feitos / total, `${feitos}/${total}`),
      )
      const result: MergeResultMessage = { bytes: r.bytes.buffer as ArrayBuffer, paginas: r.paginas, avisos: r.avisos }
      return { result, transfer: [result.bytes] }
    },
    split: async (p: SplitParams, ctx) => {
      const { parts, avisos } = await splitPdf(new Uint8Array(p.input), {
        maxBytes: p.maxBytes,
        budget: p.budget,
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
