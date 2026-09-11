// Servidor estático mínimo para dist/ (testes e2e e conferência local), sem dependências.
// Uso: node scripts/serve-dist.mjs [porta]
import { createServer } from 'node:http'
import { readFileSync, statSync, existsSync } from 'node:fs'
import { join, extname, normalize } from 'node:path'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const port = Number(process.argv[2] ?? process.env.PORT ?? 4329)
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

createServer((req, res) => {
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
}).listen(port, () => console.log(`[serve-dist] http://localhost:${port}/ (${root})`))
