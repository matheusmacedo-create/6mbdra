#!/usr/bin/env node
/*
 * Gera os ícones PNG de tela inicial a partir do desenho do favicon (public/favicon.svg).
 *
 * Por que PNG, se o favicon é SVG: o iOS ignora SVG no "Adicionar à Tela de Início" e, sem
 * apple-touch-icon, usa uma captura de tela da página como ícone. O Android lê os ícones do
 * manifest, que também precisam ser PNG. E por que gerar em vez de desenhar à mão: o desenho é o
 * mesmo do favicon, com a mesma fonte, e fica reproduzível — mudou a marca, roda de novo.
 *
 * Fundo cheio, sem cantos arredondados: o iOS aplica a máscara arredondada por conta própria, e um
 * PNG já arredondado ganharia um quadrado preto por trás. O "br" fica dentro da zona segura do
 * ícone mascarável do Android (80% centrais).
 *
 * Uso: node scripts/gera-icones.mjs   (precisa do Chromium do Playwright)
 */
import { chromium } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const fonte = readFileSync(join(raiz, 'node_modules/@fontsource/inter/files/inter-latin-800-normal.woff2')).toString('base64')

const TAMANHOS = [
  ['apple-touch-icon.png', 180],
  ['icon-192.png', 192],
  ['icon-512.png', 512],
]

const html = (lado) => `<!doctype html><html><head><style>
  @font-face { font-family: Inter; font-weight: 800; src: url(data:font/woff2;base64,${fonte}) format('woff2'); }
  html, body { margin: 0; background: #2e2e2e; }
  .icone { width: ${lado}px; height: ${lado}px; display: grid; place-items: center; background: #2e2e2e; }
  /* Mesma proporção do favicon.svg: fonte 30 em 64 de lado, espaçamento -1.5. */
  .icone span { font: 800 ${(lado * 30) / 64}px/1 Inter, sans-serif; color: #e6a822; letter-spacing: ${(-1.5 * lado) / 64}px; transform: translateY(${lado * 0.02}px); }
</style></head><body><div class="icone"><span>br</span></div></body></html>`

const navegador = await chromium.launch()
const pagina = await navegador.newPage({ deviceScaleFactor: 1 })
for (const [nome, lado] of TAMANHOS) {
  await pagina.setViewportSize({ width: lado, height: lado })
  await pagina.setContent(html(lado))
  await pagina.evaluate(() => document.fonts.ready)
  const png = await pagina.locator('.icone').screenshot({ type: 'png', omitBackground: false })
  writeFileSync(join(raiz, 'public', nome), png)
  console.log(`${nome}: ${lado}×${lado}, ${(png.length / 1024).toFixed(1)} KB`)
}
await navegador.close()
