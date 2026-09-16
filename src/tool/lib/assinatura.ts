/**
 * Conferência de assinatura digital em PDF (PAdES), dentro do navegador.
 *
 * ESTE ARQUIVO É UMA SONDA DA ETAPA 0 da especificação do Conferidor de Assinaturas — o passo que
 * a própria spec marca como "bloqueia tudo, faça antes de prometer". Ele existe para responder uma
 * pergunta de viabilidade, não para ser o produto:
 *
 *   dá para extrair a assinatura de um PDF e verificar a integridade SEM servidor?
 *
 * O que está implementado aqui cobre os estados 1 (conferida), 4 (quebrada) e 5 (sem assinatura) —
 * que a spec identifica como a maioria esmagadora dos casos reais. NÃO cobre: validação de cadeia
 * contra raízes ICP-Brasil, revogação, carimbo do tempo, DocMDP nem CAdES destacado (.p7s).
 *
 * Vocabulário: 'conferida', 'quebrada', 'indeterminada'. Nunca 'válida' — conferência técnica não
 * é atestado de validade jurídica, e a palavra errada na interface é o erro que mata o produto.
 */
import * as pkijs from 'pkijs'
import * as asn1js from 'asn1js'
import { OID_ATRIBUTO_POLITICA, politicaDoOid, type PoliticaDeclarada } from './politicas-icp'

/** Os estados que esta sonda sabe distinguir hoje. A spec prevê oito no total. */
export type EstadoAssinatura =
  | 'conferida'
  | 'quebrada'
  | 'sem_assinatura'
  | 'indeterminada'
  | 'nao_suportada'

export interface Signatario {
  /** Nome comum do certificado, como veio — sem normalização. */
  nome: string
  emissor: string
  /**
   * O certificado assina a si mesmo (emissor idêntico ao titular).
   *
   * É o único fato sobre a ORIGEM do certificado que dá para afirmar sem validar a cadeia, e vale
   * muito: um certificado autoassinado, por definição, não foi emitido por autoridade certificadora
   * nenhuma — então não é ICP-Brasil. É assim que aparece a maior parte dos PDFs "assinados" com um
   * certificado caseiro, e a integridade deles confere perfeitamente. Dizer só "confere" nesse caso
   * seria tecnicamente correto e praticamente enganoso.
   */
  autoassinado: boolean
  serie: string
  validoDe: string
  validoAte: string
}

export interface Conferencia {
  estado: EstadoAssinatura
  /** Frase operacional: o que fazer. Nunca um veredito de validade. */
  orientacao: string
  /** Por que o estado é esse, em português. */
  motivo?: string
  signatarios: Signatario[]
  /** Quantos bytes do arquivo a assinatura cobre, e quantos ficaram de fora. */
  cobertura?: { assinados: number; total: number }
  /** Quantas assinaturas o arquivo tem. Mais de uma é comum (advogado + parte, ou parte + juízo). */
  quantidade?: number
  /**
   * Bytes acrescentados DEPOIS do trecho que a última assinatura cobre.
   *
   * Num arquivo bem formado isto é zero: a última assinatura vai até o fim. Qualquer valor acima
   * de zero significa que alguém escreveu no arquivo depois de assinado — página anexada,
   * anotação, carimbo. A assinatura pode até continuar conferindo (ela cobre o que cobria), mas o
   * documento não é mais só aquilo que foi assinado, e isso precisa aparecer.
   */
  acrescentadoDepois?: number
  /**
   * A política da ICP-Brasil que o arquivo DECLARA seguir — não uma confirmação de que a cumpre.
   * Ausente quando a assinatura não declara política, o que é comum e não é defeito.
   */
  politica?: PoliticaDeclarada
}

const dec = new TextDecoder('latin1')

/**
 * Acha os ByteRange do arquivo.
 *
 * O ByteRange diz exatamente quais bytes a assinatura cobre: dois intervalos, com o buraco no meio
 * sendo o próprio /Contents (a assinatura não pode assinar a si mesma). Procurar por texto no PDF
 * bruto é o caminho certo aqui — a estrutura é justamente o que precisamos, e reescrever o arquivo
 * com uma biblioteca destruiria os offsets que a conferência depende.
 */
function acharByteRanges(bytes: Uint8Array): { range: number[]; contents: [number, number] }[] {
  const texto = dec.decode(bytes)
  const achados: { range: number[]; contents: [number, number] }[] = []
  const re = /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g
  for (let m = re.exec(texto); m; m = re.exec(texto)) {
    const range = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])]
    // O /Contents fica no buraco entre os dois intervalos, entre < e >.
    const ini = range[0] + range[1] + 1
    const fim = range[2] - 1
    if (fim > ini) achados.push({ range, contents: [ini, fim] })
  }
  return achados
}

/** Hex do /Contents -> bytes do CMS. Ignora o preenchimento de zeros à direita. */
function hexParaBytes(hex: string): Uint8Array {
  const limpo = hex.trim().replace(/[^0-9a-fA-F]/g, '')
  const saida = new Uint8Array(limpo.length >> 1)
  for (let i = 0; i < saida.length; i++) saida[i] = parseInt(limpo.slice(i * 2, i * 2 + 2), 16)
  // O espaço reservado é preenchido com zeros; o DER real termina antes.
  let fim = saida.length
  while (fim > 0 && saida[fim - 1] === 0) fim--
  return saida.subarray(0, fim)
}

function nomeComum(nome: pkijs.RelativeDistinguishedNames): string {
  const cn = nome.typesAndValues.find((t) => t.type === '2.5.4.3')
  return cn ? String(cn.value.valueBlock.value) : '(sem nome)'
}

/** O DN inteiro, em ordem, para comparar titular e emissor sem depender só do nome comum. */
function distinguido(nome: pkijs.RelativeDistinguishedNames): string {
  return nome.typesAndValues.map((t) => `${t.type}=${String(t.value.valueBlock.value)}`).join('|')
}

/**
 * Lê a política de assinatura declarada nos atributos assinados, quando houver.
 *
 * O atributo signature-policy-identifier (RFC 5126) carrega o OID da política. Como ele está entre
 * os atributos ASSINADOS, não dá para trocar sem quebrar a assinatura — o que torna a leitura
 * confiável mesmo sem validar a cadeia.
 */
function politicaDeclarada(cms: pkijs.SignedData): PoliticaDeclarada | undefined {
  const attrs = cms.signerInfos?.[0]?.signedAttrs?.attributes
  if (!attrs) return undefined
  const attr = attrs.find((a) => a.type === OID_ATRIBUTO_POLITICA)
  if (!attr) return undefined
  try {
    // SignaturePolicyIdentifier ::= SEQUENCE { sigPolicyId OBJECT IDENTIFIER, sigPolicyHash ... }
    const seq = attr.values[0] as asn1js.Sequence
    const id = seq.valueBlock.value[0] as asn1js.ObjectIdentifier
    return politicaDoOid(id.valueBlock.toString()) ?? undefined
  } catch {
    // Atributo presente mas fora do formato esperado: não é motivo para derrubar a conferência.
    return undefined
  }
}

/**
 * Confere a assinatura de um PDF.
 *
 * Roda inteiramente no navegador: WebCrypto faz o resumo e a verificação, pkijs faz o ASN.1.
 * Nenhum byte do documento sai da máquina.
 */
export async function conferirAssinatura(bytes: Uint8Array): Promise<Conferencia> {
  /*
   * Sem WebCrypto não há conferência — e o que se faz nesse caso importa mais que o caso em si.
   *
   * A sonda desta etapa rodou numa página sem contexto seguro (crypto.subtle indefinido) e o
   * módulo respondeu 'quebrada' para um arquivo perfeitamente íntegro. Esse é o pior erro
   * possível deste produto: mandar o advogado recuperar um original que nunca se perdeu, e
   * destruir a confiança na ferramenta no primeiro uso.
   *
   * Impossibilidade de conferir NUNCA pode virar veredito negativo. Vira 'indeterminada'.
   */
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    return {
      estado: 'indeterminada',
      orientacao: 'Não foi possível conferir aqui. Use o validador oficial do ITI.',
      motivo: 'Este navegador não expôs as funções de criptografia — elas exigem uma conexão segura (HTTPS).',
      signatarios: [],
    }
  }

  const achados = acharByteRanges(bytes)
  if (achados.length === 0) {
    return {
      estado: 'sem_assinatura',
      orientacao: 'Nenhuma assinatura eletrônica encontrada neste arquivo.',
      motivo: 'Se o documento foi impresso e escaneado, a assinatura se perdeu — e não é recuperável.',
      signatarios: [],
    }
  }

  // A última assinatura é a mais recente; é a que decide o estado do arquivo como um todo.
  const { range, contents } = achados[achados.length - 1]
  const quantidade = achados.length
  const acrescentadoDepois = Math.max(0, bytes.length - (range[2] + range[3]))
  const texto = dec.decode(bytes.subarray(contents[0], contents[1]))

  let cms: pkijs.SignedData
  let certs: pkijs.Certificate[] = []
  try {
    const der = hexParaBytes(texto)
    const asn = asn1js.fromBER(der.buffer.slice(der.byteOffset, der.byteOffset + der.byteLength) as ArrayBuffer)
    if (asn.offset === -1) throw new Error('DER ilegível')
    const info = new pkijs.ContentInfo({ schema: asn.result })
    cms = new pkijs.SignedData({ schema: info.content })
    certs = (cms.certificates ?? []).filter((c): c is pkijs.Certificate => c instanceof pkijs.Certificate)
  } catch {
    return {
      estado: 'nao_suportada',
      orientacao: 'Confira no validador oficial do ITI antes de protocolar.',
      motivo: 'A assinatura está num formato que esta conferência ainda não lê.',
      signatarios: [],
    }
  }

  const signatarios: Signatario[] = certs.map((c) => ({
    nome: nomeComum(c.subject),
    emissor: nomeComum(c.issuer),
    autoassinado: distinguido(c.subject) === distinguido(c.issuer),
    // Sem Buffer: isto roda no navegador, onde ele não existe. A sonda pegou esse erro.
    serie: [...c.serialNumber.valueBlock.valueHexView].map((b) => b.toString(16).padStart(2, '0')).join(''),
    validoDe: c.notBefore.value.toISOString().slice(0, 10),
    validoAte: c.notAfter.value.toISOString().slice(0, 10),
  }))

  // Os bytes que a assinatura cobre: os dois intervalos do ByteRange, concatenados.
  const assinados = new Uint8Array(range[1] + range[3])
  assinados.set(bytes.subarray(range[0], range[0] + range[1]), 0)
  assinados.set(bytes.subarray(range[2], range[2] + range[3]), range[1])

  const cobertura = { assinados: assinados.length, total: bytes.length }
  const extras = { quantidade, acrescentadoDepois }
  const politica = politicaDeclarada(cms)
  const indeterminada = (): Conferencia => ({
    estado: 'indeterminada',
    orientacao: 'Confira no validador oficial do ITI antes de protocolar.',
    motivo: 'A conferência não pôde ser concluída aqui — isto não significa que o documento esteja alterado.',
    signatarios,
    cobertura,
    ...extras,
    politica,
  })

  /*
   * O RESUMO É CONFERIDO AQUI, E NÃO SÓ PELA BIBLIOTECA — e o motivo é a descoberta mais cara da
   * Etapa 0.
   *
   * Quando o documento foi alterado, pkijs não devolve "não confere": ele LANÇA
   * SignedDataVerifyError("Message digest doesn't match"), com signatureVerified = null. Ou seja,
   * nem o texto nem o campo estruturado distinguem "alterado" de "não consegui verificar". Se o
   * código só olhasse o verify(), o estado mais importante do produto — documento alterado,
   * recupere o original — nunca apareceria: viraria um "não deu para conferir".
   *
   * Comparar o resumo por conta própria é aritmética nossa, não semântica de exceção de terceiro.
   * É o que torna 'quebrada' alcançável, e é por isso que esta comparação vem ANTES do verify().
   */
  const ALGORITMOS: Record<string, string> = {
    '2.16.840.1.101.3.4.2.1': 'SHA-256',
    '2.16.840.1.101.3.4.2.2': 'SHA-384',
    '2.16.840.1.101.3.4.2.3': 'SHA-512',
    '1.3.14.3.2.26': 'SHA-1',
  }
  const algoritmo = ALGORITMOS[cms.signerInfos?.[0]?.digestAlgorithm?.algorithmId ?? '']
  const resumoEsperado = (() => {
    const attrs = cms.signerInfos?.[0]?.signedAttrs?.attributes
    const md = attrs?.find((a) => a.type === '1.2.840.113549.1.9.4')
    try {
      return md ? new Uint8Array(md.values[0].valueBlock.valueHexView) : undefined
    } catch {
      return undefined
    }
  })()

  const dados = assinados.buffer.slice(assinados.byteOffset, assinados.byteOffset + assinados.byteLength) as ArrayBuffer

  if (algoritmo && resumoEsperado) {
    let calculado: Uint8Array
    try {
      calculado = new Uint8Array(await crypto.subtle.digest(algoritmo, dados))
    } catch {
      return indeterminada()
    }
    const bate =
      calculado.length === resumoEsperado.length && calculado.every((b, i) => b === resumoEsperado[i])
    if (!bate) {
      return {
        estado: 'quebrada',
        orientacao: 'Recupere o arquivo original. Não protocole este.',
        motivo: 'O documento foi alterado depois de assinado — a causa mais comum é compressão, edição ou junção.',
        signatarios,
        cobertura,
        ...extras,
        politica,
      }
    }
  } else {
    // Sem algoritmo conhecido ou sem o atributo de resumo, só resta o verify() — e o que ele não
    // souber dizer com clareza continua sendo 'indeterminada'.
  }

  /*
   * O resumo bate: o conteúdo é o mesmo. Falta a assinatura em si — que o conteúdo não tenha
   * mudado não prova que quem assinou é quem diz ser.
   */
  let integra = false
  try {
    const r = await cms.verify({ signer: 0, data: dados })
    integra = r === true || (typeof r === 'object' && (r as { signatureVerified?: boolean }).signatureVerified === true)
  } catch (e) {
    // signatureVerified === false é veredito; null é "não rodou". pkijs usa os dois.
    const falhou = (e as { signatureVerified?: boolean | null })?.signatureVerified === false
    if (!falhou) return indeterminada()
  }

  if (!integra) {
    return {
      estado: 'quebrada',
      orientacao: 'Recupere o arquivo original. Não protocole este.',
      motivo: 'O documento foi alterado depois de assinado — a causa mais comum é compressão, edição ou junção.',
      signatarios,
      cobertura,
      politica,
    }
  }

  return {
    estado: 'conferida',
    orientacao: 'A integridade confere. Não comprima nem divida este arquivo.',
    motivo: 'O conteúdo assinado não mudou desde a assinatura.',
    signatarios,
    cobertura,
    ...extras,
    politica,
  }
}
