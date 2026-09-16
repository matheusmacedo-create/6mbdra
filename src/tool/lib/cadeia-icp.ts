import * as pkijs from 'pkijs'
import { RAIZES_ICP } from './raizes-icp'

/**
 * Validação da cadeia do certificado até as raízes da ICP-Brasil, dentro do navegador.
 *
 * Responde o que a conferência de integridade não responde: o arquivo não mudou, mas QUEM assinou
 * tem procedência? São coisas diferentes — um documento pode estar intacto e assinado com
 * certificado que autoridade nenhuma emitiu.
 *
 * O que esta camada NÃO faz, e não por esquecimento:
 *
 *   REVOGAÇÃO. Consultar LCR ou OCSP seria pedir a um servidor do ITI o estado de um certificado
 *   específico — ou seja, contar a um terceiro que este documento está sendo conferido aqui, agora.
 *   É exatamente o que o produto promete não fazer. Ainda que quiséssemos, os servidores da ICP não
 *   mandam cabeçalhos de CORS e o TLS deles serve cadeia incompleta. Fica de fora por princípio.
 *
 *   CARIMBO DO TEMPO. Está no arquivo e é verificável offline, mas depende do ramo do INMETRO, que
 *   é justamente o que não dá para verificar hoje (ver ALGORITMOS abaixo).
 */

/** Só quatro desfechos, e cada um leva a uma frase diferente na tela. */
export type EstadoCadeia =
  /** O caminho fecha numa raiz da ICP-Brasil que conhecemos, com todas as assinaturas conferidas. */
  | 'icp_brasil'
  /** O caminho fecha, mas fora da ICP-Brasil — ou as assinaturas do caminho não conferem. */
  | 'fora_da_icp'
  /** Faltam elos: o arquivo não trouxe as autoridades intermediárias. */
  | 'incompleta'
  /** Não deu para rodar a verificação. NUNCA é veredito negativo. */
  | 'nao_verificada'

export interface Cadeia {
  estado: EstadoCadeia
  /** Nome da raiz que ancorou o caminho, quando houver. */
  raiz?: string
  /** Quantos certificados o caminho tem, da folha à raiz. */
  altura?: number
  /**
   * O caminho só fechou ignorando as datas.
   *
   * Acontece com assinatura antiga: o certificado valia quando foi usado e venceu depois. A cadeia
   * é legítima; o que não dá para afirmar, sem carimbo do tempo, é que valia NA HORA da assinatura.
   * Essa diferença precisa aparecer em vez de virar um "ok" ou um "falhou".
   */
  foraDeValidade?: boolean
  /** Explicação em português, pronta para a tela. */
  motivo: string
}

/*
 * ALGORITMOS que conseguimos verificar.
 *
 * Medido sobre os 192 certificados da hierarquia publicada (180 autoridades do ACcompactado.zip
 * mais as 12 raízes): 182 usam RSA com SHA-512 e 3 usam ECDSA — todos aqui. Os 7 restantes usam
 * Ed25519 (raízes v6 e v7 e o ramo do INMETRO, que cuida do carimbo do tempo) ou um OID privado,
 * e nenhum navegador expõe isso pela biblioteca que usamos hoje.
 *
 * O ponto que importa não é a cobertura de 95%: é o que acontece nos 5%. Um certificado do ramo
 * Ed25519 é ICP-Brasil legítimo, e chamá-lo de "fora da ICP-Brasil" seria uma acusação falsa contra
 * um documento correto. Por isso o caminho é detectado pelo NOME primeiro, sem criptografia: se ele
 * leva a uma raiz nossa mas passa por algoritmo que não sabemos verificar, a resposta é
 * "não verificada" com o motivo — e não um veredito negativo.
 */
const ALGORITMOS_SUPORTADOS = new Set([
  '1.2.840.113549.1.1.5', // RSA + SHA-1
  '1.2.840.113549.1.1.11', // RSA + SHA-256
  '1.2.840.113549.1.1.12', // RSA + SHA-384
  '1.2.840.113549.1.1.13', // RSA + SHA-512
  '1.2.840.113549.1.1.10', // RSA-PSS
  '1.2.840.10045.4.3.2', // ECDSA + SHA-256
  '1.2.840.10045.4.3.3', // ECDSA + SHA-384
  '1.2.840.10045.4.3.4', // ECDSA + SHA-512
])

let cacheRaizes: pkijs.Certificate[] | null = null

/** As raízes viram objetos uma vez só: são 12 certificados e o parse não é de graça. */
function raizes(): pkijs.Certificate[] {
  if (cacheRaizes) return cacheRaizes
  const saida: pkijs.Certificate[] = []
  for (const r of RAIZES_ICP) {
    try {
      const bin = atob(r.der)
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      saida.push(pkijs.Certificate.fromBER(bytes))
    } catch {
      // Raiz ilegível não pode derrubar as outras onze.
    }
  }
  cacheRaizes = saida
  return saida
}

function nomeComum(c: pkijs.Certificate): string {
  const cn = c.subject.typesAndValues.find((t) => t.type === '2.5.4.3')
  return cn ? String(cn.value.valueBlock.value) : '(sem nome)'
}

/** O DN inteiro, em ordem, como texto comparável. */
function dn(n: pkijs.RelativeDistinguishedNames): string {
  return n.typesAndValues.map((t) => `${t.type}=${String(t.value.valueBlock.value)}`).join('|')
}

/**
 * Percorre a cadeia PELO NOME, sem criptografia nenhuma.
 *
 * Serve para responder "para onde este certificado aponta?" mesmo quando não conseguimos verificar
 * as assinaturas do caminho. É o que separa "não sei verificar" de "não é ICP-Brasil" — e essa
 * separação é a razão de esta função existir.
 */
function caminhoPorNome(folha: pkijs.Certificate, disponiveis: pkijs.Certificate[]): pkijs.Certificate[] {
  const caminho = [folha]
  const vistos = new Set([dn(folha.subject)])
  let atual = folha
  // Teto para não girar em círculo se alguém montar certificados que se emitem mutuamente.
  for (let i = 0; i < 12; i++) {
    if (dn(atual.subject) === dn(atual.issuer)) break // chegou numa raiz
    const pai = disponiveis.find((c) => dn(c.subject) === dn(atual.issuer) && !vistos.has(dn(c.subject)))
    if (!pai) break // elo faltando
    caminho.push(pai)
    vistos.add(dn(pai.subject))
    atual = pai
  }
  return caminho
}

/**
 * Valida a cadeia de um certificado assinante contra as raízes da ICP-Brasil.
 *
 * `doArquivo` são os certificados que vieram dentro do CMS — normalmente a folha e as autoridades
 * intermediárias. A raiz costuma NÃO vir, e é por isso que ela mora no código.
 */
export async function validarCadeia(folha: pkijs.Certificate, doArquivo: pkijs.Certificate[]): Promise<Cadeia> {
  const ancoras = raizes()
  if (ancoras.length === 0) {
    return { estado: 'nao_verificada', motivo: 'A lista de raízes da ICP-Brasil não pôde ser lida neste navegador.' }
  }
  const dnsDasRaizes = new Set(ancoras.map((r) => dn(r.subject)))
  const intermediarios = doArquivo.filter((c) => c !== folha)

  // Uma raiz da ICP entregue como signatária é ela mesma: reconhecer antes de qualquer outra coisa.
  if (dn(folha.subject) === dn(folha.issuer) && dnsDasRaizes.has(dn(folha.subject))) {
    return { estado: 'icp_brasil', raiz: nomeComum(folha), altura: 1, motivo: `Este é o certificado da ${nomeComum(folha)}.` }
  }

  if (dn(folha.subject) === dn(folha.issuer)) {
    return { estado: 'fora_da_icp', motivo: 'O certificado assina a si mesmo — nenhuma autoridade certificadora o emitiu.' }
  }

  /*
   * Primeiro o caminho pelo nome, que não depende de criptografia. Ele decide qual pergunta vale
   * fazer em seguida: se nem pelo nome chega numa raiz nossa, verificar assinatura não muda nada.
   */
  const porNome = caminhoPorNome(folha, [...intermediarios, ...ancoras])
  const topo = porNome[porNome.length - 1]
  const chegaNaIcp = dnsDasRaizes.has(dn(topo.subject))

  if (!chegaNaIcp) {
    const fechou = dn(topo.subject) === dn(topo.issuer)
    if (!fechou) {
      return {
        estado: 'incompleta',
        motivo:
          'O arquivo não trouxe a autoridade certificadora que emitiu este certificado, então não há como montar a cadeia. Não buscamos essa autoridade na internet: isso contaria a um terceiro que este documento está sendo conferido aqui.',
      }
    }
    return { estado: 'fora_da_icp', raiz: nomeComum(topo), altura: porNome.length, motivo: `A cadeia fecha em "${nomeComum(topo)}", que não é uma raiz da ICP-Brasil.` }
  }

  // O caminho leva à ICP. Sabemos verificar todas as assinaturas dele?
  const naoSuportado = porNome.find((c) => !ALGORITMOS_SUPORTADOS.has(c.signatureAlgorithm.algorithmId))
  if (naoSuportado) {
    return {
      estado: 'nao_verificada',
      raiz: nomeComum(topo),
      altura: porNome.length,
      motivo: `A cadeia aponta para a ${nomeComum(topo)}, mas um dos certificados do caminho usa um algoritmo que ainda não sabemos verificar aqui. Isso não indica problema com o documento — confira no validador oficial do ITI.`,
    }
  }

  /*
   * Duas passadas, e a segunda é o que torna a resposta útil. A primeira usa as datas de hoje;
   * assinatura antiga reprova aí, porque o certificado venceu DEPOIS de ter sido usado — o que é
   * normal. A segunda repete numa data dentro da validade da folha, só para saber se o caminho
   * fecha. Sem isso, um documento legítimo de 2021 sairia como "fora da ICP-Brasil".
   */
  const tentar = async (quando: Date) => {
    try {
      const motor = new pkijs.CertificateChainValidationEngine({ certs: [...intermediarios, folha], trustedCerts: ancoras, checkDate: quando })
      return await motor.verify()
    } catch {
      return null
    }
  }
  const agora = await tentar(new Date())
  const ok = agora?.result === true
  const meio = new Date((folha.notBefore.value.getTime() + folha.notAfter.value.getTime()) / 2)
  const retro = ok ? null : await tentar(meio)
  const bom = ok ? agora : retro?.result === true ? retro : null

  if (!bom) {
    /*
     * O caminho existe pelo nome e sabemos os algoritmos, mas as assinaturas não conferem. Aqui um
     * veredito negativo é legítimo: é o caso de um certificado que se DIZ da ICP-Brasil e não é.
     */
    return {
      estado: 'fora_da_icp',
      raiz: nomeComum(topo),
      altura: porNome.length,
      motivo: `O certificado se apresenta como emitido sob a ${nomeComum(topo)}, mas a assinatura do caminho não confere.`,
    }
  }

  const caminho = bom.certificatePath ?? porNome
  const ancora = caminho[caminho.length - 1] ?? topo
  return {
    estado: 'icp_brasil',
    raiz: nomeComum(ancora),
    altura: caminho.length,
    foraDeValidade: !ok,
    motivo: ok
      ? `A cadeia do certificado fecha na ${nomeComum(ancora)}.`
      : `A cadeia fecha na ${nomeComum(ancora)}, mas o certificado do signatário está fora do período de validade hoje. É comum em assinatura antiga e não quer dizer que era inválida na época — provar a data exige carimbo do tempo.`,
  }
}
