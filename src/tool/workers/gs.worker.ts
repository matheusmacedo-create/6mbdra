/// <reference lib="webworker" />
import createModule from '@jspawn/ghostscript-wasm/gs.js'
import wasmUrl from '@jspawn/ghostscript-wasm/gs.wasm?url'
import { serveRpc } from '../lib/rpc'
import type { GsRunParams, GsRunResult } from '../lib/engine/gsProtocol'
import { GS_INPUT, GS_OUTPUT } from '../lib/engine/gsArgs'

declare const self: DedicatedWorkerGlobalScope

let compiled: WebAssembly.Module | undefined
let compiling: Promise<WebAssembly.Module> | undefined

/** Baixa e compila o gs.wasm uma única vez por worker (fica em cache do navegador). */
function ensureCompiled(): Promise<WebAssembly.Module> {
  if (compiled) return Promise.resolve(compiled)
  if (!compiling) {
    compiling = compileWasm(wasmUrl).then((m) => {
      compiled = m
      return m
    })
    compiling.catch(() => {
      compiling = undefined
    })
  }
  return compiling
}

async function compileWasm(url: string): Promise<WebAssembly.Module> {
  try {
    if (typeof WebAssembly.compileStreaming === 'function') {
      return await WebAssembly.compileStreaming(fetch(url))
    }
  } catch {
    // MIME type errado ou sem suporte a streaming: cai no caminho abaixo.
  }
  const r = await fetch(url)
  if (!r.ok) throw new Error(`Falha ao baixar o motor (${r.status}).`)
  return WebAssembly.compile(await r.arrayBuffer())
}

/** Acumula caracteres em linhas e chama onLine a cada quebra. */
function lineSink(onLine: (line: string) => void) {
  let buf: number[] = []
  return (c: number | null) => {
    if (c === null || c === 10) {
      if (buf.length) onLine(String.fromCharCode(...buf))
      buf = []
      return
    }
    buf.push(c)
  }
}

async function run(params: GsRunParams, ctx: { progress: (f: number, d?: string) => void }): Promise<{ result: GsRunResult; transfer: Transferable[] }> {
  const module = await ensureCompiled()
  const t0 = performance.now()
  const stdout: string[] = []
  const stderr: string[] = []
  let pagesProcessed = 0

  const onLine = (line: string) => {
    const m = /^Page (\d+)/.exec(line)
    if (m) {
      pagesProcessed++
      const page = Number(m[1])
      const frac = params.pages ? Math.min(0.99, page / params.pages) : Math.min(0.9, 1 - 1 / (1 + page / 10))
      ctx.progress(frac, params.pages ? `página ${page} de ${params.pages}` : `página ${page}`)
    }
  }

  const Module = await createModule({
    noInitialRun: true,
    locateFile: (file) => (file.endsWith('.wasm') ? wasmUrl : file),
    instantiateWasm: (imports, cb) => {
      WebAssembly.instantiate(module, imports).then((instance) => cb(instance, module))
      return {}
    },
    stdout: lineSink((l) => {
      stdout.push(l)
      onLine(l)
    }),
    stderr: lineSink((l) => {
      stderr.push(l)
      onLine(l)
    }),
    print: (t) => stdout.push(t),
    printErr: (t) => stderr.push(t),
  })

  Module.FS.writeFile(GS_INPUT, new Uint8Array(params.input))
  let exitCode = 0
  try {
    const code = Module.callMain(params.args)
    exitCode = typeof code === 'number' ? code : 0
  } catch (e) {
    const status = (e as { status?: unknown })?.status
    if (typeof status === 'number') exitCode = status
    else throw e
  }

  let output: Uint8Array = new Uint8Array(0)
  try {
    output = Module.FS.readFile(GS_OUTPUT, { encoding: 'binary' })
  } catch {
    // sem saída: o chamador decide com base no exitCode/log
  }
  // Copia para fora da memória do WASM antes de descartar o módulo.
  const copy = output.slice().buffer as ArrayBuffer
  const result: GsRunResult = {
    output: copy,
    exitCode,
    stdout: stdout.join('\n'),
    stderr: stderr.join('\n'),
    pagesProcessed,
    seconds: (performance.now() - t0) / 1000,
  }
  return { result, transfer: [copy] }
}

serveRpc(self, {
  init: async () => {
    await ensureCompiled()
    return { result: true }
  },
  run: (p: GsRunParams, ctx) => run(p, ctx),
})
