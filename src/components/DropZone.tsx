import { useCallback, useRef, useState, type DragEvent } from 'react'

interface Props {
  onFiles: (files: File[]) => void
  disabled?: boolean
}

async function collectFiles(items: DataTransferItemList | null, fallback: FileList | null): Promise<File[]> {
  const out: File[] = []
  // Suporte a pastas arrastadas (Chrome/Edge/Firefox).
  if (items && items.length > 0 && 'webkitGetAsEntry' in items[0]) {
    const walk = async (entry: FileSystemEntry | null): Promise<void> => {
      if (!entry) return
      if (entry.isFile) {
        const f = await new Promise<File>((res, rej) => (entry as FileSystemFileEntry).file(res, rej))
        out.push(f)
      } else if (entry.isDirectory) {
        const reader = (entry as FileSystemDirectoryEntry).createReader()
        const readAll = async (): Promise<FileSystemEntry[]> => {
          const acc: FileSystemEntry[] = []
          for (;;) {
            const batch = await new Promise<FileSystemEntry[]>((res, rej) => reader.readEntries(res, rej))
            if (batch.length === 0) break
            acc.push(...batch)
          }
          return acc
        }
        for (const child of await readAll()) await walk(child)
      }
    }
    const entries = Array.from(items).map((it) => it.webkitGetAsEntry())
    if (entries.some(Boolean)) {
      for (const e of entries) await walk(e)
      return out
    }
  }
  return fallback ? Array.from(fallback) : out
}

export function DropZone({ onFiles, disabled }: Props) {
  const [active, setActive] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const onDrop = useCallback(
    async (e: DragEvent) => {
      e.preventDefault()
      setActive(false)
      if (disabled) return
      const files = await collectFiles(e.dataTransfer.items, e.dataTransfer.files)
      onFiles(files)
    },
    [onFiles, disabled],
  )

  return (
    <div
      className={`dropzone${active ? ' active' : ''}`}
      role="button"
      tabIndex={0}
      aria-label="Escolher arquivos PDF"
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          inputRef.current?.click()
        }
      }}
      onDragOver={(e) => {
        e.preventDefault()
        if (!active) setActive(true)
      }}
      onDragLeave={() => setActive(false)}
      onDrop={onDrop}
    >
      <div className="icon" aria-hidden="true">📄</div>
      <div className="big">Arraste seus PDFs para cá</div>
      <div className="small">ou clique para escolher no computador. Pode selecionar vários de uma vez.</div>
      <div style={{ marginTop: 14 }}>
        <span className="btn">Escolher PDFs</span>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        className="sr-only"
        data-testid="file-input"
        onChange={(e) => {
          const files = e.target.files ? Array.from(e.target.files) : []
          onFiles(files)
          e.target.value = ''
        }}
      />
    </div>
  )
}
