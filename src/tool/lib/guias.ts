/**
 * Ligação entre os guias e o resto do site.
 *
 * O problema que isto resolve é de estrutura, não de conteúdo. Medindo os links internos do site
 * construído, seis guias tinham UM único link de entrada — o do índice — e nenhuma das 101 páginas
 * de tribunal apontava para guia nenhum. Ou seja: 73% das páginas do site não passavam nada para o
 * conteúdo, e o conteúdo novo nascia praticamente órfão.
 *
 * Duas ligações, com naturezas diferentes:
 *
 * 1. `guiasDoTribunal` — da página de tribunal para os guias. A escolha vem dos DADOS daquele
 *    tribunal (exige PDF/A? tem limite por página? o limite é apertado?), então páginas diferentes
 *    listam guias diferentes. Isso é deliberado: o mesmo bloco repetido em 101 páginas seria
 *    boilerplate, que o buscador desconta e que não ajuda ninguém a ler.
 *
 * 2. `relacionados` — de um guia para os outros, por afinidade de tema. Escala sozinho: guia novo
 *    entra na malha no mesmo build, sem ninguém editar lista nenhuma. Isso importa porque há uma
 *    rotina diária criando guias.
 */

export interface GuiaRef {
  id: string
  data: { title: string; description: string; tags: string[] }
}

/** Sinais de um tribunal que mudam quais guias fazem sentido ali. */
export interface SinaisDoTribunal {
  /** Id da regra. Só serve para girar os guias universais de forma estável. */
  id: string
  limiteMb: number
  exigePdfa?: boolean
  limitePorPaginaKb?: number
  limiteTotalPeticaoMb?: number
}

/*
 * Guias citados por slug. Renomear um guia sem ajustar aqui derrubaria o link — por isso
 * `guiasDoTribunal` descarta slug que não existe na coleção, e há teste que quebra se algum destes
 * sumir. Falhar no teste é melhor que sumir em silêncio de 101 páginas.
 */
const RECUSA = 'o-sistema-recusou-meu-pdf-causas-e-solucoes'
const CHECKLIST = 'checklist-antes-de-protocolar-anexos-em-pdf'
const LIMITES = 'limite-por-arquivo-pagina-e-peticao'
const PDFA = 'pdf-a-quando-o-tribunal-exige'
const MB_MIB = 'diferenca-entre-mb-e-mib-nos-portais-de-upload'
const CELULAR = 'digitalizar-pelo-celular-sem-arquivo-gigante'
const DIVIDIR = 'como-dividir-pdf-por-tamanho-sem-perder-a-ordem'
const NOMEAR = 'como-nomear-anexos-do-protocolo'
const ASSINAR = 'por-que-comprimir-antes-de-assinar-digitalmente'
const OCR = 'o-que-e-ocr-e-texto-pesquisavel-no-pdf'
const SENHA = 'pdf-com-senha-assinado-ou-corrompido-o-que-fazer'
const QUANTAS = 'quantas-paginas-cabem-num-pdf-dentro-do-limite'
const VERIFICAR = 'como-verificar-a-assinatura-digital-de-um-pdf'
const METADADOS = 'metadados-do-pdf-o-que-voce-esta-entregando-sem-saber'

export const SLUGS_CITADOS = [RECUSA, CHECKLIST, LIMITES, PDFA, MB_MIB, CELULAR, DIVIDIR, NOMEAR, ASSINAR, OCR, SENHA, QUANTAS, VERIFICAR, METADADOS]

/** Quantos guias no máximo cabem no bloco da página de tribunal, antes de virar lista sem peso. */
const MAX_POR_TRIBUNAL = 4

/*
 * Guias que valem em qualquer tribunal. São relevantes nos 101, e é justamente aí que está a
 * armadilha: listar sempre os mesmos quatro faria 101 páginas com bloco idêntico — o boilerplate
 * que este arquivo existe para evitar.
 *
 * Como a escolha entre eles é genuinamente arbitrária (todos cabem), o desempate é uma rotação
 * estável pelo id do tribunal. O resultado é o mesmo em todo build (nada de bloco que muda sozinho
 * entre deploys), cada página mostra um recorte diferente, e o peso de link se espalha pelos guias
 * em vez de empilhar em três.
 */
const UNIVERSAIS: { slug: string; motivo: string }[] = [
  { slug: RECUSA, motivo: 'as oito causas de recusa no envio e a saída de cada uma' },
  { slug: NOMEAR, motivo: 'acento, espaço e símbolo no nome do arquivo derrubam upload em vários sistemas' },
  { slug: CHECKLIST, motivo: 'a conferência final antes de clicar em protocolar' },
  { slug: ASSINAR, motivo: 'comprimir depois de assinar quebra a assinatura — a ordem importa' },
  { slug: OCR, motivo: 'PDF sem camada de texto não é pesquisável pelo tribunal nem pela parte contrária' },
  { slug: SENHA, motivo: 'documento com senha, assinado ou corrompido trava o envio de formas diferentes' },
  { slug: VERIFICAR, motivo: 'conferir se a assinatura do PDF sobreviveu ao preparo, antes de descobrir pela recusa' },
  { slug: METADADOS, motivo: 'o PDF protocolado leva junto seu nome, o programa usado e às vezes versões antigas do texto' },
]

/** Índice estável a partir do id, para a rotação não mudar entre builds. */
function giro(id: string): number {
  let n = 0
  for (let i = 0; i < id.length; i++) n = (n * 31 + id.charCodeAt(i)) % 100_000
  return n
}

/**
 * Guias que fazem sentido para um tribunal específico, com o motivo escrito.
 *
 * O motivo não é enfeite: ele é o que diferencia este bloco de uma lista de links. Quem lê entende
 * por que aquele guia está ali naquela página, e o buscador vê texto diferente em cada uma.
 */
export function guiasDoTribunal(s: SinaisDoTribunal, todos: GuiaRef[]): { guia: GuiaRef; motivo: string }[] {
  const existe = new Map(todos.map((g) => [g.id, g]))
  const escolhas: { slug: string; motivo: string }[] = []

  // Específicos primeiro: valem só para alguns tribunais, e por isso valem mais que os universais.
  if (s.exigePdfa) {
    escolhas.push({ slug: PDFA, motivo: 'este tribunal exige PDF/A — a ordem entre converter, comprimir e assinar muda o resultado' })
  }
  if (s.limitePorPaginaKb || s.limiteTotalPeticaoMb) {
    escolhas.push({ slug: LIMITES, motivo: 'aqui não há só um limite: o arquivo pode caber e a petição inteira estourar mesmo assim' })
  }
  if (s.limiteMb <= 5) {
    escolhas.push({ slug: CELULAR, motivo: `com ${formatoCurto(s.limiteMb)} de teto, digitalização mal ajustada estoura o limite sozinha` })
    escolhas.push({ slug: MB_MIB, motivo: 'em limite apertado, a diferença entre MB e MiB decide se o arquivo passa' })
  } else if (s.limiteMb <= 15) {
    escolhas.push({ slug: DIVIDIR, motivo: 'quando nem a compressão resolve, dividir mantém a ordem e a leitura do documento' })
  } else {
    // Teto folgado: o problema deixa de ser caber e passa a ser o que chega junto do arquivo.
    escolhas.push({ slug: QUANTAS, motivo: `com ${formatoCurto(s.limiteMb)} de teto, cabe muita página — mas depende de como o PDF foi gerado` })
  }

  // Completa com universais, girando pelo tribunal para o bloco não repetir de página em página.
  const g = giro(s.id)
  for (let i = 0; i < UNIVERSAIS.length; i++) escolhas.push(UNIVERSAIS[(g + i) % UNIVERSAIS.length])

  const vistos = new Set<string>()
  const saida: { guia: GuiaRef; motivo: string }[] = []
  for (const e of escolhas) {
    if (saida.length >= MAX_POR_TRIBUNAL) break
    const guia = existe.get(e.slug)
    if (!guia || vistos.has(e.slug)) continue
    vistos.add(e.slug)
    saida.push({ guia, motivo: e.motivo })
  }
  return saida
}

function formatoCurto(mb: number): string {
  return `${mb.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`
}

/*
 * As etiquetas dos guias foram escritas à mão ao longo do tempo e por sessões diferentes, então
 * vêm com maiúscula trocada, acento e singular/plural misturados ("PDF" e "pdf", "PJe" e "pje",
 * "peticionamento" e "peticionamento eletrônico"). Comparar sem normalizar acharia menos afinidade
 * do que existe de verdade.
 */
function normalizar(tag: string): string {
  return tag
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+eletronico$/, '')
    .trim()
}

/**
 * Guias relacionados, por etiquetas em comum.
 *
 * Empate é resolvido pelo título, e não por data ou ordem do disco, para o resultado ser estável
 * entre builds — bloco que muda de conteúdo sem o conteúdo mudar é ruído no diff e no rastreamento.
 */
export function relacionados(atual: GuiaRef, todos: GuiaRef[], n = 4): GuiaRef[] {
  const meu = new Set(atual.data.tags.map(normalizar))
  return todos
    .filter((g) => g.id !== atual.id)
    .map((g) => ({ g, peso: g.data.tags.map(normalizar).filter((t) => meu.has(t)).length }))
    .filter((x) => x.peso > 0)
    .sort((a, b) => b.peso - a.peso || a.g.data.title.localeCompare(b.g.data.title, 'pt-BR'))
    .slice(0, n)
    .map((x) => x.g)
}

/**
 * Temas do índice de guias.
 *
 * Uma lista plana de 22 itens (e crescendo todo dia) não diz a ninguém o que o site cobre. Agrupar
 * por tema dá ao leitor um mapa e ao buscador um sinal de que existe profundidade no assunto, não
 * páginas soltas. A ordem é a do problema real: primeiro o erro que trouxe a pessoa, depois o que
 * ela precisa fazer.
 */
export const TEMAS: { titulo: string; descricao: string; tags: string[] }[] = [
  {
    titulo: 'Quando o sistema recusa o arquivo',
    descricao: 'O que fazer quando o envio falha, e como não chegar nesse ponto.',
    tags: ['erro de upload', 'pdf corrompido', 'senha', 'checklist'],
  },
  {
    titulo: 'Limites de tamanho',
    descricao: 'Quanto cabe, onde o limite é medido e o que fazer quando não cabe.',
    tags: ['tamanho de arquivo', 'limites', 'dividir pdf', 'compactar pdf'],
  },
  {
    titulo: 'Digitalização e OCR',
    descricao: 'Do papel ao PDF legível, sem gerar um arquivo gigante.',
    tags: ['digitalizacao', 'ocr', 'scanner', 'celular'],
  },
  {
    titulo: 'Converter e organizar',
    descricao: 'Word, imagem, páginas fora de ordem e anexos com nome errado.',
    tags: ['converter word', 'converter imagem', 'converter pdf', 'organizacao', 'anexos', 'extrair paginas', 'girar pdf', 'numeracao de paginas'],
  },
  {
    titulo: 'Assinatura digital e PDF/A',
    descricao: 'O que a assinatura exige, e a ordem certa entre assinar, converter e comprimir.',
    tags: ['assinatura digital', 'assinatura eletronica', 'icp-brasil', 'pdf/a', 'formato'],
  },
]

/** Distribui os guias entre os temas. Cada guia aparece uma vez só, no primeiro tema que o acolhe. */
export function porTema(todos: GuiaRef[]): { titulo: string; descricao: string; guias: GuiaRef[] }[] {
  const usados = new Set<string>()
  const grupos = TEMAS.map((t) => {
    const alvo = new Set(t.tags.map(normalizar))
    const guias = todos
      .filter((g) => !usados.has(g.id) && g.data.tags.some((tag) => alvo.has(normalizar(tag))))
      .sort((a, b) => a.data.title.localeCompare(b.data.title, 'pt-BR'))
    guias.forEach((g) => usados.add(g.id))
    return { titulo: t.titulo, descricao: t.descricao, guias }
  })
  // Guia que não casou com tema nenhum não pode sumir da página — é o único caminho até ele.
  const sobra = todos.filter((g) => !usados.has(g.id)).sort((a, b) => a.data.title.localeCompare(b.data.title, 'pt-BR'))
  if (sobra.length) grupos.push({ titulo: 'Outros guias', descricao: 'Assuntos que não se encaixam nos grupos acima.', guias: sobra })
  return grupos.filter((g) => g.guias.length > 0)
}

/**
 * Página de tamanho-alvo que corresponde a este tribunal.
 *
 * As sete páginas `/comprimir-pdf-para-<X>/` nasceram com UM link de entrada cada — o mesmo estado
 * de quase-órfão que este arquivo existe para corrigir nos guias. A ponte natural é o tribunal cujo
 * limite é exatamente aquele número: quem procura "comprimir pdf para 5 MB" e quem protocola num
 * tribunal de 5 MB estão atrás da mesma coisa.
 *
 * Só casamento EXATO vale. Sugerir "comprimir para 2 MB" a quem tem teto de 3 MB seria mandar a
 * pessoa apertar o arquivo mais do que precisa — perda de qualidade sem motivo. Por isso um
 * tribunal de 3 MB não recebe link nenhum aqui, e tudo bem.
 */
export function alvoDoTribunal<T extends { slug: string; mb: number; rotulo: string; ctaRegraId?: string }>(
  regraId: string,
  limiteMb: number,
  alvos: T[],
): T | null {
  // O alvo que aponta para esta regra ganha: é o caso das metas em KB, que são limite por página e
  // não bateriam com o limite por arquivo comparando número com número.
  const porRegra = alvos.find((a) => a.ctaRegraId === regraId)
  if (porRegra) return porRegra
  return alvos.find((a) => Math.abs(a.mb - limiteMb) < 0.001) ?? null
}
