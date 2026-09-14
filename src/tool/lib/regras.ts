import data from '../../data/regras.json'
import tribunaisData from '../../data/tribunais.json'
import { slug } from './naming'

export type Unidade = 'MB' | 'MiB' | 'KB'
export type Situacao = 'vigente' | 'em_revisao' | 'substituida'
export type Instancia = '1º grau' | '2º grau' | 'ambos' | 'não se aplica'
export type TipoPeticionamento = 'inicial' | 'intermediário' | 'recurso' | 'geral' | 'principal' | 'anexos'

export interface LimiteCondicional {
  /** A partir deste número de páginas vale o limite alternativo */
  min_paginas: number
  limite_valor: number
  limite_unidade: Unidade
}

export interface Regra {
  /** Chave estável (slug), ex.: tjrj-portal-2grau-inicial */
  id: string
  tribunal_sigla: string
  tribunal_nome: string
  sistema: string
  /** Nome amigável do sistema quando "Portal próprio" não diz nada (ex.: "e-STF") */
  sistema_rotulo?: string
  instancia: Instancia
  tipo_peticionamento: TipoPeticionamento
  formato: 'PDF'
  limite_valor: number
  limite_unidade: Unidade
  /** Sobrescreve o percentual padrão da meta segura, se necessário */
  meta_segura_percentual?: number
  /** Limite adicional por página (sistemas e-SAJ), em KB */
  limite_por_pagina_kb?: number
  /** Limite adicional da soma dos arquivos de uma petição, em MB */
  limite_total_peticao_mb?: number
  /** Limite maior condicionado ao número de páginas (ex.: TJGO) */
  limite_condicional?: LimiteCondicional
  /** O sistema exige PDF/A (a ferramenta não gera PDF/A: avisar) */
  exige_pdfa?: boolean
  fonte_url: string
  fonte_titulo: string
  /** Trecho literal da fonte que declara o limite */
  fonte_trecho?: string
  /** O trecho está numa imagem da página (o monitor não confere o texto) */
  trecho_em_imagem?: boolean
  /** Página com conteúdo dinâmico: o monitor só confere se o trecho continua presente */
  monitor_so_trecho?: boolean
  data_fonte?: string
  verificado_em: string
  situacao: Situacao
  /** Por que está "em revisão" (fontes divergentes, fonte antiga…) */
  motivo_revisao?: string
  observacoes?: string
  /** Siglas de outros tribunais aos quais esta mesma regra/fonte se aplica (regra nacional) */
  abrange?: string[]
}

export type Ramo = 'superior' | 'estadual' | 'federal' | 'trabalho' | 'eleitoral' | 'militar'

export interface Tribunal {
  sigla: string
  nome: string
  ramo: Ramo
  uf?: string
  abrangencia?: string
}

/** Os 92 tribunais brasileiros com função de julgamento (STF, 4 superiores, 27 TJs, 6 TRFs, 24 TRTs, 27 TREs, 3 TJMs). */
export const TRIBUNAIS: Tribunal[] = tribunaisData as Tribunal[]

export const RAMOS: Ramo[] = ['estadual', 'federal', 'trabalho', 'superior', 'eleitoral', 'militar']

export const RAMO_ROTULO: Record<Ramo, string> = {
  superior: 'Tribunais Superiores',
  estadual: 'Justiça Estadual',
  federal: 'Justiça Federal',
  trabalho: 'Justiça do Trabalho',
  eleitoral: 'Justiça Eleitoral',
  militar: 'Justiça Militar Estadual',
}

export interface BaseDeRegras {
  versao: string
  meta_segura_percentual_padrao: number
  regras: Regra[]
}

export const REGRAS: BaseDeRegras = data as BaseDeRegras

export const UNIDADE_BYTES: Record<Unidade, number> = {
  MB: 1_000_000, // leitura conservadora: MB decimal
  MiB: 1_048_576,
  KB: 1_000,
}

/** Percentual padrão da meta segura (spec §8.1): única fonte de verdade é o arquivo de regras. */
export const META_PERCENTUAL_PADRAO = REGRAS.meta_segura_percentual_padrao

export function unidadeParaBytes(valor: number, unidade: Unidade): number {
  return Math.round(valor * UNIDADE_BYTES[unidade])
}

/** Limite declarado, em bytes (leitura conservadora do MB como decimal). */
export function limiteBytes(r: Regra): number {
  return unidadeParaBytes(r.limite_valor, r.limite_unidade)
}

export function percentualMeta(r: Regra): number {
  return r.meta_segura_percentual ?? META_PERCENTUAL_PADRAO
}

/** Meta segura em bytes: limite × percentual (spec §8.1). */
export function metaBytes(r: Regra): number {
  return Math.floor((limiteBytes(r) * percentualMeta(r)) / 100)
}

export function regraPorId(id: string): Regra | undefined {
  return REGRAS.regras.find((r) => r.id === id)
}

export function regrasVigentes(): Regra[] {
  return REGRAS.regras.filter((r) => r.situacao !== 'substituida')
}

export function formatLimite(r: Regra): string {
  return `${r.limite_valor.toLocaleString('pt-BR')} ${r.limite_unidade}`
}

/** "10 MB" já diz tudo; só MiB e KB ganham a tradução em bytes decimais ao lado. */
export function mostrarBytesDoLimite(r: Regra): boolean {
  return r.limite_unidade !== 'MB'
}

export function rotuloSistema(r: Regra): string {
  return r.sistema_rotulo ?? r.sistema
}

export function rotuloInstancia(i: Instancia): string {
  switch (i) {
    case '1º grau':
      return '1º grau'
    case '2º grau':
      return '2º grau'
    case 'ambos':
      return '1º e 2º graus'
    default:
      return ''
  }
}

export function rotuloTipo(t: TipoPeticionamento): string {
  switch (t) {
    case 'inicial':
      return 'petição inicial'
    case 'intermediário':
      return 'petição intermediária'
    case 'recurso':
      return 'recurso'
    case 'principal':
      return 'documento principal (opção "Arquivo PDF")'
    case 'anexos':
      return 'anexos'
    default:
      return ''
  }
}

/** Contexto curto para listas: "1º e 2º graus, petição inicial" (vazio quando é a regra geral). */
export function rotuloContexto(r: Regra, opts: { omitirAmbos?: boolean } = {}): string {
  const partes: string[] = []
  const inst = rotuloInstancia(r.instancia)
  if (inst && !(opts.omitirAmbos && r.instancia === 'ambos')) partes.push(inst)
  const tipo = rotuloTipo(r.tipo_peticionamento)
  if (tipo) partes.push(tipo)
  return partes.join(', ')
}

/** Rótulo curto para listas: "TJRJ · Portal de Serviços · 6 MB (2º grau, petição inicial)" */
export function rotuloRegra(r: Regra): string {
  const ctx = rotuloContexto(r, { omitirAmbos: true })
  return `${r.tribunal_sigla} · ${rotuloSistema(r)} · ${formatLimite(r)}${ctx ? ` (${ctx})` : ''}`
}

/**
 * Nome do sistema sem o parêntese explicativo, para título e descrição.
 * "Portal de Serviços (petição eletrônica)" -> "Portal de Serviços".
 * O nome completo continua no corpo da página; aqui o que importa é caber no resultado da busca.
 */
export function sistemaCurto(r: Regra): string {
  const completo = rotuloSistema(r)
  const parenteses = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(completo)
  if (!parenteses) return completo.trim()
  const [, antes, dentro] = parenteses
  /*
   * Quando o parêntese guarda a sigla — "Central do Processo Eletrônico (CPE)" — é ela que deve
   * ficar: é mais curta e é como o sistema é chamado. Quando guarda explicação — "Portal de
   * Serviços (petição eletrônica)" — o que fica é o nome, e a explicação sai.
   */
  const ehSigla = dentro.length <= 6 && dentro === dentro.toUpperCase() && /[A-Z]/.test(dentro)
  return (ehSigla ? dentro : antes).trim()
}

/** Como o tipo de peticionamento aparece no título e na descrição, curto o bastante para caber. */
export function contextoCurto(r: Regra): string {
  switch (r.tipo_peticionamento) {
    case 'principal':
      return 'documento principal'
    case 'anexos':
      return 'anexos'
    case 'inicial':
      return 'petição inicial'
    case 'intermediário':
      return 'petição intermediária'
    case 'recurso':
      return 'recursos'
    default:
      return ''
  }
}

/**
 * Título de página/SEO.
 *
 * A ordem não é estética: o Google corta o título perto de 60 caracteres, e o que precisa
 * sobreviver ao corte é a RESPOSTA — sigla, sistema e o valor do limite. Por isso o contexto
 * ("petição intermediária") vai para o fim, onde truncar não custa nada. Antes ele vinha na
 * frente e empurrava o limite para depois do caractere 90 em alguns tribunais.
 */
export function tituloRegra(r: Regra): string {
  const ctx = contextoCurto(r)
  return `Limite de PDF no ${sistemaCurto(r)} do ${r.tribunal_sigla}: ${formatLimite(r)}${ctx ? ` (${ctx})` : ''}`
}

/** Agrupa por tribunal preservando a ordem do arquivo. */
export function agruparPorTribunal(regras: Regra[]): Map<string, Regra[]> {
  const m = new Map<string, Regra[]>()
  for (const r of regras) {
    const k = `${r.tribunal_sigla} — ${r.tribunal_nome}`
    if (!m.has(k)) m.set(k, [])
    m.get(k)!.push(r)
  }
  return m
}

export function tribunalPorSigla(sigla: string): Tribunal | undefined {
  return TRIBUNAIS.find((t) => t.sigla === sigla)
}

/** Uma regra vista a partir de um tribunal: própria dele ou herdada de uma regra nacional que o abrange. */
export interface RegraDoTribunal {
  regra: Regra
  tribunal: Tribunal
  herdada: boolean
}

/** Regras que valem para o tribunal: as próprias primeiro; depois as nacionais que o abrangem (sem repetir o sistema). */
export function regrasDoTribunal(sigla: string, regras: Regra[] = regrasVigentes()): RegraDoTribunal[] {
  const tribunal = tribunalPorSigla(sigla)
  if (!tribunal) return []
  const proprias = regras.filter((r) => r.tribunal_sigla === sigla)
  const sistemasProprios = new Set(proprias.map((r) => r.sistema))
  const herdadas = regras.filter((r) => r.tribunal_sigla !== sigla && r.abrange?.includes(sigla) && !sistemasProprios.has(r.sistema))
  return [...proprias.map((regra) => ({ regra, tribunal, herdada: false })), ...herdadas.map((regra) => ({ regra, tribunal, herdada: true }))]
}

/** Tribunais com pelo menos uma regra (própria ou herdada), na ordem da lista oficial. */
export function tribunaisCobertos(regras: Regra[] = regrasVigentes()): Tribunal[] {
  return TRIBUNAIS.filter((t) => regrasDoTribunal(t.sigla, regras).length > 0)
}

/** Opções do seletor e do diretório, agrupadas por ramo, na ordem da lista de tribunais. */
export function opcoesPorRamo(regras: Regra[] = regrasVigentes()): Map<Ramo, RegraDoTribunal[]> {
  const m = new Map<Ramo, RegraDoTribunal[]>()
  for (const ramo of RAMOS) m.set(ramo, [])
  for (const t of TRIBUNAIS) m.get(t.ramo)!.push(...regrasDoTribunal(t.sigla, regras))
  for (const ramo of RAMOS) if (m.get(ramo)!.length === 0) m.delete(ramo)
  return m
}

export function slugTribunal(sigla: string): string {
  return slug(sigla).toLowerCase()
}

export function slugSistema(r: Regra): string {
  return slug(rotuloSistema(r)).toLowerCase().replace(/_/g, '-')
}

/** Id da página pública: o id da regra quando é própria; "<tribunal>-<sistema>" quando é herdada. */
export function idPagina(x: RegraDoTribunal): string {
  return x.herdada ? `${slugTribunal(x.tribunal.sigla)}-${slugSistema(x.regra)}` : x.regra.id
}

/** Todas as páginas públicas de regra: as próprias (inclusive em revisão) e as herdadas das regras nacionais. */
export function paginasDeRegras(): RegraDoTribunal[] {
  const out: RegraDoTribunal[] = []
  const ids = new Set<string>()
  for (const r of REGRAS.regras) {
    const tribunal = tribunalPorSigla(r.tribunal_sigla) ?? { sigla: r.tribunal_sigla, nome: r.tribunal_nome, ramo: 'estadual' as Ramo }
    out.push({ regra: r, tribunal, herdada: false })
    ids.add(r.id)
  }
  for (const t of TRIBUNAIS) {
    for (const x of regrasDoTribunal(t.sigla)) {
      if (!x.herdada) continue
      const id = idPagina(x)
      if (ids.has(id)) continue
      ids.add(id)
      out.push(x)
    }
  }
  return out
}

/** Título de uma regra vista de um tribunal (herdada ou não). */
export function tituloRegraDoTribunal(x: RegraDoTribunal): string {
  return tituloRegra({ ...x.regra, tribunal_sigla: x.tribunal.sigla })
}
