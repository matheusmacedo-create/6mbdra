// Monitor semanal das fontes das regras (spec §9.1).
// Para cada fonte_url: baixa a página, normaliza o texto visível e confere se o trecho
// citado (fonte_trecho) ainda aparece; guarda um hash de uma janela de texto em volta do
// trecho (ou do texto todo, quando não há trecho; ou do binário, para PDFs) em
// src/data/fontes.lock.json. Diferenças e fontes fora do ar por duas rodadas seguidas viram
// uma lista para revisão humana (JSON na saída + código de saída 2). Nunca altera regras.json.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const rulesPath = join(root, 'src', 'data', 'regras.json')
const lockPath = join(root, 'src', 'data', 'fontes.lock.json')
const update = process.argv.includes('--update')
const TODAY = new Date().toISOString().slice(0, 10)
const FAILURES_BEFORE_REPORT = 2
const WINDOW = 1500

const rules = JSON.parse(readFileSync(rulesPath, 'utf8')).regras
const lock = existsSync(lockPath) ? JSON.parse(readFileSync(lockPath, 'utf8')) : {}

const sha = (s) => createHash('sha256').update(s).digest('hex')

/** Minúsculas, sem acentos, só letras/dígitos e espaços simples: tolera reformatação da página. */
function normalize(s) {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
}

async function fetchSource(url) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 30_000)
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) monitor-de-regras/1.0 (+https://github.com/)', accept: 'text/html,application/pdf,*/*' },
    })
    if (!res.ok) return { ok: false, detail: `HTTP ${res.status}` }
    const type = res.headers.get('content-type') ?? ''
    const buf = Buffer.from(await res.arrayBuffer())
    if (/pdf/i.test(type) || buf.subarray(0, 5).toString() === '%PDF-') {
      return { ok: true, kind: 'pdf', text: '', hash: sha(buf) }
    }
    return { ok: true, kind: 'html', text: normalize(visibleText(buf.toString('utf8'))) }
  } catch (e) {
    return { ok: false, detail: e?.name === 'AbortError' ? 'timeout' : String(e?.message ?? e) }
  } finally {
    clearTimeout(t)
  }
}

const urls = [...new Set(rules.map((r) => r.fonte_url))]
const findings = []
const newLock = { ...lock }

for (const url of urls) {
  const affected = rules.filter((x) => x.fonte_url === url)
  const ids = affected.map((x) => x.id)
  const prev = lock[url] ?? {}
  const r = await fetchSource(url)

  if (!r.ok) {
    const falhas = (prev.falhas ?? 0) + 1
    newLock[url] = { ...prev, falhas, ultima_falha: `${TODAY} ${r.detail}` }
    if (falhas >= FAILURES_BEFORE_REPORT) findings.push({ url, tipo: 'inacessivel', detalhe: `${r.detail} (${falhas} rodadas seguidas)`, regras: ids })
    continue
  }

  let hash = r.hash
  const missing = []
  if (r.kind === 'html') {
    // Janela de texto em volta do primeiro trecho citado (ou texto inteiro).
    let anchor = -1
    for (const x of affected) {
      if (!x.fonte_trecho || x.trecho_em_imagem) continue
      const key = normalize(x.fonte_trecho).slice(0, 60)
      const i = key ? r.text.indexOf(key) : -1
      if (i < 0) missing.push(x.id)
      else if (anchor < 0) anchor = i
    }
    const slice = anchor >= 0 ? r.text.slice(Math.max(0, anchor - WINDOW), anchor + WINDOW) : r.text
    hash = sha(slice)
  }

  if (missing.length) findings.push({ url, tipo: 'trecho_nao_encontrado', detalhe: 'o trecho citado não aparece mais no texto visível', regras: missing })
  else if (prev.hash && prev.hash !== hash) findings.push({ url, tipo: 'mudou', detalhe: `conteúdo em volta do trecho mudou (${prev.hash.slice(0, 8)} → ${hash.slice(0, 8)})`, regras: ids })

  newLock[url] = { hash, verificado_em: TODAY, falhas: 0 }
}

if (update) {
  writeFileSync(lockPath, JSON.stringify(newLock, null, 2) + '\n')
  console.error(`[fontes] lock atualizado: ${Object.keys(newLock).length} fonte(s)`)
}
console.log(JSON.stringify({ data: TODAY, verificadas: urls.length, achados: findings }, null, 2))
if (findings.length && !update) process.exit(2)
