import { zipSync } from 'fflate'
import type { OutputFile } from './types'
import { uniqueNames } from './naming'
import type { ZipEntry } from './zipPlan'

/** Empacota os PDFs na ordem recebida (já comprimidos: usa "store", sem gastar CPU à toa). */
export function buildZip(files: OutputFile[]): Uint8Array {
  const names = uniqueNames(files.map((f) => f.name))
  return buildZipEntries(files.map((f, i) => ({ path: names[i], bytes: f.bytes })))
}

/** Empacota entradas com caminho (pastas implícitas pelo "/"), na ordem recebida. */
export function buildZipEntries(entries: ZipEntry[]): Uint8Array {
  const data: Record<string, [Uint8Array, { level: 0 }]> = {}
  for (const e of entries) data[e.path] = [e.bytes, { level: 0 }]
  return zipSync(data)
}
