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
