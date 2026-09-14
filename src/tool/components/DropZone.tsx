import { useCallback, useRef, useState, type DragEvent } from 'react'

interface Props {
  onFiles: (files: File[]) => void
  disabled?: boolean
  /** "hero": área grande com ícone; "compact": faixa "Adicionar mais PDFs" no fim do lote */
  variant?: 'hero' | 'compact'
  /** Chamada principal da área grande (o herói e a ferramenta usam textos diferentes) */
  title?: string
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

function UploadIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 17V3" />
      <path d="m6 9 6-6 6 6" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  )
}

export function DropZone({ onFiles, disabled, variant = 'hero', title }: Props) {
  const [active, setActive] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const compact = variant === 'compact'

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
      className={`dropzone zone-${variant}${active ? ' active' : ''}`}
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
      {!compact && (
        <div className="icon-box">
          <UploadIcon />
        </div>
      )}
      <div className="big">{compact ? 'Adicionar mais PDFs' : (title ?? 'Arraste seus PDFs aqui')}</div>
      <div className="small">{compact ? 'Arraste ou clique para escolher' : 'ou clique para selecionar vários arquivos ou uma pasta'}</div>
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
