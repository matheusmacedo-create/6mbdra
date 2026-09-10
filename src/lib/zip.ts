import { zipSync } from 'fflate'
import type { OutputFile } from './types'
import { uniqueNames } from './naming'

/** Empacota os PDFs (já comprimidos; usa "store" para não gastar CPU à toa). */
export function buildZip(files: OutputFile[]): Uint8Array {
  const names = uniqueNames(files.map((f) => f.name))
  const entries: Record<string, [Uint8Array, { level: 0 }]> = {}
  files.forEach((f, i) => {
    entries[names[i]] = [f.bytes, { level: 0 }]
  })
  return zipSync(entries)
}
