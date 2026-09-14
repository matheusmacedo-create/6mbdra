/**
 * Junta vários PDFs em um só, na ordem recebida.
 *
 * Roda no worker do pdf-lib, como a divisão, e pelo mesmo motivo: o documento nunca sai do
 * navegador. Copiar páginas preserva o conteúdo e a camada de texto (OCR continua pesquisável),
 * mas não leva o catálogo do original — por isso a lista de avisos, igual à da divisão.
 *
 * Quem chama é responsável por não mandar documento assinado: juntar reescreve o arquivo e a
 * assinatura digital do original não sobrevive a isso.
 */
import { PDFDocument } from 'pdf-lib'
import { droppedFeatures } from './split'

export interface MergeInput {
  nome: string
  bytes: Uint8Array
}

/** Onde cada documento foi parar no arquivo final (1-based, inclusivo). */
export interface MergeRange {
  nome: string
  de: number
  ate: number
}

export interface MergeResult {
  bytes: Uint8Array
  paginas: number
  indice: MergeRange[]
  avisos: string[]
}

export async function mergePdfs(entradas: MergeInput[], onProgress?: (feitos: number, total: number) => void): Promise<MergeResult> {
  if (entradas.length < 2) throw new Error('São necessários pelo menos dois documentos para juntar.')

  const saida = await PDFDocument.create()
  const indice: MergeRange[] = []
  const perdidos = new Set<string>()

  for (const [i, entrada] of entradas.entries()) {
    let origem: PDFDocument
    try {
      origem = await PDFDocument.load(entrada.bytes, { ignoreEncryption: true, updateMetadata: false })
    } catch (e) {
      throw new Error(`Não foi possível ler "${entrada.nome}" para juntar: ${(e as Error).message}`)
    }
    const total = origem.getPageCount()
    if (total === 0) throw new Error(`"${entrada.nome}" não tem páginas.`)
    for (const f of droppedFeatures(origem)) perdidos.add(f)

    const de = saida.getPageCount() + 1
    const paginas = await saida.copyPages(origem, origem.getPageIndices())
    for (const p of paginas) saida.addPage(p)
    indice.push({ nome: entrada.nome, de, ate: saida.getPageCount() })
    onProgress?.(i + 1, entradas.length)
  }

  const avisos: string[] = []
  if (perdidos.size) {
    avisos.push(`O arquivo juntado não mantém ${[...perdidos].join(', ')} dos originais; ele contém só as páginas copiadas.`)
  }
  avisos.push(`Ordem: ${indice.map((r) => `${r.nome} (${r.de === r.ate ? `p. ${r.de}` : `p. ${r.de}–${r.ate}`})`).join(', ')}.`)

  const bytes = await saida.save({ useObjectStreams: true, addDefaultPage: false })
  return { bytes, paginas: saida.getPageCount(), indice, avisos }
}
