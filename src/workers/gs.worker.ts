/// <reference lib="webworker" />
import { serveRpc } from '../lib/rpc'
import type { GsInitParams, GsRunParams, GsRunResult } from '../lib/engine/gsProtocol'
import { GS_INPUT, GS_OUTPUT } from '../lib/engine/gsArgs'

declare const self: DedicatedWorkerGlobalScope

interface EmscriptenFS {
  writeFile(path: string, data: Uint8Array): void
  readFile(path: string, opts?: { encoding: 'binary' }): Uint8Array
  unlink(path: string): void
  analyzePath?(path: string): { exists: boolean }
}

interface GsModule {
  FS: EmscriptenFS
  callMain(args: string[]): number | undefined
}

interface GsModuleOptions {
  noInitialRun?: boolean
  locateFile?: (file: string, prefix: string) => string
  instantiateWasm?: (imports: WebAssembly.Imports, cb: (instance: WebAssembly.Instance, module?: WebAssembly.Module) => void) => Record<string, never>
  print?: (text: string) => void
  printErr?: (text: string) => void
  onAbort?: (what: unknown) => void
}

type CreateModule = (opts: GsModuleOptions) => Promise<GsModule>

let createModule: CreateModule | undefined
let compiled: WebAssembly.Module | undefined
let wasmUrl = ''

/**
 * Este build do Ghostscript ignora Module.print/printErr e escreve stdout/stderr em
 * console.log/console.warn, capturados por bind() no momento em que o glue é avaliado.
 * Por isso trocamos o console do worker ANTES de avaliar o glue e roteamos para a
 * execução atual.
 */
const sink = {
  out: (_text: string) => {},
  err: (_text: string) => {},
}
const origConsole = { log: console.log.bind(console), warn: console.warn.bind(console), error: console.error.bind(console) }
const joinArgs = (args: unknown[]) => args.map((a) => (typeof a === 'string' ? a : String(a))).join(' ')
console.log = (...args: unknown[]) => sink.out(joinArgs(args))
console.warn = (...args: unknown[]) => sink.err(joinArgs(args))
console.error = (...args: unknown[]) => sink.err(joinArgs(args))

async function init(params: GsInitParams): Promise<void> {
  if (createModule && compiled) return
  wasmUrl = params.wasmUrl
  const [src, wasm] = await Promise.all([
    fetch(params.jsUrl).then((r) => {
      if (!r.ok) throw new Error(`Falha ao baixar o motor (${r.status}).`)
      return r.text()
    }),
    compileWasm(params.wasmUrl),
  ])
  // gs.js é um UMD: com `module`/`exports` definidos, ele exporta a factory MODULARIZE.
  const mod: { exports: unknown } = { exports: {} }
  new Function('module', 'exports', src)(mod, mod.exports)
  createModule = mod.exports as CreateModule
  compiled = wasm
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

async function run(params: GsRunParams, ctx: { progress: (f: number, d?: string) => void }): Promise<{ result: GsRunResult; transfer: Transferable[] }> {
  if (!createModule || !compiled) throw new Error('Motor não inicializado.')
  const t0 = performance.now()
  const stdout: string[] = []
  const stderr: string[] = []
  const compiledModule = compiled

  const onLine = (text: string) => {
    const m = /^Page (\d+)/.exec(text)
    if (m) {
      const page = Number(m[1])
      const frac = params.pages ? Math.min(0.99, page / params.pages) : Math.min(0.9, 1 - 1 / (1 + page / 10))
      ctx.progress(frac, params.pages ? `página ${page} de ${params.pages}` : `página ${page}`)
    }
  }
  sink.out = (text) => {
    stdout.push(text)
    onLine(text)
  }
  sink.err = (text) => {
    stderr.push(text)
    onLine(text)
  }

  const Module = await createModule({
    noInitialRun: true,
    locateFile: (file) => (file.endsWith('.wasm') ? wasmUrl : file),
    instantiateWasm: (imports, cb) => {
      WebAssembly.instantiate(compiledModule, imports).then((instance) => cb(instance, compiledModule))
      return {}
    },
    print: (text) => sink.out(text),
    printErr: (text) => sink.err(text),
  })

  Module.FS.writeFile(GS_INPUT, new Uint8Array(params.input))
  let exitCode = 0
  try {
    const code = Module.callMain(params.args)
    exitCode = typeof code === 'number' ? code : 0
  } catch (e) {
    const status = (e as { status?: unknown })?.status
    if (typeof status === 'number') exitCode = status
    else {
      sink.out = () => {}
      sink.err = () => {}
      origConsole.error('[gs.worker] exceção no Ghostscript:', e)
      throw e
    }
  } finally {
    sink.out = () => {}
    sink.err = () => {}
  }

  let output: Uint8Array = new Uint8Array(0)
  try {
    output = Module.FS.readFile(GS_OUTPUT, { encoding: 'binary' })
  } catch {
    // sem saída: erro será tratado pelo chamador com base no exitCode/stderr
  }
  // Copia para fora da memória do WASM antes de descartar o módulo.
  const copy = output.slice().buffer as ArrayBuffer
  const result: GsRunResult = {
    output: copy,
    exitCode,
    stdout: stdout.join('\n'),
    stderr: stderr.join('\n'),
    seconds: (performance.now() - t0) / 1000,
  }
  return { result, transfer: [copy] }
}

serveRpc(self, {
  init: async (p: GsInitParams) => ({ result: await init(p) }),
  run: (p: GsRunParams, ctx) => run(p, ctx),
})
