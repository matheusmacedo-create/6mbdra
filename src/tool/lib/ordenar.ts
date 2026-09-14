/**
 * Ordem de protocolo a partir do nome do arquivo.
 *
 * Por que só o nome: ler o conteúdo exigiria uma camada de texto que a maioria destes documentos
 * não tem — são digitalizações, que é justamente o caso que esta ferramenta existe para resolver.
 * Nome de arquivo, ao contrário, é o que o escritório já usa para se organizar, e a leitura é
 * instantânea, previsível e acontece sem o documento sair do navegador.
 *
 * A ordem é uma sugestão: quem monta a petição decide, e a lista tem setas para ajustar.
 */

/** Prefixo numérico explícito: "01 - peticao", "1.procuracao", "2) rg". Quem numerou, mandou. */
const PREFIXO_NUMERICO = /^\s*(\d{1,3})\s*[-_.)\]]?\s+|^\s*(\d{1,3})\s*[-_.)\]]/

/**
 * Ordem convencional de uma petição eletrônica. Não é norma — é como as peças costumam ser
 * apresentadas: a peça primeiro, depois representação, depois provas, e as guias por último.
 */
const TIPOS: { padrao: RegExp; posicao: number; rotulo: string }[] = [
  { padrao: /peti[çc][ãa]o|inicial|contesta[çc][ãa]o|r[ée]plica|recurso|apela[çc][ãa]o|agravo|embargos|manifesta[çc][ãa]o|impugna[çc][ãa]o/i, posicao: 10, rotulo: 'peça' },
  { padrao: /procura[çc][ãa]o/i, posicao: 20, rotulo: 'procuração' },
  { padrao: /substabelec/i, posicao: 21, rotulo: 'substabelecimento' },
  { padrao: /hipossuf|gratuidade|declara[çc][ãa]o\s*de\s*pobreza/i, posicao: 22, rotulo: 'gratuidade' },
  { padrao: /contrato\s*social|estatuto|cart[ãa]o\s*cnpj|ata\s*de/i, posicao: 30, rotulo: 'atos constitutivos' },
  { padrao: /\b(rg|cpf|cnh|identidade)\b|documento\s*pessoal/i, posicao: 40, rotulo: 'documento pessoal' },
  { padrao: /resid[êe]ncia/i, posicao: 41, rotulo: 'comprovante de residência' },
  { padrao: /contrato/i, posicao: 50, rotulo: 'contrato' },
  { padrao: /laudo|per[íi]cia|parecer|v[íi]storia/i, posicao: 60, rotulo: 'laudo' },
  { padrao: /comprovante|recibo|pagamento|transfer[êe]ncia|dep[óo]sito|pix/i, posicao: 70, rotulo: 'comprovante' },
  { padrao: /nota\s*fiscal|\bnfe?\b|fatura|boleto/i, posicao: 71, rotulo: 'nota fiscal' },
  { padrao: /extrato/i, posicao: 72, rotulo: 'extrato' },
  { padrao: /notifica[çc][ãa]o|carta|e-?mail|whats/i, posicao: 80, rotulo: 'notificação' },
  { padrao: /boletim|ocorr[êe]ncia|\bb\.?o\.?\b/i, posicao: 81, rotulo: 'boletim de ocorrência' },
  { padrao: /certid[ãa]o/i, posicao: 82, rotulo: 'certidão' },
  { padrao: /guia|custas|darf|\bgru\b|preparo/i, posicao: 90, rotulo: 'guia/custas' },
  { padrao: /anexo|outros/i, posicao: 95, rotulo: 'anexo' },
]

/** Sem tipo reconhecido: vai para o meio, entre as provas nomeadas e os anexos genéricos. */
const POSICAO_PADRAO = 85

export interface Classificacao {
  /** Número escrito pela pessoa no começo do nome, quando existe */
  numero?: number
  /** Posição convencional do tipo de documento */
  posicao: number
  /** Tipo reconhecido, para explicar a ordem na interface */
  rotulo?: string
}

function semAcento(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export function classificar(nome: string): Classificacao {
  const semExtensao = nome.replace(/\.pdf$/i, '')
  const m = PREFIXO_NUMERICO.exec(semExtensao)
  const numero = m ? Number(m[1] ?? m[2]) : undefined
  // Compara com e sem acento: "peticao" e "petição" caem no mesmo tipo.
  const tipo = TIPOS.find((t) => t.padrao.test(semExtensao) || t.padrao.test(semAcento(semExtensao)))
  return { numero: Number.isFinite(numero) ? numero : undefined, posicao: tipo?.posicao ?? POSICAO_PADRAO, rotulo: tipo?.rotulo }
}

/**
 * Compara dois nomes pela ordem de protocolo. Numeração explícita vence tudo; depois o tipo do
 * documento; e, no empate, o nome em ordem natural (doc2 antes de doc10).
 */
export function compararNomes(a: string, b: string): number {
  const ca = classificar(a)
  const cb = classificar(b)
  if (ca.numero !== undefined && cb.numero !== undefined && ca.numero !== cb.numero) return ca.numero - cb.numero
  if (ca.numero !== undefined && cb.numero === undefined) return -1
  if (ca.numero === undefined && cb.numero !== undefined) return 1
  if (ca.posicao !== cb.posicao) return ca.posicao - cb.posicao
  return a.localeCompare(b, 'pt-BR', { numeric: true, sensitivity: 'base' })
}

/** Ordena uma lista qualquer pelo nome do documento, sem alterar a lista original. */
export function ordenarPorNome<T>(itens: readonly T[], nomeDe: (item: T) => string): T[] {
  return [...itens].sort((x, y) => compararNomes(nomeDe(x), nomeDe(y)))
}
