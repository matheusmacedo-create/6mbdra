import data from '../../data/regras.json'

export type Unidade = 'MB' | 'MiB' | 'KB'
export type Situacao = 'vigente' | 'em_revisao' | 'substituida'

export interface Regra {
  /** Chave estável (slug), ex.: tjrj-pje-2grau-inicial */
  id: string
  tribunal_sigla: string
  tribunal_nome: string
  sistema: string
  instancia: string
  tipo_peticionamento: string
  formato: 'PDF'
  limite_valor: number
  limite_unidade: Unidade
  /** Sobrescreve o percentual padrão da meta segura, se necessário */
  meta_segura_percentual?: number
  fonte_url: string
  fonte_titulo: string
  /** Trecho literal da fonte que declara o limite */
  fonte_trecho?: string
  /** O trecho está numa imagem da página (o monitor não confere o texto) */
  trecho_em_imagem?: boolean
  data_fonte?: string
  verificado_em: string
  situacao: Situacao
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

/** Limite declarado, em bytes (leitura conservadora do MB como decimal). */
export function limiteBytes(r: Regra): number {
  return Math.round(r.limite_valor * UNIDADE_BYTES[r.limite_unidade])
}

/** Meta segura em bytes: limite × percentual (spec §8.1). */
export function metaBytes(r: Regra, percentualPadrao = REGRAS.meta_segura_percentual_padrao): number {
  const pct = r.meta_segura_percentual ?? percentualPadrao
  return Math.floor((limiteBytes(r) * pct) / 100)
}

export function regraPorId(id: string): Regra | undefined {
  return REGRAS.regras.find((r) => r.id === id)
}

export function regrasVigentes(): Regra[] {
  return REGRAS.regras.filter((r) => r.situacao !== 'substituida')
}

/** Rótulo curto para listas: "TJRJ · PJe · 6 MB (2º grau, petição inicial)" */
export function rotuloRegra(r: Regra): string {
  const ctx = [r.instancia, r.tipo_peticionamento].filter((x) => x && x !== 'não se aplica' && x !== 'geral').join(', ')
  return `${r.tribunal_sigla} · ${r.sistema} · ${formatLimite(r)}${ctx ? ` (${ctx})` : ''}`
}

export function formatLimite(r: Regra): string {
  return `${r.limite_valor.toLocaleString('pt-BR')} ${r.limite_unidade}`
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
