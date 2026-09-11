import data from '../../data/regras.json'

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

/** Título de página/SEO com o contexto quando não é a regra geral. */
export function tituloRegra(r: Regra): string {
  const base = `no ${rotuloSistema(r)} do ${r.tribunal_sigla}: ${formatLimite(r)}`
  switch (r.tipo_peticionamento) {
    case 'principal':
      return `Limite do documento principal (opção "Arquivo PDF") ${base}`
    case 'anexos':
      return `Limite dos anexos em PDF ${base}`
    case 'inicial':
      return `Limite de PDF na petição inicial ${base}`
    case 'intermediário':
      return `Limite de PDF na petição intermediária ${base}`
    case 'recurso':
      return `Limite de PDF em recursos ${base}`
    default:
      return `Limite de PDF ${base}`
  }
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
