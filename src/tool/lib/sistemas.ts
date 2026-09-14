/**
 * Sistemas de peticionamento como eixo de navegação.
 *
 * A base é organizada por tribunal, mas quem busca quase nunca busca por tribunal: busca pelo
 * sistema que está na frente dele ("limite de anexo no PJe", "tamanho máximo e-SAJ"). Este módulo
 * agrupa as regras por sistema para existir uma página por sistema, com a tabela de todos os
 * tribunais que o usam.
 */
import { REGRAS, TRIBUNAIS, regrasDoTribunal, regrasVigentes, rotuloSistema, slugSistema, tribunalPorSigla, type Regra, type RegraDoTribunal, type Tribunal } from './regras'

export interface Sistema {
  /** Trecho da URL: /sistemas/<slug>/ */
  slug: string
  /** Como o sistema se chama na tela do tribunal */
  nome: string
  /** Outros nomes pelos quais as pessoas se referem a ele (entram no texto da página) */
  tambemChamado: string[]
  /** Uma frase sobre o que é o sistema, sem adjetivo de marketing */
  oQueE: string
  regras: RegraDoTribunal[]
  tribunais: Tribunal[]
}

/** Texto de apoio por sistema. Só o que é verificável; nada de "o melhor" ou "o mais usado". */
const DESCRICOES: Record<string, { tambemChamado: string[]; oQueE: string }> = {
  pje: {
    tambemChamado: ['Processo Judicial Eletrônico', 'PJE'],
    oQueE:
      'Sistema do Conselho Nacional de Justiça usado por tribunais estaduais, federais, do trabalho, eleitorais e militares. Cada tribunal publica o próprio limite de anexo, então o valor muda de um para outro.',
  },
  'pje-jt': {
    tambemChamado: ['PJe da Justiça do Trabalho', 'PJe-JT'],
    oQueE:
      'Versão do PJe usada pelos Tribunais Regionais do Trabalho. O limite por arquivo é definido em norma do Conselho Superior da Justiça do Trabalho e vale para todos os TRTs.',
  },
  eproc: {
    tambemChamado: ['e-proc', 'eproc JF', 'eproc TJ'],
    oQueE:
      'Sistema desenvolvido pela Justiça Federal da 4ª Região e adotado por tribunais federais e estaduais. O limite costuma ser por arquivo e por sessão de upload.',
  },
  'e-saj': {
    tambemChamado: ['eSAJ', 'e-SAJ', 'SAJ', 'Portal e-SAJ'],
    oQueE:
      'Portal da Softplan usado por tribunais de justiça estaduais para peticionamento e consulta. O limite por arquivo é informado na própria tela de anexar documentos.',
  },
  projudi: {
    tambemChamado: ['Projudi', 'PROJUDI'],
    oQueE: 'Sistema de processo eletrônico usado por tribunais estaduais, com limite por arquivo definido por cada tribunal.',
  },
}

/*
 * Sistemas usados por um tribunal só (e-STF, CPE, JPe-Themis, SPE/SRRE…) ficam de fora de
 * propósito: a página de hub repetiria a página daquele tribunal, palavra por palavra. Página fina
 * e duplicada não ajuda quem busca nem o buscador. Eles seguem listados no diretório de tribunais.
 */

/** Sistemas que ganham página própria: os que têm descrição escrita e pelo menos uma regra. */
export function sistemas(): Sistema[] {
  const porSlug = new Map<string, { nome: string; regras: RegraDoTribunal[]; siglas: Set<string> }>()
  const vigentes = regrasVigentes()

  for (const t of TRIBUNAIS) {
    for (const x of regrasDoTribunal(t.sigla, vigentes)) {
      const slug = slugSistema(x.regra)
      const atual = porSlug.get(slug) ?? { nome: rotuloSistema(x.regra), regras: [], siglas: new Set<string>() }
      atual.regras.push(x)
      atual.siglas.add(t.sigla)
      porSlug.set(slug, atual)
    }
  }

  return [...porSlug.entries()]
    .filter(([slug]) => DESCRICOES[slug])
    .map(([slug, v]) => ({
      slug,
      nome: v.nome,
      ...DESCRICOES[slug],
      regras: v.regras,
      tribunais: [...v.siglas].map((s) => tribunalPorSigla(s)).filter((t): t is Tribunal => t !== undefined),
    }))
    // Mais tribunais primeiro: é a ordem em que as páginas importam.
    .sort((a, b) => b.tribunais.length - a.tribunais.length || a.nome.localeCompare(b.nome, 'pt-BR'))
}

export function sistemaPorSlug(slug: string): Sistema | undefined {
  return sistemas().find((s) => s.slug === slug)
}

/** Menor e maior limite declarado do sistema, para a página dizer a faixa sem inventar média. */
export function faixaDeLimites(s: Sistema): { min: Regra; max: Regra } | undefined {
  const ordenadas = [...s.regras].map((x) => x.regra).sort((a, b) => a.limite_valor - b.limite_valor)
  if (ordenadas.length === 0) return undefined
  return { min: ordenadas[0], max: ordenadas[ordenadas.length - 1] }
}

export const TOTAL_DE_REGRAS = REGRAS.regras.length
