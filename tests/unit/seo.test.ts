import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { sistemas, faixaDeLimites } from '../../src/tool/lib/sistemas'
import { REGRAS, slugSistema } from '../../src/tool/lib/regras'

/**
 * As páginas de sistema existem para responder à busca por sistema ("limite do PJe"), que é como
 * quem peticiona pensa. Estes testes protegem o que não pode quebrar sem ninguém perceber: a
 * cobertura das regras, a ausência de página fina e a existência dos arquivos de página.
 */
describe('páginas de sistema', () => {
  const lista = sistemas()

  it('cobre os sistemas usados por mais de um tribunal', () => {
    const porSlug = new Map<string, Set<string>>()
    for (const r of REGRAS.regras) {
      if (r.situacao === 'substituida') continue
      const s = slugSistema(r)
      const set = porSlug.get(s) ?? new Set<string>()
      for (const sigla of [r.tribunal_sigla, ...(r.abrange ?? [])]) set.add(sigla)
      porSlug.set(s, set)
    }
    const multi = [...porSlug.entries()].filter(([, siglas]) => siglas.size > 1).map(([s]) => s)
    const comPagina = new Set(lista.map((s) => s.slug))
    for (const slug of multi) {
      expect(comPagina, `sistema usado por vários tribunais sem página: ${slug}`).toContain(slug)
    }
  })

  it('não cria página fina: toda página de sistema tem mais de um tribunal', () => {
    for (const s of lista) {
      expect(s.tribunais.length, `${s.slug} tem só um tribunal — a página duplicaria a do tribunal`).toBeGreaterThan(1)
    }
  })

  it('cada sistema tem faixa de limites e texto próprio', () => {
    for (const s of lista) {
      expect(faixaDeLimites(s), s.slug).toBeDefined()
      expect(s.oQueE.length, `${s.slug} sem descrição`).toBeGreaterThan(60)
      expect(s.nome.length).toBeGreaterThan(1)
    }
  })

  it('não repete descrição entre sistemas (conteúdo duplicado)', () => {
    const textos = lista.map((s) => s.oQueE)
    expect(new Set(textos).size).toBe(textos.length)
  })
})

describe('páginas de tarefa', () => {
  const raiz = process.cwd()
  const paginas = ['comprimir-pdf', 'dividir-pdf', 'juntar-pdf']

  it('existem e cada uma tem título e descrição próprios', () => {
    const titulos = new Set<string>()
    const descricoes = new Set<string>()
    for (const nome of paginas) {
      const caminho = join(raiz, 'src', 'pages', `${nome}.astro`)
      expect(existsSync(caminho), `falta src/pages/${nome}.astro`).toBe(true)
      const fonte = readFileSync(caminho, 'utf8')
      const titulo = /title="([^"]+)"/.exec(fonte)?.[1]
      const descricao = /description="([^"]+)"/.exec(fonte)?.[1]
      expect(titulo, `${nome} sem título`).toBeTruthy()
      expect(descricao, `${nome} sem descrição`).toBeTruthy()
      // Limites que o Google trunca: título ~60, descrição ~160.
      expect(titulo!.length, `título longo demais em ${nome}: ${titulo}`).toBeLessThanOrEqual(62)
      expect(descricao!.length, `descrição longa demais em ${nome}`).toBeLessThanOrEqual(175)
      titulos.add(titulo!)
      descricoes.add(descricao!)
    }
    expect(titulos.size, 'títulos repetidos entre páginas').toBe(paginas.length)
    expect(descricoes.size, 'descrições repetidas entre páginas').toBe(paginas.length)
  })

  it('cada página de tarefa aponta para as outras (links internos)', () => {
    for (const nome of paginas) {
      const fonte = readFileSync(join(raiz, 'src', 'pages', `${nome}.astro`), 'utf8')
      for (const outra of paginas.filter((x) => x !== nome)) {
        expect(fonte, `${nome} não aponta para ${outra}`).toContain(`/${outra}/`)
      }
      expect(fonte, `${nome} não aponta para os sistemas`).toContain('/sistemas/')
    }
  })
})

/*
 * Auditoria de tráfego orgânico sobre o site construído.
 *
 * O que está aqui foi medido antes de virar regra: as páginas de tribunal tinham só a sigla (nunca
 * "Tribunal de Justiça do Estado de Minas Gerais"), 1 ou 2 links de entrada cada, e uma mediana de
 * 33% de frases próprias — o resto era molde repetido em 101 páginas. Seis páginas não tinham
 * dados estruturados. Cada teste abaixo impede um desses estados de voltar.
 */
import { readdirSync, statSync } from 'node:fs'
import { paginasDeRegras, idPagina } from '../../src/tool/lib/regras'
import { nomeCurto } from '../../src/tool/lib/comparacao'

const DIST = join(process.cwd(), 'dist')

interface PaginaConstruida {
  rota: string
  html: string
  main: string
  ld: string[]
  links: string[]
}

function lerPaginas(): PaginaConstruida[] {
  const saida: PaginaConstruida[] = []
  const anda = (dir: string) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e)
      if (statSync(p).isDirectory()) anda(p)
      else if (e === 'index.html') {
        const html = readFileSync(p, 'utf8')
        saida.push({
          rota: '/' + p.slice(DIST.length + 1).replace(/index\.html$/, ''),
          html,
          main: /<main[\s\S]*?<\/main>/.exec(html)?.[0] ?? '',
          ld: [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]),
          links: [...html.matchAll(/<a [^>]*href="([^"]+)"/g)].map((m) => m[1].split('#')[0].split('?')[0]).filter((h) => h.startsWith('/')),
        })
      }
    }
  }
  anda(DIST)
  return saida
}

const tipos = (p: PaginaConstruida): string[] =>
  p.ld.flatMap((bloco) => {
    const d = JSON.parse(bloco)
    const nos = Array.isArray(d) ? d : (d['@graph'] ?? [d])
    return nos.map((n: { '@type': string }) => n['@type'])
  })

const frases = (main: string): string[] =>
  main
    .replace(/<(script|style)[\s\S]*?<\/\1>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((f) => f.trim())
    .filter((f) => f.length > 25)

describe('tráfego orgânico: o que cada página precisa ter', () => {
  const todas = lerPaginas()
  const indexaveis = todas.filter((p) => !/name="robots" content="noindex"/.test(p.html))
  const tribunais = indexaveis.filter((p) => /^\/tribunais\/[^/]+\/$/.test(p.rota))

  it('dist/ existe (rode npm run build antes)', () => {
    expect(indexaveis.length).toBeGreaterThan(150)
    expect(tribunais.length).toBeGreaterThan(90)
  })

  it('toda página interna tem trilha (BreadcrumbList); os índices são CollectionPage; a inicial declara o WebSite', () => {
    const semTrilha = indexaveis.filter((p) => p.rota !== '/' && !tipos(p).includes('BreadcrumbList')).map((p) => p.rota)
    expect(semTrilha, 'páginas sem BreadcrumbList').toEqual([])
    for (const hub of ['/tribunais/', '/sistemas/', '/guias/']) {
      expect(tipos(indexaveis.find((p) => p.rota === hub)!), hub).toContain('CollectionPage')
    }
    const home = tipos(indexaveis.find((p) => p.rota === '/')!)
    expect(home).toContain('WebSite')
    expect(home).toContain('Organization')
  })

  it('toda página indexável libera a prévia grande de imagem, e nenhuma página noindex a pede', () => {
    expect(indexaveis.filter((p) => !p.html.includes('max-image-preview:large')).map((p) => p.rota)).toEqual([])
    expect(todas.filter((p) => /content="noindex"/.test(p.html) && p.html.includes('max-image-preview')).map((p) => p.rota)).toEqual([])
  })

  it('toda página de tribunal traz o nome do tribunal por extenso, no texto e nos dados estruturados', () => {
    const porRota = new Map(paginasDeRegras().map((x) => [`/tribunais/${idPagina(x)}/`, x]))
    const sem: string[] = []
    for (const p of tribunais) {
      const nome = nomeCurto(porRota.get(p.rota)!.tribunal)
      if (!p.main.includes(nome) || !p.ld.some((b) => b.includes(nome))) sem.push(`${p.rota} (${nome})`)
    }
    expect(sem, 'páginas de tribunal sem o nome por extenso').toEqual([])
  })

  it('toda página de tribunal recebe links de entrada de outras páginas de tribunal, não só do diretório', () => {
    /*
     * Antes da seção de comparação, 100 das 101 páginas tinham no máximo dois links de entrada,
     * ambos de índices. Página que só o diretório aponta é página que o buscador visita por
     * obrigação, não por relevância.
     */
    const entradas = new Map<string, Set<string>>()
    for (const p of todas) for (const h of p.links) if (h !== p.rota) (entradas.get(h) ?? entradas.set(h, new Set()).get(h)!).add(p.rota)
    const fracas = tribunais
      .map((p) => ({ rota: p.rota, deTribunais: [...(entradas.get(p.rota) ?? [])].filter((r) => /^\/tribunais\/[^/]+\/$/.test(r)).length }))
      .filter((x) => x.deTribunais < 2)
      .map((x) => `${x.rota} (${x.deTribunais})`)
    expect(fracas, 'páginas de tribunal com menos de 2 links vindos de outras páginas de tribunal').toEqual([])
  })

  it('nenhuma página de tribunal é cópia das outras: parte relevante do texto é dela', () => {
    /*
     * Medido antes da seção de comparação: mínimo 15% (TSE), mediana 33%. Depois: mínimo 22%,
     * mediana 39%. O molde (avisos, FAQ, oferta de e-mail) é legítimo e repetido de propósito; o
     * que não pode acontecer é a página ser SÓ isso. O piso fica um pouco sob o mínimo medido,
     * para pegar regressão sem quebrar por uma frase a menos.
     */
    const porPagina = new Map(tribunais.map((p) => [p.rota, new Set(frases(p.main))]))
    const contagem = new Map<string, number>()
    for (const fs of porPagina.values()) for (const f of fs) contagem.set(f, (contagem.get(f) ?? 0) + 1)
    const proporcao = (fs: Set<string>) => [...fs].filter((f) => (contagem.get(f) ?? 0) <= 3).length / Math.max(fs.size, 1)
    const MINIMO_PROPRIO = 0.2
    const baixas = [...porPagina.entries()].filter(([, fs]) => proporcao(fs) < MINIMO_PROPRIO).map(([r, fs]) => `${r} (${Math.round(proporcao(fs) * 100)}%)`)
    expect(baixas, `páginas de tribunal com menos de ${MINIMO_PROPRIO * 100}% de frases próprias`).toEqual([])
  })

  it('o sitemap traz a data real de revisão dos guias e das regras', () => {
    const sitemap = readFileSync(join(DIST, 'sitemap-0.xml'), 'utf8')
    const comData = [...sitemap.matchAll(/<url><loc>([^<]+)<\/loc><lastmod>/g)].map((m) => m[1])
    const guias = comData.filter((u) => u.includes('/guias/') && !u.endsWith('/guias/')).length
    const regras = comData.filter((u) => u.includes('/tribunais/') && !u.endsWith('/tribunais/')).length
    expect(guias, 'guias com lastmod').toBeGreaterThan(25)
    expect(regras, 'regras com lastmod').toBeGreaterThan(40)
  })
})
