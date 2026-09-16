/**
 * O que um PDF conta sobre si: quem fez, quando, com qual programa, e quantas vezes foi salvo.
 *
 * AVISO QUE GOVERNA O MÓDULO INTEIRO, e que a interface precisa repetir: quase tudo aqui é
 * DECLARAÇÃO, não prova. `/ModDate` é o que o programa gravou, e qualquer editor de texto muda.
 * `/Author` é o que estava configurado na máquina de quem salvou — muitas vezes o nome de usuário
 * do Windows, às vezes o nome de outra pessoa que abriu o arquivo por último.
 *
 * Vender isso como perícia seria o mesmo erro de dizer "assinatura válida". São pistas, e pistas
 * boas; não são fatos verificáveis. A única data com âncora criptográfica é a que vem do
 * cruzamento com a assinatura (ver `revisoesDepoisDaAssinatura`).
 *
 * Tudo roda no navegador: nenhum byte do documento sai da máquina.
 */

export interface Evento {
  /** O que aconteceu: "created", "converted", "saved"… como veio no arquivo. */
  acao: string
  /** Quando, já normalizado para ISO quando deu para interpretar. */
  quando?: string
  /** Programa que fez, como veio. */
  programa?: string
}

export interface Revisao {
  /** 1 é a versão original; as seguintes foram acrescentadas depois, sem reescrever o arquivo. */
  numero: number
  /** Byte onde esta revisão termina. */
  fim: number
  /** Cresceu quantos bytes em relação à anterior. */
  bytes: number
  /**
   * Esta revisão veio DEPOIS do trecho que a assinatura cobre.
   *
   * É o único dado deste módulo que não é declaração: não depende de nenhuma data escrita por
   * software, e sim de aritmética sobre os bytes que a assinatura protege. Se é posterior, é
   * posterior — não há como o arquivo mentir sobre isso sem quebrar a assinatura.
   */
  depoisDaAssinatura?: boolean
}

export interface Metadados {
  /** Título declarado. */
  titulo?: string
  /** Autor declarado — o campo mais revelador e o menos confiável. */
  autor?: string
  assunto?: string
  palavrasChave?: string
  /** Programa que criou o conteúdo original (Word, InDesign, um scanner…). */
  criadoPor?: string
  /** Programa que gravou o arquivo PDF final. */
  gravadoPor?: string
  /** Quando foi criado, em ISO, se deu para interpretar. */
  criadoEm?: string
  /** Última alteração declarada, em ISO. */
  alteradoEm?: string
  /** Datas equivalentes vindas do XMP, que às vezes discordam do /Info. */
  xmpCriadoEm?: string
  xmpAlteradoEm?: string
  /** Histórico de edição do XMP, quando existir. É a parte mais rica, e a mais rara. */
  historico: Evento[]
  /** Identificador que acompanha o documento entre versões. */
  documentoId?: string
  /** Quantas vezes o arquivo foi salvo por cima de si mesmo (atualizações incrementais). */
  revisoes: Revisao[]
  /** O arquivo tem assinatura? Muda o que as datas significam. */
  temAssinatura: boolean
  /**
   * Quantas revisões foram acrescentadas depois do trecho assinado.
   *
   * Zero num arquivo assinado bem formado. Acima de zero significa que escreveram no documento
   * depois de ele ter sido assinado — e isto é PROVA, não indício, porque a assinatura fixa até
   * onde o conteúdo protegido vai.
   */
  revisoesDepoisDaAssinatura: number
  /** Versão do PDF declarada no cabeçalho. */
  versaoPdf?: string
  /** Tamanho total, em bytes. */
  bytes: number
  /** Nenhum campo de identificação foi encontrado. Não é defeito — é o ideal, para quem envia. */
  vazio: boolean
}

const dec = new TextDecoder('latin1')

/**
 * Decodifica uma string literal de PDF.
 *
 * Três formatos convivem: UTF-16BE com marca de ordem, hexadecimal entre <>, e o resto em
 * PDFDocEncoding (parecido com latin-1). Ignorar isso faz o nome do autor sair como
 * "þÿ\0J\0o\0ã\0o" na tela — foi o que apareceu em arquivo real do TJAP durante a medição.
 */
function texto(bruto: string): string {
  let s = bruto
  // Escapes de PDF: \( \) \\ \n \r \t e octal \ddd
  s = s.replace(/\\([nrtbf()\\]|[0-7]{1,3})/g, (_, c: string) => {
    const mapa: Record<string, string> = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '(': '(', ')': ')', '\\': '\\' }
    if (mapa[c] !== undefined) return mapa[c]
    return String.fromCharCode(parseInt(c, 8))
  })
  // UTF-16BE, marcado por FE FF
  if (s.charCodeAt(0) === 0xfe && s.charCodeAt(1) === 0xff) {
    let saida = ''
    for (let i = 2; i + 1 < s.length; i += 2) saida += String.fromCharCode((s.charCodeAt(i) << 8) | s.charCodeAt(i + 1))
    return saida.replace(/\0+$/, '').trim()
  }
  return s.trim()
}

/** Hex entre <> — o outro jeito de escrever string em PDF. */
function deHex(hex: string): string {
  const limpo = hex.replace(/[^0-9a-fA-F]/g, '')
  let s = ''
  for (let i = 0; i + 1 < limpo.length; i += 2) s += String.fromCharCode(parseInt(limpo.slice(i, i + 2), 16))
  return texto(s)
}

/**
 * Data de PDF -> ISO. O formato é `D:AAAAMMDDHHmmSSOHH'mm'`, com quase tudo opcional.
 *
 * Devolve undefined em vez de chutar: data pela metade exibida como se fosse completa é pior que
 * data nenhuma.
 */
export function dataPdf(bruto: string): string | undefined {
  const m = /D:(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?(?:([+-Z])(\d{2})'?(\d{2})?)?/.exec(bruto)
  if (!m) return undefined
  const [, ano, mes = '01', dia = '01', hora = '00', min = '00', seg = '00', sinal, fh = '00', fm = '00'] = m
  const n = Number(ano)
  if (!Number.isFinite(n) || n < 1900 || n > 2200) return undefined
  const fuso = !sinal || sinal === 'Z' ? 'Z' : `${sinal}${fh}:${fm}`
  const iso = `${ano}-${mes}-${dia}T${hora}:${min}:${seg}${fuso}`
  return Number.isNaN(Date.parse(iso)) ? undefined : iso
}

/** Pega um campo do dicionário /Info, aceitando string literal ou hex. */
function campoInfo(txt: string, nome: string): string | undefined {
  const lit = new RegExp(`/${nome}\\s*\\(((?:[^()\\\\]|\\\\.|\\((?:[^()\\\\]|\\\\.)*\\))*)\\)`).exec(txt)
  if (lit) {
    const v = texto(lit[1])
    if (v) return v
  }
  const hex = new RegExp(`/${nome}\\s*<([0-9a-fA-F\\s]+)>`).exec(txt)
  if (hex) {
    const v = deHex(hex[1])
    if (v) return v
  }
  return undefined
}

/** Um valor do XMP, que pode vir como atributo ou como elemento. */
function campoXmp(txt: string, tag: string): string | undefined {
  const attr = new RegExp(`${tag}="([^"]*)"`).exec(txt)
  if (attr?.[1]) return attr[1].trim()
  const el = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`).exec(txt)
  if (!el) return undefined
  // dc:creator vem embrulhado numa lista RDF.
  const dentro = /<rdf:li[^>]*>([\s\S]*?)<\/rdf:li>/.exec(el[1])
  const v = (dentro?.[1] ?? el[1]).replace(/<[^>]*>/g, '').trim()
  return v || undefined
}

/** Histórico de edição do XMP: ação, quando e com qual programa, por evento. */
function historicoXmp(txt: string): Evento[] {
  const bloco = /<xmpMM:History>([\s\S]*?)<\/xmpMM:History>/.exec(txt)
  if (!bloco) return []
  const eventos: Evento[] = []
  // Cada <rdf:li> é um evento; os campos podem ser atributo ou elemento.
  for (const li of bloco[1].match(/<rdf:li[\s\S]*?(?:\/>|<\/rdf:li>)/g) ?? []) {
    const pega = (c: string) =>
      new RegExp(`stEvt:${c}="([^"]*)"`).exec(li)?.[1] ??
      new RegExp(`<stEvt:${c}>([\\s\\S]*?)</stEvt:${c}>`).exec(li)?.[1]?.trim()
    const acao = pega('action')
    if (!acao) continue
    eventos.push({ acao, quando: pega('when'), programa: pega('softwareAgent') })
  }
  return eventos
}

/**
 * Revisões: cada `%%EOF` marca um ponto em que o arquivo foi fechado.
 *
 * PDF permite salvar acrescentando ao fim, sem reescrever o que já estava lá — é assim que uma
 * assinatura é aplicada sem quebrar a anterior. Contar essas marcas mostra quantas vezes o
 * documento foi tocado depois de nascer, e é o dado que mais surpreende quem olha.
 */
function acharRevisoes(txt: string, total: number): Revisao[] {
  const fins: number[] = []
  const re = /%%EOF/g
  for (let m = re.exec(txt); m; m = re.exec(txt)) fins.push(m.index + 5)
  const saida: Revisao[] = []
  let anterior = 0
  for (const fim of fins) {
    // Marcas coladas (lixo de gravação) não contam como revisão de verdade.
    if (fim - anterior < 32 && saida.length > 0) continue
    saida.push({ numero: saida.length + 1, fim, bytes: fim - anterior })
    anterior = fim
  }
  // Sobra depois da última marca ainda é conteúdo acrescentado.
  if (total - anterior > 32 && saida.length > 0) saida.push({ numero: saida.length + 1, fim: total, bytes: total - anterior })
  return saida
}

/**
 * Até onde a última assinatura do arquivo cobre.
 *
 * Aritmética pura sobre o /ByteRange, de propósito: assim a ferramenta de metadados não precisa
 * carregar o leitor de assinaturas (400 KB de ASN.1). Quem quer saber QUEM assinou usa o
 * verificador; aqui basta saber ONDE a proteção termina.
 */
function fimDoTrechoAssinado(txt: string): number | null {
  const re = /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g
  let fim: number | null = null
  for (let m = re.exec(txt); m; m = re.exec(txt)) fim = Number(m[3]) + Number(m[4])
  return fim
}

/** Lê tudo que o arquivo conta sobre si. Não altera nada e não envia nada. */
export function lerMetadados(bytes: Uint8Array): Metadados {
  const txt = dec.decode(bytes)

  /*
   * O /Info procurado no arquivo inteiro, e não só no trailer: num PDF com várias revisões existem
   * vários dicionários, e o mais recente é o que vale. Por isso a busca pega a ÚLTIMA ocorrência de
   * cada campo — é a que descreve o estado atual do documento.
   */
  const ultimo = (nome: string): string | undefined => {
    let achado: string | undefined
    let corte = 0
    for (;;) {
      const pedaco = txt.slice(corte)
      const v = campoInfo(pedaco, nome)
      if (v === undefined) break
      achado = v
      const pos = pedaco.search(new RegExp(`/${nome}\\s*[(<]`))
      if (pos < 0) break
      corte += pos + 1
    }
    return achado
  }

  const xmpBloco = /<x:xmpmeta[\s\S]*?<\/x:xmpmeta>/.exec(txt)?.[0] ?? ''
  const historico = historicoXmp(xmpBloco)
  const revisoes = acharRevisoes(txt, bytes.length)

  // Cruzamento com a assinatura: a única afirmação temporal deste módulo que não depende de
  // ninguém ter escrito a verdade num campo.
  const ateOndeAssina = fimDoTrechoAssinado(txt)
  let depoisDaAssinatura = 0
  if (ateOndeAssina !== null) {
    for (const r of revisoes) {
      // Tolerância de 32 bytes: o fecho da revisão que CONTÉM a assinatura cai logo depois dela.
      r.depoisDaAssinatura = r.fim > ateOndeAssina + 32
      if (r.depoisDaAssinatura) depoisDaAssinatura++
    }
  }

  const m: Metadados = {
    titulo: ultimo('Title'),
    autor: ultimo('Author') ?? campoXmp(xmpBloco, 'dc:creator'),
    assunto: ultimo('Subject'),
    palavrasChave: ultimo('Keywords'),
    criadoPor: ultimo('Creator') ?? campoXmp(xmpBloco, 'xmp:CreatorTool'),
    gravadoPor: ultimo('Producer') ?? campoXmp(xmpBloco, 'pdf:Producer'),
    criadoEm: ultimo('CreationDate') ? dataPdf(ultimo('CreationDate')!) : undefined,
    alteradoEm: ultimo('ModDate') ? dataPdf(ultimo('ModDate')!) : undefined,
    xmpCriadoEm: campoXmp(xmpBloco, 'xmp:CreateDate'),
    xmpAlteradoEm: campoXmp(xmpBloco, 'xmp:ModifyDate'),
    historico,
    documentoId: campoXmp(xmpBloco, 'xmpMM:DocumentID'),
    revisoes,
    temAssinatura: ateOndeAssina !== null,
    revisoesDepoisDaAssinatura: depoisDaAssinatura,
    versaoPdf: /^%PDF-(\d\.\d)/.exec(txt)?.[1],
    bytes: bytes.length,
    vazio: false,
  }
  m.vazio = !m.titulo && !m.autor && !m.assunto && !m.palavrasChave && !m.criadoPor && !m.gravadoPor && !m.criadoEm && !m.alteradoEm && historico.length === 0
  return m
}
