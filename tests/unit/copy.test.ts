import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Disciplina da copy.
 *
 * O site ficou mais comercial, e é exatamente aí que a tentação aparece: "mais de 10 mil advogados
 * confiam", "nota 4,9", "o mais usado do Brasil". Nada disso é verdade, e a primeira frase
 * inventada contamina todas as outras — inclusive as que sustentam o produto, como "o arquivo não
 * sai do seu computador", que tem teste automático e é o motivo de alguém escolher este site.
 *
 * A especificação do projeto proíbe inventar números, notas, depoimentos e contagem de usuários.
 * Este teste transforma a proibição em build quebrado.
 */
const DIST = join(process.cwd(), 'dist')

function paginas(): { rota: string; texto: string; html: string }[] {
  const saida: { rota: string; texto: string; html: string }[] = []
  const anda = (dir: string) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e)
      if (statSync(p).isDirectory()) anda(p)
      else if (e.endsWith('.html')) {
        const html = readFileSync(p, 'utf8')
        // Só o <main>: scripts e dados estruturados não são copy.
        const main = /<main[\s\S]*?<\/main>/.exec(html)?.[0] ?? html
        saida.push({
          rota: '/' + p.slice(DIST.length + 1).replace(/index\.html$/, ''),
          texto: main.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '),
          html,
        })
      }
    }
  }
  anda(DIST)
  return saida
}

describe('a copy não inventa prova social', () => {
  const todas = paginas()

  it('dist/ existe (rode npm run build antes)', () => {
    expect(todas.length).toBeGreaterThan(100)
  })

  it('nenhuma página alega contagem de usuários, clientes ou downloads', () => {
    /*
     * Não temos esse número, e o que temos (visitas por dia, pelo hash que rotaciona à meia-noite)
     * não vira "usuários" sem mentir. A página do painel mostra o que dá para medir, com o nome
     * certo.
     */
    /*
     * A mentira tem uma forma específica: QUANTIDADE + PESSOAS + VERBO DE ENDOSSO, os três juntos.
     * Nenhum dos três sozinho é sinal de nada.
     *
     * Duas versões anteriores erraram por pedir menos. A primeira pegou "o escritório já usa para
     * se organizar"; a segunda, com número obrigatório, pegou "10 MB para advogados" (citação de
     * fonte oficial numa página de tribunal) e "§ 3º: a parte ou o advogado pode juntar quantos
     * arquivos" (texto de resolução do CNJ). Um teste que reprova citação de norma é pior que
     * nenhum: ensina a ignorá-lo.
     */
    const padrao =
      /(?:mais de|cerca de|já são|milhares de|centenas de|\+\s?\d|\d[\d.,]*)\s*(?:mil|milh(?:ão|ões))?\s*(?:usuári|advogad|escritóri|client|profissiona|pessoa)\w*\s+(?:j[áa]\s+)?(?:usam|usaram|confiam|escolher|atendid|satisfeit|aprovam|recomendam|preparar|processar)/i
    const ruins = todas.filter((p) => padrao.test(p.texto)).map((p) => p.rota)
    expect(ruins, 'páginas alegando contagem de usuários').toEqual([])
  })

  it('nenhuma página exibe nota, estrela ou avaliação', () => {
    const padrao = /\b(?:nota|avaliaç\w+|classificaç\w+)\s*(?:de\s*)?[0-9][,.]?[0-9]?\s*(?:\/|de\s*)?\s*(?:5|10|estrelas?)\b|★|⭐/i
    const ruins = todas.filter((p) => padrao.test(p.texto)).map((p) => p.rota)
    expect(ruins, 'páginas com nota ou avaliação').toEqual([])
  })

  it('os dados estruturados não trazem nota nem avaliação que o site não coleta', () => {
    /*
     * A versão invisível da mesma mentira. O teste de resultados avançados do Google avisa que o
     * campo "aggregateRating" está ausente do WebApplication — como aviso opcional, não como erro
     * — e a forma mais rápida de silenciar o aviso é digitar uma nota no JSON-LD. Ninguém veria na
     * página; o Google veria, e trataria como nota real.
     *
     * O site não tem sistema de avaliação, então qualquer valor ali seria inventado. Isso viola a
     * regra do projeto e a política de dados estruturados do Google (nota que não vem de avaliação
     * coletada é "self-serving review": ação manual e perda dos resultados avançados do domínio
     * inteiro). O aviso fica; a nota, não.
     */
    const padrao = /aggregateRating|ratingValue|reviewCount|ratingCount|"@type":\s*"(?:Review|AggregateRating|Rating)"/
    const ruins = todas.filter((p) => padrao.test(p.html)).map((p) => p.rota)
    expect(ruins, 'páginas com nota nos dados estruturados').toEqual([])
  })

  it('nenhuma página traz depoimento', () => {
    const padrao = /\b(?:depoiment|testemunh)\w*\b|["“][^"”]{25,}["”]\s*—\s*[A-ZÀ-Ú][a-zà-ú]+\s+[A-ZÀ-Ú]/
    const ruins = todas
      .filter((p) => padrao.test(p.texto))
      // A página de metodologia CITA fontes oficiais entre aspas: isso é fonte, não depoimento.
      .filter((p) => !p.rota.startsWith('/metodologia') && !p.rota.startsWith('/tribunais/'))
      .map((p) => p.rota)
    expect(ruins, 'páginas com depoimento').toEqual([])
  })

  it('nenhuma página se declara a melhor, a número 1 ou a mais usada', () => {
    const padrao = /\b(?:o|a)\s+(?:melhor|maior|mais\s+(?:usad|complet|rápid|confiáv|popular))\w*\s+(?:ferramenta|site|serviço|do\s+brasil)|\bnúmero\s*1\b|\bl[íi]der\s+de\s+mercado\b/i
    const ruins = todas.filter((p) => padrao.test(p.texto)).map((p) => p.rota)
    expect(ruins, 'páginas com superlativo de mercado').toEqual([])
  })
})

describe('a copy comercial mantém a promessa verificável', () => {
  const todas = paginas()
  const ferramentas = ['/', '/comprimir-pdf/', '/dividir-pdf/', '/juntar-pdf/', '/verificar-assinatura-digital/', '/metadados-pdf/', '/documento-feito-por-ia/']

  it('toda página de ferramenta afirma que o arquivo não é enviado', () => {
    /*
     * É o argumento que nenhum concorrente pode copiar, e o único que justifica escolher este site
     * em vez do primeiro resultado do Google. Se sumir de uma página de ferramenta, sumiu o motivo.
     */
    const sem = ferramentas
      .map((r) => todas.find((p) => p.rota === r))
      .filter((p): p is NonNullable<typeof p> => !!p)
      .filter((p) => !/não (?:sai|são enviad|é enviad)|nada é enviado|sem enviar/i.test(p.texto))
      .map((p) => p.rota)
    expect(sem, 'páginas de ferramenta sem a promessa de sigilo').toEqual([])
  })

  it('toda página de ferramenta diz que é grátis', () => {
    const sem = ferramentas
      .map((r) => todas.find((p) => p.rota === r))
      .filter((p): p is NonNullable<typeof p> => !!p)
      .filter((p) => !/\bgrátis\b|\bgratuit\w+/i.test(p.texto))
      .map((p) => p.rota)
    expect(sem, 'páginas de ferramenta sem dizer que é grátis').toEqual([])
  })

  it('toda página de tribunal responde o limite antes da tabela', () => {
    /*
     * São 101 páginas e a maior porta de entrada do site. A pessoa chega com um arquivo grande e
     * uma dúvida de um minuto: cabe ou não cabe? O lead precisa dar o número, não repetir o nome do
     * tribunal que já está no título.
     */
    const tribunais = todas.filter((p) => /^\/tribunais\/[^/]+\/$/.test(p.rota))
    expect(tribunais.length).toBeGreaterThan(90)
    const ruins = tribunais
      .filter((p) => !/class="lead"[^>]*>\s*No .*?pode ter até/s.test(p.html))
      .map((p) => p.rota)
    expect(ruins, 'páginas de tribunal sem o limite no lead').toEqual([])
  })

  it('toda página de tribunal oferece a ferramenta antes da tabela', () => {
    const tribunais = todas.filter((p) => /^\/tribunais\/[^/]+\/$/.test(p.rota))
    const ruins = tribunais
      .filter((p) => {
        const cta = p.html.indexOf('class="cta"')
        const tabela = p.html.indexOf('<table')
        return cta === -1 || (tabela !== -1 && cta > tabela)
      })
      .map((p) => p.rota)
    expect(ruins, 'páginas de tribunal com o CTA depois da tabela').toEqual([])
  })
})
