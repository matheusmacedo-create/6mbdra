import { describe, expect, it } from 'vitest'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

/**
 * Link interno quebrado é caro duas vezes: manda a pessoa para um 404 e faz o buscador gastar
 * rastreamento com página que não existe. Como o site tem mais de cem páginas e muita ligação
 * cruzada entre guias, tribunais e sistemas, conferir na mão não escala.
 *
 * Roda sobre dist/, então exige build antes. Sem dist, o teste falha dizendo isso — em vez de
 * passar silenciosamente e dar falsa segurança.
 */
const DIST = join(process.cwd(), 'dist')

function arquivosHtml(dir: string, acc: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome)
    if (statSync(caminho).isDirectory()) arquivosHtml(caminho, acc)
    else if (nome.endsWith('.html')) acc.push(caminho)
  }
  return acc
}

/** Existe no dist? Aceita /x/ (pasta com index.html) e /x.txt (arquivo). */
function destinoExiste(caminho: string): boolean {
  const limpo = caminho.split('#')[0].split('?')[0]
  if (limpo === '/') return existsSync(join(DIST, 'index.html'))
  const semBarras = limpo.replace(/^\/|\/$/g, '')
  return existsSync(join(DIST, semBarras, 'index.html')) || existsSync(join(DIST, semBarras)) || existsSync(join(DIST, `${semBarras}.html`))
}

describe('links internos', () => {
  it('dist/ existe (rode npm run build antes)', () => {
    expect(existsSync(DIST), 'dist/ não existe — este teste confere o site construído').toBe(true)
  })

  it('nenhum link interno aponta para página inexistente', () => {
    const paginas = arquivosHtml(DIST)
    expect(paginas.length).toBeGreaterThan(100)
    const quebrados: string[] = []
    for (const pagina of paginas) {
      const html = readFileSync(pagina, 'utf8')
      for (const m of html.matchAll(/href="(\/[^"]*)"/g)) {
        const destino = m[1]
        // Recursos com extensão própria (css, js, svg, xml) e âncoras puras ficam de fora.
        if (destino.startsWith('//') || destino.startsWith('/_astro/')) continue
        if (/\.(css|js|svg|png|jpe?g|woff2?|wasm|ico)$/.test(destino)) continue
        if (!destinoExiste(destino)) quebrados.push(`${relative(DIST, pagina)} -> ${destino}`)
      }
    }
    expect([...new Set(quebrados)].sort(), 'links internos quebrados').toEqual([])
  })

  it('todo guia é alcançável a partir do índice de guias', () => {
    const indice = readFileSync(join(DIST, 'guias', 'index.html'), 'utf8')
    const guias = readdirSync(join(DIST, 'guias'), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
    expect(guias.length).toBeGreaterThan(10)
    for (const slug of guias) {
      expect(indice, `guia sem link no índice: ${slug}`).toContain(`/guias/${slug}/`)
    }
  })

  it('toda página de tribunal e de sistema está no sitemap', () => {
    const sitemap = readFileSync(join(DIST, 'sitemap-0.xml'), 'utf8')
    for (const pasta of ['tribunais', 'sistemas']) {
      for (const e of readdirSync(join(DIST, pasta), { withFileTypes: true })) {
        if (!e.isDirectory()) continue
        expect(sitemap, `fora do sitemap: /${pasta}/${e.name}/`).toContain(`/${pasta}/${e.name}/`)
      }
    }
  })
})
