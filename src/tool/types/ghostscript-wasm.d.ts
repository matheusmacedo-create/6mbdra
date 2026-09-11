declare module '@jspawn/ghostscript-wasm/gs.js' {
  interface GsFS {
    writeFile(path: string, data: Uint8Array): void
    readFile(path: string, opts: { encoding: 'binary' }): Uint8Array
    unlink(path: string): void
  }
  interface GsModule {
    FS: GsFS
    callMain(args: string[]): number | undefined
  }
  interface GsModuleOptions {
    noInitialRun?: boolean
    locateFile?: (file: string, prefix: string) => string
    instantiateWasm?: (
      imports: WebAssembly.Imports,
      cb: (instance: WebAssembly.Instance, module?: WebAssembly.Module) => void,
    ) => Record<string, never>
    /** Callback por caractere do stdout (null = flush) */
    stdout?: (charCode: number | null) => void
    stderr?: (charCode: number | null) => void
    print?: (text: string) => void
    printErr?: (text: string) => void
  }
  const createModule: (opts?: GsModuleOptions) => Promise<GsModule>
  export default createModule
}
declare module '@jspawn/ghostscript-wasm/gs.wasm?url' {
  const url: string
  export default url
}
