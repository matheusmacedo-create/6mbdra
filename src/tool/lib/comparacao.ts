/*
 * Comparação entre tribunais, para a seção "Outros tribunais no seu estado" das páginas de regra.
 *
 * O problema que isto resolve foi medido: das 101 páginas de tribunal, a mediana tinha só 33% de
 * frases próprias, e as 27 páginas de TRE ficavam em 17% (mesmo PJe, mesmo limite herdado do TSE,
 * mesmo texto). Para o buscador, um conjunto assim parece feito para ocupar resultados, não para
 * responder alguém — e cada página recebia 1 ou 2 links internos, todos do diretório.
 *
 * A saída não é escrever 101 textos diferentes à mão. É usar o que já é diferente em cada página:
 * o estado. Quem protocola no TRE da Bahia também protocola no TJBA, no TRT5 e no TRF1, e os
 * quatro têm limites diferentes. Essa comparação é útil para quem lê, é única por página porque
 * sai dos dados, e cria a malha de links que faltava — sem inventar uma palavra.
 */
import { RAMOS, formatLimite, idPagina, limiteBytes, paginasDeRegras, rotuloSistema, sistemaCurto, slugSistema, type RegraDoTribunal, type Tribunal } from './regras'

export const NOME_UF: Record<string, string> = {
  AC: 'Acre', AL: 'Alagoas', AM: 'Amazonas', AP: 'Amapá', BA: 'Bahia', CE: 'Ceará', DF: 'Distrito Federal',
  ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão', MG: 'Minas Gerais', MS: 'Mato Grosso do Sul', MT: 'Mato Grosso',
  PA: 'Pará', PB: 'Paraíba', PE: 'Pernambuco', PI: 'Piauí', PR: 'Paraná', RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte',
  RO: 'Rondônia', RR: 'Roraima', RS: 'Rio Grande do Sul', SC: 'Santa Catarina', SE: 'Sergipe', SP: 'São Paulo', TO: 'Tocantins',
}

/** "no Acre", "na Bahia", "em Minas Gerais": a preposição depende do nome, não há regra. */
const PREPOSICAO: Record<string, string> = {
  AC: 'no', AL: 'em', AM: 'no', AP: 'no', BA: 'na', CE: 'no', DF: 'no', ES: 'no', GO: 'em', MA: 'no', MG: 'em', MS: 'em', MT: 'em',
  PA: 'no', PB: 'na', PE: 'em', PI: 'no', PR: 'no', RJ: 'no', RN: 'no', RO: 'em', RR: 'em', RS: 'no', SC: 'em', SE: 'em', SP: 'em', TO: 'no',
}

export function noEstado(uf: string): string {
  return `${PREPOSICAO[uf] ?? 'em'} ${NOME_UF[uf] ?? uf}`
}

/**
 * Nome do tribunal sem o parêntese de abrangência. "Tribunal Regional do Trabalho da 2ª Região
 * (SP (Grande São Paulo e Baixada Santista))" vira "Tribunal Regional do Trabalho da 2ª Região":
 * é assim que as pessoas escrevem o nome na busca, e o parêntese aninhado não cabe numa frase.
 */
export function nomeCurto(t: Tribunal): string {
  const i = t.nome.indexOf('(')
  return (i < 0 ? t.nome : t.nome.slice(0, i)).trim()
}

/**
 * Estados que um tribunal atende. Os de um estado só trazem `uf`; TRTs e TRFs trazem as siglas no
 * parêntese do nome ("… da 4ª Região (RS, SC e PR)"). Tribunal superior não tem estado.
 */
export function ufsDoTribunal(t: Tribunal): string[] {
  if (t.uf) return [t.uf]
  const i = t.nome.indexOf('(')
  if (i < 0) return []
  const dentro = t.nome.slice(i)
  // Na ordem em que o tribunal escreve: "(PA e AP)" vira Pará e Amapá, não Amapá e Pará.
  return Object.keys(NOME_UF)
    .map((uf) => ({ uf, pos: dentro.search(new RegExp(`\\b${uf}\\b`)) }))
    .filter((x) => x.pos >= 0)
    .sort((a, b) => a.pos - b.pos)
    .map((x) => x.uf)
}

export interface Vizinho {
  pagina: RegraDoTribunal
  /** id da página pública: /tribunais/<id>/ */
  id: string
  /** Como o limite dele se compara ao daqui, em palavras. */
  relacao: string
}

export interface Comparacao {
  escopo: 'estado' | 'regiao' | 'superiores'
  titulo: string
  intro: string
  itens: Vizinho[]
  /** Uma frase com o menor e o maior limite do grupo, contando a página atual. */
  resumo: string
}

function resumo(onde: string, atual: RegraDoTribunal, itens: Vizinho[]): string {
  const todos = [atual, ...itens.map((v) => v.pagina)]
  const menor = todos.reduce((a, b) => (limiteBytes(b.regra) < limiteBytes(a.regra) ? b : a))
  const maior = todos.reduce((a, b) => (limiteBytes(b.regra) > limiteBytes(a.regra) ? b : a))
  const rotulo = (p: RegraDoTribunal) => `${formatLimite(p.regra)} (${p.tribunal.sigla} no ${sistemaCurto(p.regra)})`
  if (limiteBytes(menor.regra) === limiteBytes(maior.regra)) return `${onde}, todos aceitam o mesmo limite por arquivo: ${formatLimite(menor.regra)}.`
  return `${onde}, o menor limite por arquivo é ${rotulo(menor)} e o maior, ${rotulo(maior)}.`
}

const capitaliza = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** "o mesmo limite", "3× o limite daqui", "1/3 do limite daqui", "mais que aqui", "menos que aqui". */
export function relacao(atual: RegraDoTribunal, outro: RegraDoTribunal): string {
  const a = limiteBytes(atual.regra)
  const b = limiteBytes(outro.regra)
  if (a === b) return 'o mesmo limite'
  const k = b > a ? b / a : a / b
  const arredondado = Math.round(k)
  const inteiro = arredondado >= 2 && Math.abs(k - arredondado) < 0.05
  if (b > a) return inteiro ? `${arredondado}× o limite daqui` : 'mais que aqui'
  return inteiro ? `1/${arredondado} do limite daqui` : 'menos que aqui'
}

const ORDEM_RAMO = new Map(RAMOS.map((r, i) => [r, i] as const))

/** Ordem de leitura de quem está num estado: justiça estadual, federal, do trabalho, eleitoral, militar. */
function ordena(itens: Vizinho[]): Vizinho[] {
  return itens.sort(
    (x, y) =>
      (ORDEM_RAMO.get(x.pagina.tribunal.ramo) ?? 99) - (ORDEM_RAMO.get(y.pagina.tribunal.ramo) ?? 99) ||
      x.pagina.tribunal.sigla.localeCompare(y.pagina.tribunal.sigla, 'pt-BR') ||
      x.id.localeCompare(y.id),
  )
}

/**
 * Páginas de OUTROS tribunais que interessam a quem protocola no tribunal desta página.
 *
 * - Tribunal de um estado: todo tribunal que atende aquele estado (TJ, TRF, TRT, TRE, TJM).
 * - Tribunal de vários estados (TRF, alguns TRTs): os tribunais de justiça dos estados atendidos,
 *   um por tribunal, para a lista não virar o diretório inteiro.
 * - Tribunal superior: os outros tribunais superiores.
 */
export function comparacao(atual: RegraDoTribunal, todas: RegraDoTribunal[] = paginasDeRegras()): Comparacao | undefined {
  const outras = todas.filter((p) => p.tribunal.sigla !== atual.tribunal.sigla)
  const item = (p: RegraDoTribunal): Vizinho => ({ pagina: p, id: idPagina(p), relacao: relacao(atual, p) })
  const sigla = atual.tribunal.sigla
  const limite = `${formatLimite(atual.regra)} do ${rotuloSistema(atual.regra)} do ${sigla}`

  if (atual.tribunal.ramo === 'superior') {
    const itens = ordena(outras.filter((p) => p.tribunal.ramo === 'superior').map(item))
    if (itens.length === 0) return undefined
    return {
      escopo: 'superiores',
      titulo: 'Nos outros tribunais superiores',
      intro: `Comparado ao limite de ${limite}, os demais tribunais superiores da base aceitam:`,
      itens,
      resumo: resumo('Entre os tribunais superiores', atual, itens),
    }
  }

  const ufs = ufsDoTribunal(atual.tribunal)
  if (ufs.length === 0) return undefined
  const nomes = ufs.map((u) => NOME_UF[u] ?? u)
  const lista = nomes.length > 1 ? `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}` : nomes[0]
  const nosEstados = outras.filter((p) => ufsDoTribunal(p.tribunal).some((u) => ufs.includes(u)))

  if (ufs.length === 1) {
    const itens = ordena(nosEstados.map(item))
    if (itens.length === 0) return undefined
    return {
      escopo: 'estado',
      titulo: `Outros tribunais ${noEstado(ufs[0])}`,
      intro: `Quem protocola ${noEstado(ufs[0])} encontra um limite diferente em cada justiça. Comparado ao limite de ${limite}:`,
      itens,
      resumo: resumo(capitaliza(noEstado(ufs[0])), atual, itens),
    }
  }

  /*
   * Tribunal de mais de um estado. Com poucos estados (TRT8: PA e AP), a lista inteira ainda é
   * curta e útil. Com muitos (TRF1: 13 estados), ela viraria o diretório — então ficam só os
   * tribunais de justiça, um por estado.
   */
  if (nosEstados.length <= 12) {
    const itens = ordena(nosEstados.map(item))
    if (itens.length === 0) return undefined
    return {
      escopo: 'regiao',
      titulo: `Outros tribunais nos estados do ${sigla}`,
      intro: `O ${sigla} atende ${lista}. Comparado ao limite de ${limite}, os outros tribunais desses estados aceitam:`,
      itens,
      resumo: resumo('Nesses estados', atual, itens),
    }
  }
  /*
   * Um item por estado: o tribunal de justiça quando tem regra; quando não tem (AP, PB, PI, RN,
   * RS…), entram os outros tribunais daquele estado — senão o estado sumiria da lista e as páginas
   * dele ficariam sem este link.
   */
  const itens: Vizinho[] = []
  for (const uf of ufs) {
    const doEstado = nosEstados.filter((p) => ufsDoTribunal(p.tribunal).includes(uf))
    const tj = doEstado.find((p) => p.tribunal.ramo === 'estadual')
    for (const p of tj ? [tj] : doEstado) {
      const id = idPagina(p)
      if (!itens.some((v) => v.id === id)) itens.push(item(p))
    }
  }
  if (itens.length === 0) return undefined
  const ordenados = ordena(itens)
  return {
    escopo: 'regiao',
    titulo: `Nos tribunais dos estados do ${sigla}`,
    intro: `O ${sigla} atende ${lista}. Comparado ao limite de ${limite}, os tribunais desses estados aceitam:`,
    itens: ordenados,
    resumo: resumo('Nesses estados', atual, ordenados),
  }
}

export interface Posicao {
  /** Regras próprias (não herdadas) do mesmo sistema na base. */
  total: number
  menores: number
  maiores: number
  min: RegraDoTribunal
  max: RegraDoTribunal
}

/**
 * Onde o limite desta página fica entre as regras do mesmo sistema. Conta regras próprias: a regra
 * nacional do TSE entra uma vez, não 27 (uma por TRE). Sem sentido com menos de três regras.
 */
export function posicaoNoSistema(atual: RegraDoTribunal, todas: RegraDoTribunal[] = paginasDeRegras()): Posicao | undefined {
  const sistema = slugSistema(atual.regra)
  const proprias = todas.filter((p) => !p.herdada && slugSistema(p.regra) === sistema)
  if (proprias.length < 3) return undefined
  const a = limiteBytes(atual.regra)
  const ordenadas = [...proprias].sort((x, y) => limiteBytes(x.regra) - limiteBytes(y.regra))
  return {
    total: proprias.length,
    menores: proprias.filter((p) => limiteBytes(p.regra) < a).length,
    maiores: proprias.filter((p) => limiteBytes(p.regra) > a).length,
    min: ordenadas[0],
    max: ordenadas[ordenadas.length - 1],
  }
}
