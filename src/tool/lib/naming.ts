/**
 * Nomes de arquivo "à prova de sistema": sem acento, sem espaço, sem caracteres especiais,
 * curtos e previsíveis. Portais de peticionamento usam o nome do arquivo como descrição
 * padrão e alguns recusam acentos ou barras; numerar mantém a ordem do lote.
 */
const MAX_BASE = 60

const pad = (n: number, width: number) => String(n).padStart(width, '0')
const widthFor = (total: number) => Math.max(2, String(total).length)

/** "Petição Inicial - JOÃO (v2).pdf" → "Peticao_Inicial-JOAO_v2" */
export function slug(text: string): string {
  const ascii = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  let s = ascii
    .replace(/[^A-Za-z0-9._-]+/g, '_') // espaços, barras, dois-pontos, controle, emoji…
    .replace(/\.{2,}/g, '.')
    .replace(/_*([.-])_*/g, '$1') // "_-_" → "-", "_._" → "."
    .replace(/[._-]{2,}/g, (m) => m[0])
    .replace(/^[._-]+|[._-]+$/g, '')
  if (s.length > MAX_BASE) s = s.slice(0, MAX_BASE).replace(/[._-]+$/, '')
  return s
}

/** Remove a extensão .pdf (qualquer caixa) e devolve a base segura; nunca vazia. */
export function baseName(fileName: string): string {
  return slug(fileName.replace(/\.pdf$/i, '')) || 'documento'
}

/** Nome seguro para um arquivo mantido como está (mesma sanitização dos gerados). */
export function safeFileName(fileName: string): string {
  return `${baseName(fileName)}.pdf`
}

/** contrato.pdf → contrato_otimizado.pdf (spec §8.2; o sufixo evita confundir com o original ao baixar um a um) */
export function compressedName(fileName: string): string {
  return `${baseName(fileName)}_otimizado.pdf`
}

/** laudo.pdf, 2, 3 → laudo_parte_02_de_03.pdf ("de N" deixa claro quando falta uma parte; zero à esquerda mantém a ordem) */
export function partName(fileName: string, part: number, total: number): string {
  return `${baseName(fileName)}_parte_${partSuffix(part, total)}.pdf`
}

/** 2, 3 → "02_de_03" */
export function partSuffix(part: number, total: number): string {
  const w = widthFor(total)
  return `${pad(part, w)}_de_${pad(total, w)}`
}

/** Prefixo de ordem no lote: 3, 12 → "03_" + base */
export function numberedBase(index: number, count: number, base: string): string {
  return `${pad(index, widthFor(count))}_${base}`
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
