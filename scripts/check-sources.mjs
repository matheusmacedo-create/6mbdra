// Monitor semanal das fontes das regras (spec §9.1).
// Visita cada fonte_url, extrai o texto visível, calcula um hash e compara com
// src/data/fontes.lock.json. Mudanças ou fontes fora do ar viram uma lista para
// revisão humana (saída em JSON + código de saída 2). Nunca altera regras.json.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const rulesPath = join(root, 'src', 'data', 'regras.json')
const lockPath = join(root, 'src', 'data', 'fontes.lock.json')
const update = process.argv.includes('--update')

const rules = JSON.parse(readFileSync(rulesPath, 'utf8')).regras
const lock = existsSync(lockPath) ? JSON.parse(readFileSync(lockPath, 'utf8')) : {}

function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

async function fetchText(url) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 30_000)
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'user-agent': 'Mozilla/5.0 (compatible; monitor-de-regras/1.0; +https://github.com/)' }, redirect: 'follow' })
    if (!res.ok) return { ok: false, status: res.status }
    const type = res.headers.get('content-type') ?? ''
    if (/pdf/i.test(type)) {
      // Para PDFs (manuais), o hash é do binário.
      const buf = Buffer.from(await res.arrayBuffer())
      return { ok: true, text: `pdf:${buf.length}`, hash: createHash('sha256').update(buf).digest('hex') }
    }
    const text = visibleText(await res.text())
    return { ok: true, text, hash: createHash('sha256').update(text).digest('hex') }
  } catch (e) {
    return { ok: false, status: 0, error: e?.name === 'AbortError' ? 'timeout' : String(e?.message ?? e) }
  } finally {
    clearTimeout(t)
  }
}

const urls = [...new Set(rules.map((r) => r.fonte_url))]
const findings = []
const newLock = { ...lock }
for (const url of urls) {
  const r = await fetchText(url)
  const affected = rules.filter((x) => x.fonte_url === url).map((x) => x.id)
  if (!r.ok) {
    findings.push({ url, tipo: 'inacessivel', detalhe: r.error ?? `HTTP ${r.status}`, regras: affected })
    continue
  }
  const prev = lock[url]
  // Confere também se o trecho citado ainda aparece (quando a fonte é HTML).
  const missingQuote = rules.filter((x) => x.fonte_url === url && x.fonte_trecho && !r.text.startsWith('pdf:') && !r.text.toLowerCase().includes(x.fonte_trecho.toLowerCase().slice(0, 60)))
  if (prev && prev.hash !== r.hash) findings.push({ url, tipo: 'mudou', detalhe: `hash ${prev.hash.slice(0, 8)} -> ${r.hash.slice(0, 8)}`, regras: affected })
  if (missingQuote.length) findings.push({ url, tipo: 'trecho_nao_encontrado', detalhe: 'o trecho citado não aparece mais no texto visível', regras: missingQuote.map((x) => x.id) })
  newLock[url] = { hash: r.hash, verificado_em: new Date().toISOString().slice(0, 10) }
}

if (update) {
  writeFileSync(lockPath, JSON.stringify(newLock, null, 2) + '\n')
  console.log(`[fontes] lock atualizado com ${Object.keys(newLock).length} fonte(s)`) 
}
console.log(JSON.stringify({ verificadas: urls.length, achados: findings }, null, 2))
if (findings.length && !update) process.exit(2)
