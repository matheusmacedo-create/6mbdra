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
  /** Linhas "Page N" impressas pelo pdfwrite (= páginas efetivamente processadas) */
  pagesProcessed: number
  seconds: number
}
