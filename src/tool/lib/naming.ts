/** Remove a extensão .pdf (qualquer caixa) e caracteres proibidos em nomes de arquivo. */
export function baseName(fileName: string): string {
  const withoutExt = fileName.replace(/\.pdf$/i, '')
  const cleaned = withoutExt
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned || 'documento'
}

/** contrato.pdf -> contrato_otimizado.pdf (spec §8.2) */
export function compressedName(fileName: string): string {
  return `${baseName(fileName)}_otimizado.pdf`
}

/** laudo.pdf, 2, 3 -> laudo_parte_02.pdf (zero à esquerda conforme o total) */
export function partName(fileName: string, part: number, total: number): string {
  const width = Math.max(2, String(total).length)
  return `${baseName(fileName)}_parte_${String(part).padStart(width, '0')}.pdf`
}

/** Garante nomes únicos dentro de um zip: a.pdf, a_2.pdf, a_3.pdf… */
export function uniqueNames(names: string[]): string[] {
  const seen = new Map<string, number>()
  const used = new Set(names.map((n) => n.toLowerCase()))
  return names.map((n) => {
    const key = n.toLowerCase()
    const count = seen.get(key) ?? 0
    seen.set(key, count + 1)
    if (count === 0) return n
    let k = count + 1
    let candidate = n.replace(/\.pdf$/i, '') + `_${k}.pdf`
    while (used.has(candidate.toLowerCase())) {
      k++
      candidate = n.replace(/\.pdf$/i, '') + `_${k}.pdf`
    }
    used.add(candidate.toLowerCase())
    return candidate
  })
}
