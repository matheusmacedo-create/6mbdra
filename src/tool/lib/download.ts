import type { OutputFile } from './types'
import { buildZip } from './zip'

function triggerDownload(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Dá tempo ao navegador de iniciar o download antes de liberar a URL.
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

export function downloadFile(file: OutputFile) {
  triggerDownload(new Blob([file.bytes as BlobPart], { type: 'application/pdf' }), file.name)
}

export function downloadZip(files: OutputFile[], zipName = 'pdfs-preparados.zip') {
  const zip = buildZip(files)
  triggerDownload(new Blob([zip as BlobPart], { type: 'application/zip' }), zipName)
}
