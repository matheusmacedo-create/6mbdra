import type { OutputFile } from './types'
import { baseName, numberedBase, partSuffix, slug } from './naming'
import { formatBytes } from './format'

/**
 * Monta o "pacote do advogado": um único ZIP, com uma pasta raiz, arquivos numerados na ordem
 * do lote, documentos divididos em pasta própria, pastas por petição quando o sistema limita a
 * soma dos anexos de uma petição, e um LEIA-ME.txt com o resumo. Função pura (testável).
 */

export type ZipDocStatus = 'compressed' | 'split' | 'kept'

export interface ZipDoc {
  /** Nome original do arquivo */
  name: string
  originalSize: number
  status: ZipDocStatus
  /** 1 arquivo (comprimido ou mantido) ou N partes, em ordem */
  files: OutputFile[]
  /** Ex.: "compressão leve (200 dpi)" ou "páginas copiadas sem recompressão" */
  detail?: string
  warnings?: string[]
}

export interface ZipExcluded {
  name: string
  reason: string
}

export interface ZipPlanInput {
  docs: ZipDoc[]
  excluded?: ZipExcluded[]
  when: Date
  tribunal?: { sigla: string; sistema: string; limite: string }
  limitBytes: number
  targetBytes: number
  /** Meta para a soma dos arquivos de uma petição (já com a margem), quando a regra tem */
  petitionBytes?: number
  siteUrl?: string
}

export interface ZipEntry {
  /** Caminho dentro do ZIP, com "/" (a pasta raiz incluída) */
  path: string
  bytes: Uint8Array
}

export interface ZipPlan {
  zipName: string
  root: string
  entries: ZipEntry[]
  /** Quantas pastas de petição (1 = sem pastas) */
  petitions: number
  /** Quantidade de PDFs no pacote */
  fileCount: number
  readme: string
}

interface PlannedFile {
  rel: string
  file: OutputFile
}
interface PlannedDoc {
  doc: ZipDoc
  base: string
  files: PlannedFile[]
  total: number
}

const pad = (n: number, w: number) => String(n).padStart(w, '0')
const CRLF = '\r\n'

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1, 2)}-${pad(d.getDate(), 2)}`
}
function hourMinute(d: Date): string {
  return `${pad(d.getHours(), 2)}:${pad(d.getMinutes(), 2)}`
}

function planDocs(docs: ZipDoc[]): PlannedDoc[] {
  return docs.map((doc, i) => {
    const base = numberedBase(i + 1, docs.length, baseName(doc.name))
    const files: PlannedFile[] =
      doc.files.length === 1
        ? [{ rel: `${base}.pdf`, file: doc.files[0] }]
        : doc.files.map((f, k) => ({ rel: `${base}/${base}_parte_${partSuffix(f.part ?? k + 1, f.totalParts ?? doc.files.length)}.pdf`, file: f }))
    return { doc, base, files, total: doc.files.reduce((a, f) => a + f.size, 0) }
  })
}

/**
 * Distribui os arquivos em petições sem passar de `limit` bytes por petição, na ordem do lote.
 * Um documento fica inteiro na mesma petição sempre que couber em uma petição vazia; senão as
 * partes se espalham. Um arquivo maior que o limite vai sozinho (e o LEIA-ME avisa).
 */
export function groupIntoPetitions(planned: PlannedDoc[], limit: number): PlannedFile[][] {
  const petitions: PlannedFile[][] = [[]]
  let current = 0
  const open = () => {
    petitions.push([])
    current = 0
  }
  for (const item of planned) {
    if (current > 0 && current + item.total > limit && item.total <= limit) open()
    for (const f of item.files) {
      if (current > 0 && current + f.file.size > limit) open()
      petitions[petitions.length - 1].push(f)
      current += f.file.size
    }
  }
  return petitions
}

const STATUS_TEXT: Record<ZipDocStatus, string> = {
  compressed: 'comprimido',
  split: 'dividido em partes',
  kept: 'mantido como estava (ja cabia)',
}

export function planZip(input: ZipPlanInput): ZipPlan {
  const planned = planDocs(input.docs)
  const total = planned.reduce((a, p) => a + p.total, 0)
  const root = `PDFs_preparados_${input.tribunal ? `${slug(input.tribunal.sigla)}_` : ''}${isoDate(input.when)}`
  const needsPetitions = input.petitionBytes !== undefined && total > input.petitionBytes
  const petitions = needsPetitions ? groupIntoPetitions(planned, input.petitionBytes!) : [planned.flatMap((p) => p.files)]
  const pw = Math.max(2, String(petitions.length).length)
  const folderFor = (k: number) => (petitions.length > 1 ? `peticao_${pad(k + 1, pw)}/` : '')

  const entries: ZipEntry[] = []
  const lines: string[] = []
  const L = (s = '') => lines.push(s)

  L(`PDFs preparados em ${isoDate(input.when).split('-').reverse().join('/')} as ${hourMinute(input.when)}${input.siteUrl ? ` com ${input.siteUrl}` : ''}`)
  L('='.repeat(72))
  if (input.tribunal) L(`Tribunal/sistema: ${input.tribunal.sigla} - ${input.tribunal.sistema} (limite declarado: ${input.tribunal.limite} por arquivo)`)
  else L(`Limite informado: ${formatBytes(input.limitBytes)} por arquivo`)
  L(`Meta usada (com margem de seguranca): ate ${formatBytes(input.targetBytes)} por arquivo`)
  if (input.petitionBytes !== undefined) L(`Soma dos arquivos por peticao: ate ${formatBytes(input.petitionBytes)} (ja com a margem)`)
  L()
  L('Como usar:')
  L('- Os arquivos estao numerados na ordem em que voce os adicionou (01_, 02_, ...). Anexe nessa ordem.')
  L('- Documento dividido em partes fica em uma pasta propria; envie todas as partes, em sequencia, como documentos separados.')
  if (petitions.length > 1) {
    L(`- Este sistema limita a soma dos anexos de uma peticao: os arquivos foram separados em ${petitions.length} pastas (peticao_01, peticao_02, ...). Protocole uma peticao por pasta, na ordem.`)
  }
  L('- Nomes sem acento, espaco ou caracteres especiais, para nenhum sistema recusar. O conteudo dos documentos nao mudou de ordem.')
  L('- Abra e confira cada PDF antes de protocolar. Esta ferramenta nao e oficial nem vinculada a tribunal algum.')
  L()

  const describe = (p: PlannedDoc): string => {
    const parts: string[] = []
    if (p.doc.status === 'kept') parts.push(STATUS_TEXT.kept)
    else {
      if (p.doc.status === 'split') parts.push(`${STATUS_TEXT.split} (${p.files.length})`)
      else parts.push(STATUS_TEXT.compressed)
      parts.push(`de ${formatBytes(p.doc.originalSize)} para ${formatBytes(p.total)}`)
      if (p.doc.detail) parts.push(p.doc.detail)
    }
    return parts.join(', ')
  }

  petitions.forEach((files, k) => {
    const folder = folderFor(k)
    const sum = files.reduce((a, f) => a + f.file.size, 0)
    if (petitions.length > 1) {
      L(`Pasta ${folder}  (${files.length} arquivo${files.length === 1 ? '' : 's'}, ${formatBytes(sum)} no total${input.petitionBytes !== undefined && sum > input.petitionBytes ? ' - ATENCAO: acima da soma permitida por peticao' : ''})`)
    } else {
      L(`Conteudo (${files.length} arquivo${files.length === 1 ? '' : 's'}, ${formatBytes(sum)} no total):`)
    }
    const seenDoc = new Set<PlannedDoc>()
    for (const f of files) {
      const owner = planned.find((p) => p.files.includes(f))!
      if (!seenDoc.has(owner)) {
        seenDoc.add(owner)
        L(`  ${owner.files.length > 1 ? owner.base + '/' : owner.files[0].rel}  -  ${describe(owner)}`)
        for (const w of owner.doc.warnings ?? []) L(`      aviso: ${w}`)
      }
      if (owner.files.length > 1) {
        const range = f.file.pageRange ? (f.file.pageRange[0] === f.file.pageRange[1] ? `pagina ${f.file.pageRange[0]}` : `paginas ${f.file.pageRange[0]}-${f.file.pageRange[1]}`) : ''
        L(`      ${f.rel.slice(owner.base.length + 1)}  -  ${formatBytes(f.file.size)}${range ? `, ${range}` : ''}`)
      }
      entries.push({ path: `${root}/${folder}${f.rel}`, bytes: f.file.bytes })
    }
    L()
  })

  if (input.excluded && input.excluded.length) {
    L('Fora deste ZIP (resolva antes de protocolar):')
    for (const e of input.excluded) L(`  ${e.name}  -  ${e.reason}`)
    L()
  }
  L(`Total no pacote: ${entries.length} PDF${entries.length === 1 ? '' : 's'}, ${formatBytes(total)}.`)

  const readme = lines.join(CRLF) + CRLF
  entries.unshift({ path: `${root}/LEIA-ME.txt`, bytes: new TextEncoder().encode(readme) })
  return { zipName: `${root}.zip`, root, entries, petitions: petitions.length, fileCount: entries.length - 1, readme }
}
