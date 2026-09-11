// Valida src/data/regras.json durante o build (spec RF15 / §9).
// Falha o build se alguma regra estiver incompleta, com fonte não oficial ou datas inválidas.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const path = join(root, 'src', 'data', 'regras.json')
const data = JSON.parse(readFileSync(path, 'utf8'))

const errors = []
const isIsoDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s))
const OFFICIAL = /^https:\/\/([a-z0-9-]+\.)*(jus\.br|gov\.br)(\/|$)/i
const UNIDADES = new Set(['MB', 'MiB', 'KB'])
const SITUACOES = new Set(['vigente', 'em_revisao', 'substituida'])
const SISTEMAS = new Set(['PJe', 'eproc', 'e-SAJ', 'Projudi', 'e-STJ', 'STF', 'PJe-JT', 'Portal próprio', 'outro'])

if (!isIsoDate(data.versao)) errors.push(`versao inválida: ${data.versao}`)
if (!(data.meta_segura_percentual_padrao > 50 && data.meta_segura_percentual_padrao <= 100)) errors.push('meta_segura_percentual_padrao deve estar entre 50 e 100')
if (!Array.isArray(data.regras)) errors.push('regras deve ser uma lista')

const ids = new Set()
for (const [i, r] of (data.regras ?? []).entries()) {
  const where = `regras[${i}] (${r.id ?? 'sem id'})`
  const req = ['id', 'tribunal_sigla', 'tribunal_nome', 'sistema', 'instancia', 'tipo_peticionamento', 'formato', 'limite_valor', 'limite_unidade', 'fonte_url', 'fonte_titulo', 'verificado_em', 'situacao']
  for (const k of req) if (r[k] === undefined || r[k] === null || r[k] === '') errors.push(`${where}: campo obrigatório ausente: ${k}`)
  if (r.id && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(r.id)) errors.push(`${where}: id deve ser um slug (a-z, 0-9, hífens)`)
  if (ids.has(r.id)) errors.push(`${where}: id duplicado`)
  ids.add(r.id)
  if (r.formato !== 'PDF') errors.push(`${where}: formato deve ser PDF na V1`)
  if (!(typeof r.limite_valor === 'number' && r.limite_valor > 0 && r.limite_valor < 10000)) errors.push(`${where}: limite_valor inválido`)
  if (!UNIDADES.has(r.limite_unidade)) errors.push(`${where}: limite_unidade deve ser MB, MiB ou KB`)
  if (r.meta_segura_percentual !== undefined && !(r.meta_segura_percentual > 50 && r.meta_segura_percentual <= 100)) errors.push(`${where}: meta_segura_percentual fora da faixa`)
  if (!OFFICIAL.test(r.fonte_url ?? '')) errors.push(`${where}: fonte_url deve ser https em domínio oficial (jus.br ou gov.br): ${r.fonte_url}`)
  if (r.data_fonte && !isIsoDate(r.data_fonte)) errors.push(`${where}: data_fonte deve ser AAAA-MM-DD`)
  if (!isIsoDate(r.verificado_em ?? '')) errors.push(`${where}: verificado_em deve ser AAAA-MM-DD`)
  if (!SITUACOES.has(r.situacao)) errors.push(`${where}: situacao inválida`)
  if (!SISTEMAS.has(r.sistema)) errors.push(`${where}: sistema deve ser um de ${[...SISTEMAS].join(', ')}`)
  if (r.fonte_trecho && r.fonte_trecho.length > 600) errors.push(`${where}: fonte_trecho longo demais (máx. 600)`)
  if (r.trecho_em_imagem !== undefined && typeof r.trecho_em_imagem !== 'boolean') errors.push(`${where}: trecho_em_imagem deve ser booleano`)
  if (r.monitor_so_trecho !== undefined && typeof r.monitor_so_trecho !== 'boolean') errors.push(`${where}: monitor_so_trecho deve ser booleano`)
}

if (errors.length) {
  console.error(`[regras] ${errors.length} problema(s) em ${path}:`)
  for (const e of errors) console.error('  - ' + e)
  process.exit(1)
}
console.log(`[regras] OK: ${data.regras.length} regra(s), versão ${data.versao}`)
