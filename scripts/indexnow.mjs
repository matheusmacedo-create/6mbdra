#!/usr/bin/env node
/*
 * IndexNow: avisa os buscadores que aderem ao protocolo (Bing, Yandex, Naver, Seznam, Yep) de
 * que URLs mudaram, no instante do deploy — em vez de esperar o rastreador voltar por conta
 * própria. O Google não participa; para ele o caminho continua sendo sitemap + Search Console.
 *
 * Três comandos (npm run indexnow -- <comando>):
 *
 *   plan     ANTES do deploy: compara o dist/ recém-construído com o site no ar e grava em
 *            .cache/indexnow.json as URLs novas, alteradas e removidas. Nunca derruba o deploy:
 *            sem rede, marca tudo como "desconhecida" e o submit envia tudo.
 *   submit   DEPOIS do deploy: confere que o arquivo da chave está no ar e envia a lista gravada.
 *   all      envia todas as URLs do sitemap (primeira vez, ou reindexação completa).
 *   --dry-run em submit/all: mostra o que enviaria, sem enviar.
 *
 * "Mudou" é definido pelo TEXTO da página, não pelo HTML. Cada build troca o hash dos arquivos em
 * /_astro/, então o HTML de todas as páginas muda em todo deploy; o buscador não se importa com
 * isso. Importa-se com título, descrição e o conteúdo do <main> — é isso que se compara. Enviar
 * URL que não mudou não é proibido, mas o Bing avisa que quem faz isso com frequência perde
 * prioridade, e a única forma de não fazer é medir.
 *
 * A chave não é segredo: o protocolo exige que ela seja publicada em /<chave>.txt, e ela só
 * autoriza URLs deste host — o pior que alguém faz com ela é pedir ao Bing que rastreie o nosso
 * próprio site. Por isso fica versionada em src/config/site.mjs; para trocar, basta gerar outra.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { SITE } from '../src/config/site.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const ENDPOINT = 'https://api.indexnow.org/indexnow'
const AGENTE = `brpdf-indexnow/1 (+${SITE.url})`
/** O que cada resposta do IndexNow significa (documentação do protocolo). */
const SIGNIFICADO = {
  400: 'formato inválido',
  403: 'chave inválida — o arquivo /<chave>.txt no ar não bate com a chave enviada',
  422: 'URL fora do host, ou keyLocation em outro host',
  429: 'muitas requisições — espere antes de tentar de novo',
}

/** URLs de todos os sitemaps listados no índice, lidas do dist/. */
export function urlsDoSitemap(dist) {
  const locs = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim())
  const indice = readFileSync(join(dist, 'sitemap-index.xml'), 'utf8')
  return locs(indice).flatMap((loc) => locs(readFileSync(join(dist, new URL(loc).pathname), 'utf8')))
}

/** Onde a página de uma URL está no dist/. */
export function caminhoLocal(url, dist) {
  const { pathname } = new URL(url)
  return join(dist, pathname.endsWith('/') ? `${pathname}index.html` : pathname)
}

/** Resumo do que o buscador vê: título, descrição e o texto do <main>, sem tags nem scripts. */
export function impressaoDigital(html) {
  const titulo = /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? ''
  const descricao = /<meta name="description" content="([^"]*)"/.exec(html)?.[1] ?? ''
  const bloco = /<main[\s\S]*?<\/main>/.exec(html)?.[0] ?? /<body[\s\S]*?<\/body>/.exec(html)?.[0] ?? html
  const texto = bloco
    .replace(/<(script|style)[\s\S]*?<\/\1>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return createHash('sha256').update(`${titulo}\n${descricao}\n${texto}`).digest('hex')
}

/** Previews (Pages, workers.dev, local) não são o site: enviar as URLs deles seria lixo no índice. */
export function ehPreview(siteUrl) {
  const host = new URL(siteUrl).hostname
  return host === 'localhost' || host.startsWith('127.') || host.endsWith('.pages.dev') || host.endsWith('.workers.dev')
}

async function emParalelo(itens, n, fn) {
  const fila = [...itens]
  await Promise.all(Array.from({ length: Math.min(n, fila.length) }, async () => {
    while (fila.length) await fn(fila.shift())
  }))
}

/**
 * Compara o build com o site no ar. Devolve as URLs a enviar e o motivo de cada uma:
 * nova (404 no ar), mudou (texto diferente), removida (estava no sitemap do ar e saiu),
 * desconhecida (não deu para comparar — vai junto, por segurança). "igual" fica de fora.
 */
export async function planejar({ dist, siteUrl, fetch: f = globalThis.fetch, concorrencia = 12, log = () => {} }) {
  const novas = urlsDoSitemap(dist)
  /** @type {Record<string, 'nova' | 'mudou' | 'igual' | 'removida' | 'desconhecida'>} */
  const motivos = {}
  const cabecalhos = { 'user-agent': AGENTE, accept: 'text/html' }

  let noAr = null
  try {
    const r = await f(new URL('/sitemap-index.xml', siteUrl).href, { headers: cabecalhos, signal: AbortSignal.timeout(15000) })
    if (r.ok) {
      const locs = [...(await r.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim())
      noAr = []
      for (const loc of locs) {
        const s = await f(loc, { headers: cabecalhos, signal: AbortSignal.timeout(15000) })
        if (s.ok) noAr.push(...[...(await s.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim()))
      }
    }
  } catch (e) {
    log(`sitemap no ar indisponível (${e.message}); removidas não serão detectadas`)
  }

  await emParalelo(novas, concorrencia, async (url) => {
    const minha = impressaoDigital(readFileSync(caminhoLocal(url, dist), 'utf8'))
    try {
      const r = await f(url, { headers: cabecalhos, signal: AbortSignal.timeout(15000) })
      if (r.status === 404) motivos[url] = 'nova'
      else if (!r.ok) motivos[url] = 'desconhecida'
      else motivos[url] = impressaoDigital(await r.text()) === minha ? 'igual' : 'mudou'
    } catch {
      motivos[url] = 'desconhecida'
    }
  })
  if (noAr) for (const url of noAr) if (!novas.includes(url)) motivos[url] = 'removida'

  /** @type {Record<string, number>} */
  const resumo = {}
  for (const m of Object.values(motivos)) resumo[m] = (resumo[m] ?? 0) + 1
  const urls = Object.entries(motivos)
    .filter(([, m]) => m !== 'igual')
    .map(([u]) => u)
    .sort()
  return { urls, motivos, resumo }
}

/** O buscador só aceita a chave se /<chave>.txt estiver no ar; logo depois do deploy pode levar segundos. */
export async function conferirChaveNoAr({ chave, siteUrl, fetch: f = globalThis.fetch, tentativas = 6, espera = 5000 }) {
  const local = new URL(`/${chave}.txt`, siteUrl).href
  let ultimo = ''
  for (let i = 0; i < tentativas; i++) {
    try {
      const r = await f(local, { headers: { 'user-agent': AGENTE }, signal: AbortSignal.timeout(15000), cache: 'no-store' })
      ultimo = r.ok ? (await r.text()).trim() : `HTTP ${r.status}`
      if (ultimo === chave) return local
    } catch (e) {
      ultimo = e.message
    }
    if (i < tentativas - 1) await new Promise((res) => setTimeout(res, espera))
  }
  throw new Error(`o arquivo da chave não está no ar em ${local} (última leitura: ${ultimo})`)
}

/** Envia as URLs ao IndexNow, em lotes de até 10.000 (o máximo por requisição). */
export async function enviar({ urls, chave, siteUrl, fetch: f = globalThis.fetch }) {
  const host = new URL(siteUrl).host
  const keyLocation = new URL(`/${chave}.txt`, siteUrl).href
  let enviadas = 0
  let status = 0
  for (let i = 0; i < urls.length; i += 10000) {
    const lote = urls.slice(i, i + 10000)
    const r = await f(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8', 'user-agent': AGENTE },
      body: JSON.stringify({ host, key: chave, keyLocation, urlList: lote }),
      signal: AbortSignal.timeout(30000),
    })
    if (r.status !== 200 && r.status !== 202) {
      throw new Error(`IndexNow respondeu ${r.status}: ${SIGNIFICADO[r.status] ?? (await r.text()).slice(0, 200)}`)
    }
    // 200 = aceito com a chave já validada; 202 = recebido, o buscador ainda vai buscar /<chave>.txt.
    status = r.status
    enviadas += lote.length
  }
  return { enviadas, status }
}

async function main() {
  const comando = process.argv[2]
  const dryRun = process.argv.includes('--dry-run')
  const dist = join(root, 'dist')
  const plano = join(root, '.cache', 'indexnow.json')
  const chave = SITE.indexNow.chave

  if (comando === 'plan') {
    let resultado
    try {
      resultado = await planejar({ dist, siteUrl: SITE.url, log: (m) => console.warn(`indexnow: ${m}`) })
    } catch (e) {
      // Plano nunca derruba o deploy: na dúvida, envia tudo.
      console.warn(`indexnow: não deu para comparar com o site no ar (${e.message}); enviará todas as URLs`)
      const urls = urlsDoSitemap(dist)
      resultado = { urls, resumo: { desconhecida: urls.length } }
    }
    mkdirSync(dirname(plano), { recursive: true })
    writeFileSync(plano, JSON.stringify({ geradoEm: new Date().toISOString(), site: SITE.url, urls: resultado.urls, resumo: resultado.resumo }, null, 2))
    const r = resultado.resumo
    console.log(`indexnow: ${resultado.urls.length} URL(s) a enviar — novas ${r.nova ?? 0}, alteradas ${r.mudou ?? 0}, removidas ${r.removida ?? 0}, sem comparação ${r.desconhecida ?? 0}, iguais ${r.igual ?? 0}`)
    return
  }

  if (comando === 'submit' || comando === 'all') {
    let urls
    if (comando === 'all') {
      urls = urlsDoSitemap(dist)
    } else {
      if (!existsSync(plano)) {
        console.log('indexnow: sem plano gravado (rode "plan" antes do deploy); nada enviado')
        return
      }
      urls = JSON.parse(readFileSync(plano, 'utf8')).urls
    }
    if (urls.length === 0) {
      console.log('indexnow: nenhuma URL mudou; nada a enviar')
      rmSync(plano, { force: true })
      return
    }
    if (ehPreview(SITE.url)) {
      console.log(`indexnow: ${SITE.url} é um preview; nada enviado`)
      return
    }
    if (dryRun) {
      console.log(`indexnow (dry-run): enviaria ${urls.length} URL(s) para ${ENDPOINT}:\n  ${urls.join('\n  ')}`)
      return
    }
    try {
      await conferirChaveNoAr({ chave, siteUrl: SITE.url })
      const { enviadas, status } = await enviar({ urls, chave, siteUrl: SITE.url })
      console.log(`indexnow: ${enviadas} URL(s) enviada(s) a ${ENDPOINT} (HTTP ${status}: ${status === 200 ? 'chave validada' : 'recebido; validação da chave pendente'})`)
      rmSync(plano, { force: true })
    } catch (e) {
      // O deploy já aconteceu e está bem; só o aviso ao buscador falhou. Sai com erro para ficar visível.
      console.error(`indexnow: FALHOU (o deploy em si não foi afetado): ${e.message}\n  para repetir: npm run indexnow -- ${comando}`)
      process.exit(1)
    }
    return
  }

  console.error('uso: node scripts/indexnow.mjs <plan|submit|all> [--dry-run]')
  process.exit(2)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
