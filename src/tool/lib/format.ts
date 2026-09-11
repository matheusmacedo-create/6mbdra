/** 1 MB = 1.000.000 bytes (decimal). Ver guia "MB vs MiB". */
export const MB = 1_000_000
export const KB = 1_000

/** Formata bytes no padrão brasileiro: "4,2 MB", "830 KB". */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes >= MB) {
    const v = bytes / MB
    return `${v.toLocaleString('pt-BR', { minimumFractionDigits: v < 10 ? 1 : 0, maximumFractionDigits: v < 100 ? 1 : 0 })} MB`
  }
  if (bytes >= KB) return `${Math.round(bytes / KB).toLocaleString('pt-BR')} KB`
  return `${bytes} B`
}

/** "12 s", "1 min 05 s" */
export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `${s} s`
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m} min ${r.toString().padStart(2, '0')} s`
}

/** Percentual de redução: (100, 13) -> "87%" */
export function formatReduction(original: number, result: number): string {
  if (original <= 0) return '0%'
  const pct = Math.max(0, Math.round((1 - result / original) * 100))
  return `${pct}%`
}

export function mbToBytes(mb: number): number {
  return Math.round(mb * MB)
}

export function bytesToMb(bytes: number): number {
  return bytes / MB
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`
}
