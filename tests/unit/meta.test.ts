import { beforeAll, describe, expect, it } from 'vitest'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

/**
 * Auditoria de SEO sobre o site construído. Existe porque os problemas aqui são silenciosos:
 * título cortado, descrição repetida, canonical errado e página sem prévia de compartilhamento não
 * quebram nada visível — só custam posição e clique, e só se descobre meses depois.
 *
 * Roda sobre dist/, então exige build antes.
 */
const DIST = join(process.cwd(), 'dist')

interface Pagina {
  rota: string
  titulo: string
  descricao: string
  canonical: string
  h1: string[]
  noindex: boolean
  ogImagem: string
  twitter: boolean
  ld: string[]
}

function html(dir: string, acc: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome)
    if (statSync(caminho).isDirectory()) html(caminho, acc)
    else if (nome.endsWith('.html')) acc.push(caminho)
  }
  return acc
}

/** O <title> vem com entidades HTML; medir o texto como o buscador exibe, não como está na fonte. */
const decodificar = (t: string) =>
  t.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')

let paginas: Pagina[] = []
let indexaveis: Pagina[] = []

beforeAll(() => {
  if (!existsSync(DIST)) return
  paginas = html(DIST).map((caminho) => {
    const s = readFileSync(caminho, 'utf8')
    const pega = (re: RegExp) => decodificar((re.exec(s) ?? [])[1] ?? '')
    return {
      rota: '/' + relative(DIST, caminho).replace(/index\.html$/, '').replace(/\\/g, '/'),
      titulo: pega(/<title>([^<]*)<\/title>/),
      descricao: pega(/name="description" content="([^"]*)"/),
      canonical: pega(/rel="canonical" href="([^"]*)"/),
      h1: [...s.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)].map((m) => decodificar(m[1].replace(/<[^>]*>/g, '').trim())),
      noindex: /name="robots" content="[^"]*noindex/.test(s),
      ogImagem: pega(/property="og:image" content="([^"]*)"/),
      twitter: /name="twitter:card"/.test(s),
      ld: [...s.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]),
    }
  })
  indexaveis = paginas.filter((p) => p.noindex === false && p.rota !== '/404.html')
})

/** Rotas repetidas viram lista, para o erro dizer QUAIS páginas colidem. */
function duplicados(campo: (p: Pagina) => string): string[] {
  const mapa = new Map<string, string[]>()
  for (const p of indexaveis) mapa.set(campo(p), [...(mapa.get(campo(p)) ?? []), p.rota])
  return [...mapa.entries()].filter(([, rotas]) => rotas.length > 1).map(([v, rotas]) => `${v || '(vazio)'} :: ${rotas.join(', ')}`)
}

describe('metadados de todas as páginas', () => {
  it('dist/ existe (rode npm run build antes)', () => {
    expect(existsSync(DIST), 'dist/ não existe — esta auditoria roda sobre o site construído').toBe(true)
    expect(indexaveis.length).toBeGreaterThan(100)
  })

  it('nenhuma página indexável fica sem título, descrição ou canonical', () => {
    expect(indexaveis.filter((p) => !p.titulo).map((p) => p.rota)).toEqual([])
    expect(indexaveis.filter((p) => !p.descricao).map((p) => p.rota)).toEqual([])
    expect(indexaveis.filter((p) => !p.canonical).map((p) => p.rota)).toEqual([])
  })

  it('cada página tem exatamente um h1', () => {
    expect(indexaveis.filter((p) => p.h1.length !== 1).map((p) => `${p.rota} (${p.h1.length})`)).toEqual([])
  })

  it('título, descrição, h1 e canonical são únicos', () => {
    expect(duplicados((p) => p.titulo), 'títulos repetidos').toEqual([])
    expect(duplicados((p) => p.descricao), 'descrições repetidas').toEqual([])
    expect(duplicados((p) => p.h1[0] ?? ''), 'h1 repetidos').toEqual([])
    expect(duplicados((p) => p.canonical), 'canonical repetido').toEqual([])
  })

  it('canonical aponta para a própria rota', () => {
    const errados = indexaveis.filter((p) => !p.canonical.endsWith(p.rota)).map((p) => `${p.rota} -> ${p.canonical}`)
    expect(errados).toEqual([])
  })

  it('a descrição cabe no que o buscador exibe', () => {
    const longas = indexaveis.filter((p) => p.descricao.length > 175).map((p) => `${p.rota} (${p.descricao.length})`)
    expect(longas, 'descrições longas demais').toEqual([])
  })

  it('nas páginas de tribunal, a resposta sobrevive ao corte do título', () => {
    /*
     * O Google corta perto de 60 caracteres. Nessas páginas o que precisa aparecer é o VALOR do
     * limite — é o que faz clicar. Foi por isso que o contexto ("petição intermediária") foi para
     * o fim do título: antes ele empurrava o limite para depois do caractere 90.
     */
    const semResposta = paginas
      .filter((p) => p.rota.startsWith('/tribunais/') && p.rota !== '/tribunais/')
      .filter((p) => !/:\s*[\d.,]+\s*(MB|KB|GB|Mb|Kb)/i.test(p.titulo.slice(0, 60)))
      .map((p) => p.titulo)
    expect(semResposta, 'limite fora dos primeiros 60 caracteres do título').toEqual([])
  })

  it('toda página tem prévia de compartilhamento', () => {
    expect(indexaveis.filter((p) => !p.ogImagem).map((p) => p.rota), 'sem og:image').toEqual([])
    expect(indexaveis.filter((p) => !p.twitter).map((p) => p.rota), 'sem twitter:card').toEqual([])
    expect(existsSync(join(DIST, 'og.png')), 'public/og.png precisa existir').toBe(true)
  })

  it('todo JSON-LD é válido e as páginas que importam têm dados estruturados', () => {
    for (const p of indexaveis) {
      for (const bloco of p.ld) {
        expect(() => JSON.parse(bloco), `JSON-LD inválido em ${p.rota}`).not.toThrow()
      }
    }
    const semDados = indexaveis
      .filter((p) => /^\/(tribunais|sistemas|guias)\/.+/.test(p.rota) || /^\/(comprimir|dividir|juntar)-pdf\/$/.test(p.rota))
      .filter((p) => p.ld.length === 0)
      .map((p) => p.rota)
    expect(semDados, 'página de conteúdo sem dados estruturados').toEqual([])
  })

  it('o painel fica fora do índice e do sitemap', () => {
    const painel = paginas.find((p) => p.rota === '/painel/')
    expect(painel?.noindex, '/painel/ precisa ser noindex').toBe(true)
    expect(readFileSync(join(DIST, 'sitemap-0.xml'), 'utf8')).not.toContain('/painel/')
  })
})
