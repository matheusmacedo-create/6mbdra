// Monitor semanal das fontes das regras (spec §9.1).
// Para cada fonte_url: baixa a página, normaliza o texto visível e confere se o trecho
// citado (fonte_trecho) ainda aparece; guarda um hash de uma janela de texto em volta do
// trecho (ou do texto todo, quando não há trecho; ou do binário, para PDFs) em
// src/data/fontes.lock.json. Diferenças e fontes fora do ar por duas rodadas seguidas viram
// uma lista para revisão humana (JSON na saída + código de saída 2). Nunca altera regras.json.
//
// Uso: node scripts/check-sources.mjs [--update] [--out resultado.json]
//   --update  grava o lock (hashes e contadores de falha) — o workflow semanal usa e comita.
// No Node, defina NODE_USE_ENV_PROXY=1 se a rede exigir proxy (HTTPS_PROXY).
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const rulesPath = join(root, 'src', 'data', 'regras.json')
const lockPath = join(root, 'src', 'data', 'fontes.lock.json')
const args = process.argv.slice(2)
const update = args.includes('--update')
const outIdx = args.indexOf('--out')
const outPath = outIdx >= 0 ? args[outIdx + 1] : null
const TODAY = new Date().toISOString().slice(0, 10)
const FAILURES_BEFORE_REPORT = 2
const WINDOW = 200
const CONCURRENCY = 5
const TIMEOUT_MS = 20_000

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

const ENTITIES = {
  nbsp: ' ', amp: '&', quot: '"', apos: "'", lt: '<', gt: '>',
  aacute: 'á', agrave: 'à', atilde: 'ã', acirc: 'â', auml: 'ä', eacute: 'é', egrave: 'è', ecirc: 'ê', euml: 'ë',
  iacute: 'í', igrave: 'ì', icirc: 'î', iuml: 'ï', oacute: 'ó', ograve: 'ò', otilde: 'õ', ocirc: 'ô', ouml: 'ö',
  uacute: 'ú', ugrave: 'ù', ucirc: 'û', uuml: 'ü', ccedil: 'ç', ntilde: 'ñ', ordm: 'º', ordf: 'ª', deg: '°',
  ndash: '–', mdash: '—', hellip: '…', laquo: '«', raquo: '»', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’',
}

/** Decodifica entidades HTML numéricas e as nomeadas mais comuns em português (portais antigos usam &ccedil; etc.). */
function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, name) => {
      const k = name.toLowerCase()
      const v = ENTITIES[k]
      if (v === undefined) return m
      return name[0] === name[0].toUpperCase() && k !== name ? v.toUpperCase() : v
    })
}

function visibleText(html) {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
}

/** Decodifica respeitando o charset (muitos portais antigos ainda usam ISO-8859-1). */
function decodeHtml(buf, contentType) {
  const head = buf.subarray(0, 4096).toString('latin1')
  const m = /charset=["']?([\w-]+)/i.exec(contentType) ?? /charset=["']?([\w-]+)/i.exec(head)
  const charset = (m?.[1] ?? 'utf-8').toLowerCase()
  try {
    return new TextDecoder(charset === 'iso-8859-1' ? 'windows-1252' : charset).decode(buf)
  } catch {
    return buf.toString('utf8')
  }
}

async function fetchSource(url) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
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
    return { ok: true, kind: 'html', text: normalize(visibleText(decodeHtml(buf, type))) }
  } catch (e) {
    const code = e?.cause?.code ?? e?.code
    if (e?.name === 'AbortError') return { ok: false, detail: 'timeout' }
    if (/UNABLE_TO_VERIFY_LEAF_SIGNATURE|CERT_|SELF_SIGNED|ERR_TLS/.test(String(code))) {
      return { ok: false, detail: `TLS: ${code} (cadeia de certificados incompleta ou inválida no servidor; conferir no navegador)` }
    }
    return { ok: false, detail: String(e?.message ?? e) }
  } finally {
    clearTimeout(t)
  }
}

/** Executa `fn` sobre os itens com no máximo `limit` em paralelo, preservando a ordem. */
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length)
  let next = 0
  const worker = async () => {
    for (;;) {
      const i = next++
      if (i >= items.length) return
      out[i] = await fn(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
}

const urls = [...new Set(rules.map((r) => r.fonte_url))]
const results = await mapLimit(urls, CONCURRENCY, (url) => fetchSource(url))

const findings = []
const newLock = { ...lock }

urls.forEach((url, idx) => {
  const r = results[idx]
  const affected = rules.filter((x) => x.fonte_url === url)
  const ids = affected.map((x) => x.id)
  const prev = lock[url] ?? {}

  if (!r.ok) {
    const falhas = (prev.falhas ?? 0) + 1
    newLock[url] = { ...prev, falhas, ultima_falha: `${TODAY} ${r.detail}` }
    if (falhas >= FAILURES_BEFORE_REPORT) findings.push({ url, tipo: 'inacessivel', detalhe: `${r.detail} (${falhas} rodadas seguidas)`, regras: ids })
    return
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

  // Páginas com conteúdo dinâmico (formulários, tokens) só são vigiadas pela presença do trecho.
  const soTrecho = affected.some((x) => x.monitor_so_trecho)
  if (missing.length) findings.push({ url, tipo: 'trecho_nao_encontrado', detalhe: 'o trecho citado não aparece mais no texto visível', regras: missing })
  else if (!soTrecho && prev.hash && prev.hash !== hash) findings.push({ url, tipo: 'mudou', detalhe: `conteúdo em volta do trecho mudou (${prev.hash.slice(0, 8)} → ${hash.slice(0, 8)})`, regras: ids })

  newLock[url] = { hash, verificado_em: TODAY, falhas: 0 }
})

// Assinatura estável dos achados (sem contadores), para o workflow não repetir o mesmo comentário toda semana.
const assinatura = sha(JSON.stringify(findings.map((f) => [f.tipo, f.url, [...f.regras].sort()]).sort()))
const report = { data: TODAY, verificadas: urls.length, achados: findings, assinatura: findings.length ? assinatura.slice(0, 16) : 'ok' }

if (update) {
  writeFileSync(lockPath, JSON.stringify(newLock, null, 2) + '\n')
  console.error(`[fontes] lock atualizado: ${Object.keys(newLock).length} fonte(s)`)
}
const json = JSON.stringify(report, null, 2)
if (outPath) writeFileSync(outPath, json + '\n')
console.log(json)
if (findings.length) process.exit(2)
