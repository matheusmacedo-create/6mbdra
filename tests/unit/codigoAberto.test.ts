import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { SITE } from '../../src/config/site.mjs'

/**
 * A promessa de código aberto tem que vir com endereço.
 *
 * Este teste nasceu de uma falha real: o site afirmava em cinco páginas que o código é aberto, que
 * dá para auditar e que "não há parte fechada" — e não linkava o repositório em lugar nenhum. A
 * página que ENSINA a ler o código listava as pastas (`src/tool/`, `tests/`) sem dizer onde elas
 * estão. Quem quisesse conferir a garantia central do produto não tinha por onde começar.
 *
 * Uma garantia que não dá para checar é indistinguível de uma promessa vazia, e o projeto inteiro
 * se apoia nessa diferença. Além disso, a AGPL-3.0 obriga a oferecer a fonte a quem usa o serviço:
 * não é só posicionamento, é a licença.
 */
const DIST = join(process.cwd(), 'dist')

function paginas(): { rota: string; html: string }[] {
  const saida: { rota: string; html: string }[] = []
  const anda = (dir: string) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e)
      if (statSync(p).isDirectory()) anda(p)
      else if (e.endsWith('.html')) {
        saida.push({ rota: '/' + p.slice(DIST.length + 1).replace(/index\.html$/, ''), html: readFileSync(p, 'utf8') })
      }
    }
  }
  anda(DIST)
  return saida
}

describe('a promessa de código aberto', () => {
  const todas = paginas()

  it('dist/ existe (rode npm run build antes)', () => {
    expect(todas.length, 'nenhuma página em dist/').toBeGreaterThan(0)
  })

  it('o repositório está configurado e é um endereço público', () => {
    expect(SITE.repo, 'SITE.repo vazio').toBeTruthy()
    expect(() => new URL(SITE.repo)).not.toThrow()
    expect(SITE.repo).toMatch(/^https:\/\//)
  })

  it('toda página que afirma ser código aberto aponta para onde ele está', () => {
    /*
     * Escopo: a afirmação, não a palavra solta. "Código-fonte" aparece em descrição de página e em
     * comentário de build sem prometer nada; o que exige endereço é dizer que é ABERTO, LIVRE ou
     * AGPL — aí a pessoa é convidada a conferir e precisa poder.
     */
    const afirma = /código[- ]fonte (é )?aberto|código é aberto|software livre|AGPL/i
    const semLink = todas
      .filter((p) => afirma.test(p.html))
      .filter((p) => !p.html.includes(SITE.repo))
      .map((p) => p.rota)
    expect(semLink, 'páginas que prometem código aberto sem linkar o repositório').toEqual([])
  })

  it('o rodapé leva ao repositório em todas as páginas', () => {
    // O rodapé é o único lugar presente em 100% do site; se o link cair dali, cai de quase tudo.
    const sem = todas.filter((p) => !p.html.includes(SITE.repo)).map((p) => p.rota)
    expect(sem, 'páginas sem link para o repositório').toEqual([])
  })

  it('a página que ensina a auditar declara o repositório nos dados estruturados', () => {
    const p = todas.find((x) => x.rota === '/seguranca/verifique/')
    expect(p, '/seguranca/verifique/ não foi gerada').toBeTruthy()
    const blocos = [...p!.html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
    const grafo = blocos.flatMap((m) => {
      const j = JSON.parse(m[1]) as { '@graph'?: unknown[] }
      return (j['@graph'] ?? [j]) as Record<string, unknown>[]
    })
    const fonte = grafo.find((n) => n['@type'] === 'SoftwareSourceCode')
    expect(fonte, 'sem SoftwareSourceCode').toBeTruthy()
    expect(fonte!.codeRepository).toBe(SITE.repo)
    expect(String(fonte!.license)).toMatch(/agpl/i)
  })

  it('links externos para fora do site saem com rel seguro', () => {
    // target="_blank" sem noopener dá à outra aba acesso a window.opener. Vale para o link novo também.
    const ruins: string[] = []
    for (const p of todas) {
      for (const m of p.html.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)) {
        if (!/rel="[^"]*noopener/.test(m[0])) ruins.push(`${p.rota}: ${m[0].slice(0, 90)}`)
      }
    }
    expect(ruins, 'links _blank sem noopener').toEqual([])
  })
})
