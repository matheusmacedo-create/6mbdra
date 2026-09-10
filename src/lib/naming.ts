/** Remove a extensão .pdf (qualquer caixa) e caracteres problemáticos do nome. */
export function baseName(fileName: string): string {
  const withoutExt = fileName.replace(/\.pdf$/i, '')
  const cleaned = withoutExt
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned || 'documento'
}

export function compressedName(fileName: string): string {
  return `${baseName(fileName)} - compactado.pdf`
}

export function partName(fileName: string, part: number, total: number): string {
  return `${baseName(fileName)} - parte ${part} de ${total}.pdf`
}

/** Garante nomes únicos dentro de um zip (a.pdf, a (2).pdf, ...). */
export function uniqueNames(names: string[]): string[] {
  const seen = new Map<string, number>()
  return names.map((n) => {
    const count = seen.get(n) ?? 0
    seen.set(n, count + 1)
    if (count === 0) return n
    return n.replace(/\.pdf$/i, '') + ` (${count + 1}).pdf`
  })
}
