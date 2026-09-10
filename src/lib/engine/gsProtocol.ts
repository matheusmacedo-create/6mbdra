export interface GsInitParams {
  jsUrl: string
  wasmUrl: string
}

export interface GsRunParams {
  input: ArrayBuffer
  args: string[]
  /** Total de páginas, quando conhecido, para calcular o progresso */
  pages?: number
}

export interface GsRunResult {
  output: ArrayBuffer
  exitCode: number
  stdout: string
  stderr: string
  seconds: number
}
