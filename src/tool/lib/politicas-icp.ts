/**
 * As políticas de assinatura PAdES aprovadas pela ICP-Brasil (DOC-ICP-15).
 *
 * SONDA DA ETAPA 0 — dependência 2 da especificação do Conferidor ("tratamento das políticas
 * brasileiras do DOC-ICP-15"). A pergunta era se dá para tratar essas políticas sem servidor.
 *
 * A resposta é sim, e mais barata do que parecia: a lista oficial de políticas aprovadas para PDF
 * é um arquivo de 2,9 KB publicado em http://politicas.icpbrasil.gov.br/LPA_PAdES.der, com 18
 * políticas em quatro famílias. É pequena o bastante para viver no código, e muda raramente — as
 * entradas atuais valem até 2029.
 *
 * CUIDADO DE VOCABULÁRIO, o mesmo do resto do módulo: saber QUAL política o arquivo declara não é
 * o mesmo que verificar que ele CUMPRE aquela política. Cumprir exige checar cadeia, revogação e
 * carimbo do tempo, que esta sonda não faz. Por isso os campos abaixo se chamam "declarada".
 */

/** As quatro famílias do DOC-ICP-15, pelo ramo do OID. */
const FAMILIAS: Record<string, { sigla: string; nome: string; exige: string }> = {
  '11': {
    sigla: 'AD-RB',
    nome: 'Assinatura Digital com Referência Básica',
    exige: 'Confere quem assinou e se o conteúdo mudou. Não prova quando foi assinado.',
  },
  '12': {
    sigla: 'AD-RT',
    nome: 'Assinatura Digital com Referência do Tempo',
    exige: 'O mesmo da básica, mais um carimbo do tempo que prova a data da assinatura.',
  },
  '13': {
    sigla: 'AD-RC',
    nome: 'Assinatura Digital com Referências Completas',
    exige: 'Carrega dentro do arquivo as provas de que o certificado valia na hora da assinatura.',
  },
  '14': {
    sigla: 'AD-RA',
    nome: 'Assinatura Digital com Referências para Arquivamento',
    exige: 'Feita para durar décadas: acumula carimbos do tempo para sobreviver ao envelhecimento.',
  },
}

export interface PoliticaDeclarada {
  oid: string
  sigla: string
  nome: string
  exige: string
  /** A política está na lista oficial de aprovadas para PDF? */
  aprovada: boolean
}

/*
 * Os 18 OIDs do LPA_PAdES.der, lidos do arquivo oficial. Ficam explícitos, e não derivados por
 * regra, porque a lista é a fonte da verdade: se a ICP publicar uma versão nova fora do padrão que
 * o ramo sugere, um OID inventado por regra aceitaria algo que não está aprovado.
 */
export const OIDS_PADES_APROVADOS: readonly string[] = [
  '2.16.76.1.7.1.11.1', '2.16.76.1.7.1.11.1.1', '2.16.76.1.7.1.11.1.2', '2.16.76.1.7.1.11.1.3',
  '2.16.76.1.7.1.12.1', '2.16.76.1.7.1.12.1.1', '2.16.76.1.7.1.12.1.2', '2.16.76.1.7.1.12.1.3',
  '2.16.76.1.7.1.13.1', '2.16.76.1.7.1.13.1.1', '2.16.76.1.7.1.13.1.2', '2.16.76.1.7.1.13.1.3',
  '2.16.76.1.7.1.13.1.4',
  '2.16.76.1.7.1.14.1', '2.16.76.1.7.1.14.1.1', '2.16.76.1.7.1.14.1.2', '2.16.76.1.7.1.14.1.3',
  '2.16.76.1.7.1.14.1.4',
]

/** OID do atributo assinado signature-policy-identifier (RFC 5126). */
export const OID_ATRIBUTO_POLITICA = '1.2.840.113549.1.9.16.2.15'

/**
 * Traduz o OID declarado numa assinatura para a política da ICP-Brasil, quando reconhecida.
 *
 * Devolve null para OID de fora do arco brasileiro — um PDF assinado com política estrangeira ou
 * sem política nenhuma é comum e não é defeito.
 */
export function politicaDoOid(oid: string): PoliticaDeclarada | null {
  const m = /^2\.16\.76\.1\.7\.1\.(\d+)\./.exec(`${oid}.`)
  if (!m) return null
  const fam = FAMILIAS[m[1]]
  if (!fam) return null
  return { oid, ...fam, aprovada: OIDS_PADES_APROVADOS.includes(oid) }
}
