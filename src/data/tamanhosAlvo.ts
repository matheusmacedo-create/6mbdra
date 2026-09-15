/**
 * Alvos de "comprimir pdf para X" com demanda de busca própria (ver mapa de palavras-chave).
 * Cada entrada cita regras reais de src/data/regras.json — os números do texto nunca são
 * hardcoded fora daqui, então continuam corretos se a base de regras mudar.
 */
export interface Alvo {
  /** Segmento da URL: /comprimir-pdf-para-<slug>/ */
  slug: string
  /** Limite manual (MB decimal) para o link ?limiteMb=, quando não há uma regra específica melhor. */
  mb: number
  rotulo: string
  titulo: string
  descricao: string
  /** Quando o alvo bate com uma regra real, o link vai direto para ela (?regra=), que já aplica limite por página quando existe. */
  ctaRegraId?: string
  /** Regras citadas no texto, para os números virem sempre da base (nunca hardcoded). */
  citarIds: string[]
  porPagina: boolean
  contexto: string
  dica: string
}

export const ALVOS: Alvo[] = [
  {
    slug: '100kb',
    mb: 0.1,
    rotulo: '100 KB',
    titulo: 'Comprimir PDF para 100 KB: o limite por página do TJAL',
    descricao: 'O e-SAJ do TJAL aceita só 100 KB por página, não por arquivo. Veja quando essa meta é real, quando é quase impossível, e como preparar o PDF certo.',
    ctaRegraId: 'tjal-esaj',
    citarIds: ['tjal-esaj'],
    porPagina: true,
    contexto:
      'É o limite mais apertado da base: o e-SAJ do TJAL aceita só 100 KB por página, não por arquivo inteiro. Quem busca esse número normalmente está diante dessa regra específica, não escolhendo um alvo arbitrário.',
    dica:
      'Um PDF de texto puro (petição exportada do editor) cabe fácil. Uma página digitalizada só cabe em 100 KB com preto e branco, resolução baixa (150 dpi) e pouco conteúdo gráfico — carimbo, foto ou assinatura complexa tornam a meta praticamente inatingível sem perder legibilidade.',
  },
  {
    slug: '300kb',
    mb: 0.3,
    rotulo: '300 KB',
    titulo: 'Comprimir PDF para 300 KB: o limite por página do TJSP',
    descricao: 'O e-SAJ do TJSP libera até 30 MB por arquivo, mas cada página precisa caber em 300 KB. Entenda a diferença e comprima sem sair do navegador.',
    ctaRegraId: 'tjsp-esaj',
    citarIds: ['tjsp-esaj'],
    porPagina: true,
    contexto:
      'O e-SAJ do TJSP aceita até 30 MB por arquivo, mas limita cada página a 300 KB — por isso um PDF pequeno ainda pode ser recusado, se uma única página digitalizada pesar mais que isso.',
    dica:
      'Esse é um limite por página, não pela soma do arquivo: comprimir o arquivo inteiro sem considerar isso pode deixar uma página específica (a mais escura ou mais colorida) acima do limite mesmo com o total dentro do esperado.',
  },
  {
    slug: '500kb',
    mb: 0.5,
    rotulo: '500 KB',
    titulo: 'Comprimir PDF para 500 KB: a margem abaixo do menor limite',
    descricao: 'Nenhum tribunal da base exige exatamente 500 KB — é o piso da ferramenta, útil como margem extra abaixo do menor limite real, que é 1 MB.',
    citarIds: ['tjal-esaj', 'tjam-esaj'],
    porPagina: false,
    contexto:
      'Não é o limite de nenhum tribunal na nossa base — o menor limite por arquivo conhecido é 1 MB (TJAL e TJAM, no e-SAJ). 500 KB funciona como margem de segurança extra: para quem vai reenviar o mesmo documento por e-mail ou WhatsApp depois do protocolo, ou juntar vários anexos pequenos sem se aproximar de nenhum teto.',
    dica:
      'É também o menor valor que a ferramenta aceita como limite manual. Abaixo disso, a compressão de imagem já compromete a legibilidade na maioria dos documentos digitalizados — o caminho vira reduzir a resolução na origem, não espremer mais o arquivo pronto.',
  },
  {
    slug: '1mb',
    mb: 1,
    rotulo: '1 MB',
    titulo: 'Comprimir PDF para 1 MB: o limite do e-SAJ em TJAL e TJAM',
    descricao: '1 MB é o menor limite por arquivo entre os 53 tribunais da base, usado no e-SAJ de TJAL e TJAM. Comprima no navegador, sem enviar o documento.',
    ctaRegraId: 'tjal-esaj',
    citarIds: ['tjal-esaj', 'tjam-esaj'],
    porPagina: false,
    contexto: 'O e-SAJ aceita até 1 MB por arquivo em dois tribunais da base: TJAL e TJAM — o menor limite por arquivo entre os 53 tribunais cobertos.',
    dica:
      'Nesses dois tribunais o limite por página é ainda mais apertado (100 KB no TJAL, 150 KB no TJAM). Um documento de poucas páginas de texto cabe sem esforço; várias páginas digitalizadas em cor costumam exigir divisão em partes, não só compressão.',
  },
  {
    slug: '2mb',
    mb: 2,
    rotulo: '2 MB',
    titulo: 'Comprimir PDF para 2 MB: o limite do SPE no TRT3',
    descricao: 'O SPE do TRT3 aceita até 2 MB por arquivo. Veja quando a compressão resolve sozinha e quando dividir em partes é o caminho certo.',
    ctaRegraId: 'trt3-spe',
    citarIds: ['trt3-spe'],
    porPagina: false,
    contexto: 'É o limite do SPE (Sistema de Peticionamento Eletrônico) do TRT3, usado nos processos que ainda não migraram para o PJe.',
    dica: 'Documentos de texto exportados direto do editor cabem tranquilamente. Digitalizações em cor de várias páginas costumam precisar de divisão, não só de compressão — veja quando cada uma faz mais sentido.',
  },
  {
    slug: '5mb',
    mb: 5,
    rotulo: '5 MB',
    titulo: 'Comprimir PDF para 5 MB: o limite em TJMG, TJRJ e TRF5',
    descricao: '5 MB é o limite por arquivo em vários tribunais — TJMG, TJRJ e TRF5 entre eles. Comprima seus PDFs até esse alvo, sem sair do navegador.',
    citarIds: ['tjmg-pje-anexos', 'tjrj-pje-distribuicao', 'trf5-pje'],
    porPagina: false,
    contexto:
      'Valor comum entre tribunais de tamanho médio: aparece nos anexos do PJe em TJMG, na distribuição inicial do PJe no TJRJ e no PJe do TRF5, entre outros.',
    dica:
      'É folga suficiente para a maioria dos lotes de anexos simples (procuração, documentos pessoais, comprovantes). Laudos periciais ou processos administrativos digitalizados por inteiro costumam ultrapassar esse teto e pedem divisão em partes.',
  },
  {
    slug: '10mb',
    mb: 10,
    rotulo: '10 MB',
    titulo: 'Comprimir PDF para 10 MB: o teto mais comum nos tribunais',
    descricao: '10 MB é o valor mais repetido entre os 53 tribunais da base, de TJDFT ao TSE. Um bom alvo de teste antes de checar o limite exato do seu.',
    citarIds: ['tjdft-pje', 'trf3-pje', 'tse-pje'],
    porPagina: false,
    contexto:
      'É o valor mais repetido em toda a base de regras — mais de uma dezena de tribunais, entre eles TJDFT, TRF3 e o TSE, aceitam até 10 MB por arquivo. Quando não dá para confirmar o limite exato do seu tribunal, 10 MB é a aposta mais segura antes de checar o diretório de tribunais.',
    dica:
      'Com essa folga, a maioria dos documentos cabe só com a compressão automática. Vale usá-lo como teste rápido: se nem 10 MB é suficiente, o documento provavelmente precisa de divisão em partes, qualquer que seja o tribunal de destino.',
  },
]
