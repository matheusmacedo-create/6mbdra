import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { alvoDoTribunal, guiasDoTribunal, porTema, relacionados, SLUGS_CITADOS, type GuiaRef } from '../../src/tool/lib/guias'
import regrasJson from '../../src/data/regras.json'

/**
 * A malha de links internos do site.
 *
 * Isto nasceu de uma medição, não de teoria: com 22 guias no ar, seis tinham UM link de entrada
 * (o do índice) e nenhuma das 101 páginas de tribunal apontava para guia nenhum. Conteúdo que só o
 * índice alcança é conteúdo que o buscador trata como periférico — e havia uma rotina diária
 * criando mais guias para o mesmo buraco.
 *
 * O que estes testes protegem não é o número de links, é a propriedade: nenhum guia fica órfão, e o
 * bloco das páginas de tribunal não vira o mesmo texto repetido cem vezes.
 */
const DIST = join(process.cwd(), 'dist')
const GUIAS_DIR = join(process.cwd(), 'src', 'content', 'guias')

function slugsExistentes(): string[] {
  return readdirSync(GUIAS_DIR).filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, ''))
}

function guiaFake(id: string, tags: string[]): GuiaRef {
  return { id, data: { title: id, description: 'd', tags } }
}

describe('guias citados por slug no código', () => {
  it('todos existem na coleção', () => {
    const existem = new Set(slugsExistentes())
    const sumidos = SLUGS_CITADOS.filter((s) => !existem.has(s))
    // Renomear um guia sem ajustar guias.ts tiraria o link de até 100 páginas sem erro nenhum.
    expect(sumidos, 'slug citado em src/tool/lib/guias.ts que não existe mais').toEqual([])
  })
})

describe('guias da página de tribunal', () => {
  const todos = slugsExistentes().map((s) => guiaFake(s, []))

  it('tribunal que exige PDF/A recebe o guia de PDF/A', () => {
    const r = guiasDoTribunal({ id: 'x', limiteMb: 10, exigePdfa: true }, todos)
    expect(r.map((x) => x.guia.id)).toContain('pdf-a-quando-o-tribunal-exige')
  })

  it('limite apertado puxa digitalização, limite folgado não', () => {
    const apertado = guiasDoTribunal({ id: 'x', limiteMb: 1.5 }, todos).map((x) => x.guia.id)
    const folgado = guiasDoTribunal({ id: 'x', limiteMb: 50 }, todos).map((x) => x.guia.id)
    expect(apertado).toContain('digitalizar-pelo-celular-sem-arquivo-gigante')
    expect(folgado).not.toContain('digitalizar-pelo-celular-sem-arquivo-gigante')
  })

  it('cada guia aparece uma vez só, e no máximo quatro', () => {
    const r = guiasDoTribunal({ id: 'abc', limiteMb: 2, exigePdfa: true, limitePorPaginaKb: 300 }, todos)
    expect(r.length).toBeLessThanOrEqual(4)
    expect(new Set(r.map((x) => x.guia.id)).size).toBe(r.length)
    expect(r.every((x) => x.motivo.length > 20), 'todo link precisa do motivo escrito').toBe(true)
  })

  it('o mesmo tribunal dá sempre o mesmo resultado', () => {
    const a = guiasDoTribunal({ id: 'tjsp-esaj', limiteMb: 10 }, todos).map((x) => x.guia.id)
    const b = guiasDoTribunal({ id: 'tjsp-esaj', limiteMb: 10 }, todos).map((x) => x.guia.id)
    // Bloco que muda entre builds sem o conteúdo mudar é ruído no diff e no rastreamento.
    expect(a).toEqual(b)
  })

  it('tribunais iguais no papel não recebem todos o mesmo bloco', () => {
    // A rotação pelo id é o que impede 77 páginas com bloco idêntico.
    const ids = ['tjsp-esaj', 'tjrj-pje', 'tjmg-pje', 'trf1-pje', 'tjba-pje', 'tjpe-pje']
    const blocos = new Set(ids.map((id) => guiasDoTribunal({ id, limiteMb: 10 }, todos).map((x) => x.guia.id).join('|')))
    expect(blocos.size, 'a rotação não está variando').toBeGreaterThan(1)
  })

  it('slug inexistente é descartado em vez de virar link quebrado', () => {
    const poucos = [guiaFake('o-sistema-recusou-meu-pdf-causas-e-solucoes', [])]
    const r = guiasDoTribunal({ id: 'x', limiteMb: 10 }, poucos)
    expect(r.map((x) => x.guia.id)).toEqual(['o-sistema-recusou-meu-pdf-causas-e-solucoes'])
  })
})

describe('página de tamanho-alvo ligada ao tribunal', () => {
  const alvos = [
    { slug: '100kb', mb: 0.1, rotulo: '100 KB', ctaRegraId: 'tjal-esaj' },
    { slug: '5mb', mb: 5, rotulo: '5 MB' },
    { slug: '10mb', mb: 10, rotulo: '10 MB' },
  ]

  it('casa pelo limite exato', () => {
    expect(alvoDoTribunal('qualquer', 5, alvos)?.slug).toBe('5mb')
  })

  it('não empurra meta mais apertada que o limite real', () => {
    // Tribunal de 3 MB não deve ver "comprimir para 2 MB": seria perder qualidade à toa.
    expect(alvoDoTribunal('qualquer', 3, alvos)).toBeNull()
    expect(alvoDoTribunal('qualquer', 7, alvos)).toBeNull()
  })

  it('a regra citada pelo alvo vence a comparação numérica', () => {
    // 100 KB é limite POR PÁGINA no TJAL — não bateria comparando com o limite por arquivo.
    expect(alvoDoTribunal('tjal-esaj', 5, alvos)?.slug).toBe('100kb')
  })
})

describe('guias relacionados', () => {
  const todos = [
    guiaFake('a', ['OCR', 'peticionamento']),
    guiaFake('b', ['ocr', 'digitalização']),
    guiaFake('c', ['peticionamento eletrônico']),
    guiaFake('d', ['assinatura digital']),
  ]

  it('casa etiquetas escritas de formas diferentes', () => {
    // 'OCR'/'ocr' e 'peticionamento'/'peticionamento eletrônico' são a mesma coisa para quem lê.
    const r = relacionados(todos[0], todos).map((g) => g.id)
    expect(r).toContain('b')
    expect(r).toContain('c')
  })

  it('nunca inclui a si mesmo nem quem não tem nada em comum', () => {
    const r = relacionados(todos[0], todos).map((g) => g.id)
    expect(r).not.toContain('a')
    expect(r).not.toContain('d')
  })
})

describe('índice de guias por tema', () => {
  const todos = slugsExistentes().map((s) => {
    const bruto = readFileSync(join(GUIAS_DIR, `${s}.md`), 'utf8')
    const tags = [...bruto.matchAll(/^ {2}- (.+)$/gm)].map((m) => m[1].trim())
    return guiaFake(s, tags)
  })

  it('todo guia aparece, e uma vez só', () => {
    const listados = porTema(todos).flatMap((t) => t.guias.map((g) => g.id))
    // Guia que não casa com tema nenhum cai em "Outros" — sumir do índice o deixaria inalcançável.
    expect(listados.sort()).toEqual(todos.map((g) => g.id).sort())
  })

  it('nenhum tema fica vazio na página', () => {
    expect(porTema(todos).every((t) => t.guias.length > 0)).toBe(true)
  })
})

/*
 * A partir daqui a auditoria é sobre o site construído, porque o que importa é o link que o
 * rastreador enxerga — não a intenção no código. O rodapé é descontado de propósito: link de
 * rodapé é igual em todas as páginas, e é justamente o que não conta como sinal de relevância.
 */
function paginasConstruidas(): Map<string, string> {
  const m = new Map<string, string>()
  const anda = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name)
      if (e.isDirectory()) anda(p)
      else if (e.name === 'index.html') m.set(`/${relative(DIST, p).replace(/index\.html$/, '')}`.replace(/\/+$/, '/'), readFileSync(p, 'utf8'))
    }
  }
  anda(DIST)
  return m
}

describe('malha de links no site construído', () => {
  const paginas = paginasConstruidas()
  const semRodape = (html: string) => html.split('<footer')[0]
  const guias = [...paginas.keys()].filter((r) => r.startsWith('/guias/') && r !== '/guias/')
  const tribunais = [...paginas.keys()].filter((r) => r.startsWith('/tribunais/') && r !== '/tribunais/')

  const entrada = new Map<string, number>()
  for (const [rota, html] of paginas) {
    for (const href of new Set([...semRodape(html).matchAll(/href="(\/[^"#?]*\/)"/g)].map((m) => m[1]))) {
      if (href !== rota) entrada.set(href, (entrada.get(href) ?? 0) + 1)
    }
  }

  it('nenhum guia é órfão', () => {
    // Um link só significa "alcançável apenas pelo índice" — foi o estado de 6 guias antes disto.
    const orfaos = guias.filter((g) => (entrada.get(g) ?? 0) < 2)
    expect(orfaos, 'guia alcançável só pelo índice').toEqual([])
  })

  it('nenhuma página de tamanho-alvo é órfã', () => {
    // Elas nasceram com um link cada (só o de /comprimir-pdf/) — o mesmo estado de quase-órfão dos
    // guias antes desta malha. O link do tribunal de limite igual é o que as tira dali.
    const alvos = [...paginas.keys()].filter((r) => r.startsWith('/comprimir-pdf-para-'))
    expect(alvos.length, 'nenhuma página de tamanho-alvo encontrada').toBeGreaterThan(4)
    const orfas = alvos.filter((r) => (entrada.get(r) ?? 0) < 2)
    expect(orfas, 'página de tamanho-alvo alcançável só por /comprimir-pdf/').toEqual([])
  })

  it('toda página de tribunal aponta para guias', () => {
    const sem = tribunais.filter((r) => !/href="\/guias\/[a-z]/.test(semRodape(paginas.get(r)!)))
    expect(sem, 'página de tribunal sem nenhum link para guia').toEqual([])
  })

  it('o bloco de guias não é o mesmo texto em todas as páginas de tribunal', () => {
    const blocos = new Set(
      tribunais.map((r) => {
        const m = semRodape(paginas.get(r)!).match(/Como preparar o PDF para o[\s\S]*?<\/ul>/)
        return m ? [...new Set([...m[0].matchAll(/\/guias\/([a-z0-9-]+)\//g)].map((x) => x[1]))].sort().join('|') : ''
      }),
    )
    // Com 53 regras e 4 vagas por página, esperar variedade é razoável; 1 ou 2 seria boilerplate.
    expect(blocos.size, 'blocos pouco variados — virou boilerplate').toBeGreaterThan(8)
  })

  it('cada guia citado numa página de tribunal vem com o motivo, não só o link', () => {
    const html = semRodape([...paginas.entries()].find(([r]) => r.startsWith('/tribunais/') && r !== '/tribunais/')![1])
    const bloco = html.match(/Como preparar o PDF para o[\s\S]*?<\/ul>/)
    expect(bloco, 'bloco de guias ausente na página de tribunal').toBeTruthy()
    expect((bloco![0].match(/<p>/g) ?? []).length).toBeGreaterThanOrEqual(3)
  })

  it('as regras cobrem tribunais o bastante para a variação fazer sentido', () => {
    // Guarda de sanidade: se a base encolher muito, o limiar de variedade acima perde o sentido.
    expect((regrasJson as { regras: unknown[] }).regras.length).toBeGreaterThan(40)
  })
})
