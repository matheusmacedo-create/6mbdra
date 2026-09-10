// Copia o Ghostscript WASM (gs.js + gs.wasm) de node_modules para public/gs,
// de onde o worker o carrega em tempo de execução. Roda antes de `dev` e `build`.
import { copyFileSync, mkdirSync, existsSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'node_modules', '@jspawn', 'ghostscript-wasm')
const dst = join(root, 'public', 'gs')

if (!existsSync(src)) {
  console.error('[copy-gs] @jspawn/ghostscript-wasm não encontrado. Rode `npm install`.')
  process.exit(1)
}
mkdirSync(dst, { recursive: true })
for (const f of ['gs.js', 'gs.wasm', 'LICENSE']) {
  const from = join(src, f)
  const to = join(dst, f)
  if (!existsSync(to) || statSync(to).size !== statSync(from).size) {
    copyFileSync(from, to)
    console.log(`[copy-gs] ${f} -> public/gs/${f}`)
  }
}
