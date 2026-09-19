// Servidor estático mínimo para dist/ (testes e2e e conferência local), sem dependências.
// Uso: node scripts/serve-dist.mjs [porta] [--http]
//
// HTTPS por padrão, com certificado autoassinado gerado na hora (openssl) e guardado em .cache/.
// Não é capricho: a CSP do site tem `upgrade-insecure-requests`, e o WebKit — motor de todo
// navegador no iOS — aplica isso até em localhost, trocando http://localhost/_astro/… por https://
// e falhando no handshake contra um servidor HTTP. Chromium e Firefox isentam localhost, e por
// isso a suíte passou meses sem revelar que nunca tinha rodado de verdade no Safari. Servir em
// HTTPS resolve isso e ainda deixa o ambiente de teste igual ao de produção (contexto seguro,
// HSTS, mesmas regras de mixed content). `--http` mantém o modo antigo para conferência manual.
import { createServer as createHttp } from 'node:http'
import { createServer as createHttps } from 'node:https'
import { readFileSync, statSync, existsSync, mkdirSync } from 'node:fs'
import { join, extname, normalize } from 'node:path'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const args = process.argv.slice(2)
const port = Number(args.find((a) => /^\d+$/.test(a)) ?? process.env.PORT ?? 4329)
const semTls = args.includes('--http')

/** Par chave/certificado para localhost, gerado uma vez e reaproveitado (30 dias). */
function certificadoLocal() {
  const dir = join(root, '..', '.cache', 'certificado-local')
  const key = join(dir, 'key.pem')
  const cert = join(dir, 'cert.pem')
  const valido = () => {
    if (!existsSync(key) || !existsSync(cert)) return false
    try {
      execFileSync('openssl', ['x509', '-checkend', '86400', '-noout', '-in', cert], { stdio: 'ignore' })
      return true
    } catch {
      return false
    }
  }
  if (!valido()) {
    mkdirSync(dir, { recursive: true })
    try {
      execFileSync(
        'openssl',
        ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-days', '30', '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1'],
        { stdio: 'ignore' },
      )
    } catch (e) {
      console.error(`[serve-dist] não deu para gerar o certificado local com openssl (${e.message}). Instale o openssl ou rode com --http.`)
      process.exit(1)
    }
  }
  return { key: readFileSync(key), cert: readFileSync(cert) }
}
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.wasm': 'application/wasm', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml', '.pdf': 'application/pdf', '.webmanifest': 'application/manifest+json',
}
// Reaproveita os blocos de public/_headers (padrão Cloudflare/Netlify) para o e2e rodar com os cabeçalhos reais.
const headersFile = join(root, '_headers')
const blocks = [] // [{ test: (path) => boolean, headers: [[k, v]] }]
if (existsSync(headersFile)) {
  let current = null
  for (const line of readFileSync(headersFile, 'utf8').split('\n')) {
    if (/^\s*#/.test(line) || !line.trim()) continue
    if (/^\S/.test(line)) {
      const pattern = line.trim()
      const re = new RegExp('^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$')
      current = { test: (p) => re.test(p), headers: [] }
      blocks.push(current)
    } else if (current && line.includes(':')) {
      const i = line.indexOf(':')
      current.headers.push([line.slice(0, i).trim(), line.slice(i + 1).trim()])
    }
  }
}
const headersFor = (path) => blocks.filter((b) => b.test(path)).flatMap((b) => b.headers)

const atende = (req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  path = normalize(path).replace(/^(\.\.[/\\])+/, '')
  let file = join(root, path)
  try {
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html')
    if (!existsSync(file)) {
      file = join(root, '404.html')
      res.statusCode = 404
    }
    const body = readFileSync(file)
    for (const [k, v] of headersFor(path)) res.setHeader(k, v)
    res.setHeader('Content-Type', MIME[extname(file).toLowerCase()] ?? 'application/octet-stream')
    res.end(body)
  } catch {
    res.statusCode = 500
    res.end('erro')
  }
}
const servidor = semTls ? createHttp(atende) : createHttps(certificadoLocal(), atende)
servidor.listen(port, () => console.log(`[serve-dist] ${semTls ? 'http' : 'https'}://localhost:${port}/ (${root})`))
