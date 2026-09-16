/**
 * Origem do documento: com que ferramenta este arquivo foi feito, e ele declara ter sido gerado
 * por inteligência artificial?
 *
 * A REGRA QUE DEFINE ESTE MÓDULO: aqui não existe probabilidade. Nenhum "87% de chance de ser IA".
 *
 * Detector de texto por IA não funciona de forma confiável — a própria OpenAI desligou o dela por
 * baixa precisão, e os estudos mostram taxa alta de falso positivo, pior ainda fora do inglês. Num
 * produto usado para instruir processo, um percentual errado vira acusação falsa contra alguém: o
 * advogado leva ao juízo "a ferramenta apontou 87%", está errado, e o estrago é do cliente dele e
 * da credibilidade de todo o resto.
 *
 * Um número implica calibração que não temos. Então este módulo só diz três coisas, todas
 * verificáveis:
 *
 *   1. O que o arquivo DECLARA como ferramenta de origem (campo gravado pelo programa).
 *   2. Se traz a marca OFICIAL de conteúdo gerado por IA (IPTC DigitalSourceType) — quando existe,
 *      é o próprio gerador dizendo, não nós adivinhando.
 *   3. Se traz Content Credentials (C2PA), o padrão aberto de proveniência assinada.
 *
 * E diz em voz alta o que a ausência significa: nada. Um documento sem marca nenhuma pode ter sido
 * escrito à mão ou gerado inteiro por IA — os campos são opcionais e removíveis.
 */

/** Para que serve a ferramenta que gerou o arquivo. Ajuda a ler o resultado sem saber de PDF. */
export type Familia =
  | 'escritorio'
  | 'design'
  | 'navegador'
  | 'digitalizacao'
  | 'conversor'
  | 'juridico'
  | 'ia'

export interface Ferramenta {
  /** Nome apresentável. */
  nome: string
  familia: Familia
  /** O que isso costuma significar, em português. */
  nota: string
}

/*
 * Tabela de reconhecimento, montada a partir dos campos realmente encontrados em 166 PDFs — a
 * maioria documentos públicos de tribunais brasileiros. A ordem importa: o primeiro padrão que
 * casar ganha, então o mais específico vem antes.
 *
 * Nenhuma entrada aqui afirma "isto é IA". Canva e Google Docs têm recursos de IA e são usados o
 * tempo todo sem eles; dizer "feito por IA" porque o arquivo saiu do Canva seria inventar. A
 * família 'ia' fica reservada para ferramentas cuja razão de existir é gerar conteúdo, e mesmo
 * nesse caso a frase é "declara ter sido feito com", não "é".
 */
const CONHECIDAS: { padrao: RegExp; f: Ferramenta }[] = [
  { padrao: /microsoft.*(word|office)/i, f: { nome: 'Microsoft Word', familia: 'escritorio', nota: 'Editor de texto. O arquivo foi exportado de um documento do Word.' } },
  { padrao: /libreoffice|openoffice/i, f: { nome: 'LibreOffice', familia: 'escritorio', nota: 'Pacote de escritório livre.' } },
  { padrao: /google docs|skia\/pdf.*google/i, f: { nome: 'Google Docs', familia: 'escritorio', nota: 'Documento do Google, exportado em PDF.' } },
  { padrao: /\bcanva\b/i, f: { nome: 'Canva', familia: 'design', nota: 'Ferramenta de design on-line. Tem recursos de IA, mas o campo não diz se foram usados.' } },
  { padrao: /adobe express/i, f: { nome: 'Adobe Express', familia: 'design', nota: 'Editor on-line da Adobe. Tem recursos de IA, mas o campo não diz se foram usados.' } },
  { padrao: /indesign/i, f: { nome: 'Adobe InDesign', familia: 'design', nota: 'Diagramação profissional — típico de material editorial.' } },
  { padrao: /illustrator/i, f: { nome: 'Adobe Illustrator', familia: 'design', nota: 'Desenho vetorial.' } },
  { padrao: /photoshop/i, f: { nome: 'Adobe Photoshop', familia: 'design', nota: 'Edição de imagem.' } },
  { padrao: /acrobat|adobe pdf library|adobe pdf services/i, f: { nome: 'Adobe Acrobat', familia: 'conversor', nota: 'Gravado pela biblioteca da Adobe — pode ter passado por edição.' } },
  { padrao: /skia\/pdf|chromium|chrome/i, f: { nome: 'Navegador Chrome', familia: 'navegador', nota: 'Impresso para PDF a partir de uma página da web.' } },
  { padrao: /mozilla\/5\.0|firefox/i, f: { nome: 'Navegador', familia: 'navegador', nota: 'Impresso para PDF a partir do navegador.' } },
  { padrao: /pdfium/i, f: { nome: 'PDFium', familia: 'navegador', nota: 'Motor de PDF do Chrome — o arquivo foi salvo pelo visualizador.' } },
  { padrao: /ghostscript/i, f: { nome: 'Ghostscript', familia: 'conversor', nota: 'Conversor de PDF. É o que o próprio brpdf usa ao comprimir.' } },
  { padrao: /itext|tcpdf|fpdf|reportlab|pdfkit|wkhtmltopdf|jasper/i, f: { nome: 'Gerador automático', familia: 'juridico', nota: 'Biblioteca usada por sistemas para emitir documentos — típico de peça gerada por sistema.' } },
  { padrao: /pje|esaj|eproc|projudi|sei\b/i, f: { nome: 'Sistema processual', familia: 'juridico', nota: 'Gerado pelo próprio sistema do tribunal.' } },
  { padrao: /scanner|scansnap|epson|canon|xerox|kyocera|hp\s|brother|digitaliz/i, f: { nome: 'Scanner', familia: 'digitalizacao', nota: 'O arquivo nasceu de papel digitalizado.' } },
  { padrao: /\bgamma\b|\btome\b|beautiful\.ai|chatgpt|openai|gpt-4|claude|gemini|copilot|midjourney|dall-?e|stable diffusion|firefly/i,
    f: { nome: 'Ferramenta de geração por IA', familia: 'ia', nota: 'O campo de origem cita uma ferramenta cuja função é gerar conteúdo.' } },
]

/*
 * A marca OFICIAL de conteúdo gerado por IA.
 *
 * `Iptc4xmpExt:DigitalSourceType` é um vocabulário padronizado da IPTC, adotado pela C2PA e por
 * geradores que optam por marcar o que produzem. Quando está presente, quem está afirmando é o
 * próprio gerador — não nós. É a única coisa neste módulo que chega perto de "isto é IA", e mesmo
 * assim continua sendo uma declaração do arquivo.
 */
const MARCAS_IPTC: { padrao: RegExp; rotulo: string; ia: boolean }[] = [
  { padrao: /trainedAlgorithmicMedia/, rotulo: 'Gerado inteiramente por um modelo de IA', ia: true },
  { padrao: /compositeWithTrainedAlgorithmicMedia/, rotulo: 'Composição que inclui conteúdo gerado por IA', ia: true },
  /*
   * `algorithmicMedia` puro é outra coisa: pela IPTC, conteúdo criado por algoritmo que NÃO parte
   * de dados de treino — geração procedural, gráfico calculado, captura de tela. Marcar isso como
   * IA seria o falso positivo que este módulo existe para evitar. O rótulo já dizia "não
   * necessariamente IA" enquanto o campo dizia o contrário; venceu o rótulo.
   */
  { padrao: /algorithmicMedia/, rotulo: 'Gerado por algoritmo, sem modelo de IA declarado', ia: false },
  { padrao: /digitalCapture/, rotulo: 'Capturado por câmera ou scanner', ia: false },
  { padrao: /softwareImage/, rotulo: 'Criado em software, sem IA declarada', ia: false },
]

export type Veredito =
  /** O arquivo traz a marca oficial de conteúdo gerado por IA. */
  | 'ia_declarada'
  /** Há Content Credentials, mas sem marca de IA. */
  | 'credenciais_sem_ia'
  /** Deu para identificar a ferramenta, e ela não declara IA. */
  | 'ferramenta_identificada'
  /** O arquivo não diz nada sobre a própria origem. */
  | 'sem_indicacao'

export interface Origem {
  veredito: Veredito
  /** Ferramentas reconhecidas nos campos de origem. */
  ferramentas: Ferramenta[]
  /** Os valores crus dos campos, para quem quiser conferir. */
  declarados: string[]
  /** Marca IPTC encontrada, se houver. */
  marcaIptc?: { rotulo: string; ia: boolean }
  /** O arquivo traz Content Credentials (C2PA)? */
  temCredenciais: boolean
  /** Quem o manifesto C2PA declara como gerador. */
  geradorC2pa?: string
  /** Frase pronta para a tela. Nunca um percentual. */
  resumo: string
}

const dec = new TextDecoder('latin1')

/**
 * Content Credentials (C2PA) dentro de um PDF.
 *
 * A especificação manda guardar o manifesto como arquivo embutido, com relação `C2PA_Manifest` —
 * e um manifesto por revisão, já que o PDF cresce por atualização incremental. O conteúdo é uma
 * caixa JUMBF com CBOR dentro.
 *
 * Detectamos a presença e lemos o `claim_generator`, que é uma string de texto no CBOR. NÃO
 * verificamos a assinatura do manifesto: isso exige COSE e a lista de certificados confiáveis da
 * C2PA, que é outro trabalho. Por isso o resultado é sempre apresentado como DECLARADO.
 */
function lerCredenciais(txt: string): { tem: boolean; gerador?: string } {
  const tem = /C2PA_Manifest|application\/c2pa|\bjumb\b|c2pa\.claim/.test(txt)
  if (!tem) return { tem: false }
  /*
   * `claim_generator` no CBOR vem seguido do cabeçalho da string de texto, que carrega o
   * COMPRIMENTO exato. Lemos esse comprimento em vez de raspar caracteres imprimíveis: a primeira
   * versão fazia isso e devolvia "x&make_test_images/0.33.1 c2pa-rs/0.33.1tclaim_generator_info" —
   * com o byte de cabeçalho na frente e invadindo a chave seguinte.
   *
   * Não é um decodificador CBOR completo, e não precisa ser: um campo, um tipo (texto), lido pelas
   * regras do próprio formato.
   */
  const i = txt.indexOf('claim_generator')
  if (i < 0) return { tem: true }
  let j = i + 'claim_generator'.length
  const b = txt.charCodeAt(j)
  let tamanho: number | null = null
  if (b >= 0x60 && b <= 0x77) { tamanho = b - 0x60; j += 1 }          // comprimento embutido (0–23)
  else if (b === 0x78) { tamanho = txt.charCodeAt(j + 1); j += 2 }     // 1 byte de comprimento
  else if (b === 0x79) { tamanho = (txt.charCodeAt(j + 1) << 8) | txt.charCodeAt(j + 2); j += 3 }
  if (tamanho === null || tamanho < 4 || tamanho > 300) return { tem: true }
  const valor = txt.slice(j, j + tamanho).trim()
  // Se veio byte de controle, a leitura saiu do trilho: melhor não mostrar nada.
  return { tem: true, gerador: /^[\x20-\x7e\u00a0-\uffff]+$/.test(valor) ? valor : undefined }
}

/**
 * Lê a origem declarada de um PDF.
 *
 * `campos` são os valores de /Producer e /Creator já decodificados (o leitor de metadados faz isso);
 * `bytes` serve para procurar as marcas que não estão no dicionário /Info.
 */
export function lerOrigem(bytes: Uint8Array, campos: (string | undefined)[]): Origem {
  const txt = dec.decode(bytes)
  const declarados = campos.filter((c): c is string => !!c && c.trim().length > 0)

  const ferramentas: Ferramenta[] = []
  for (const valor of declarados) {
    for (const { padrao, f } of CONHECIDAS) {
      if (padrao.test(valor) && !ferramentas.some((x) => x.nome === f.nome)) {
        ferramentas.push(f)
        break // primeiro padrão que casa ganha: a lista está ordenada do mais específico
      }
    }
  }

  const iptc = MARCAS_IPTC.find(({ padrao }) => padrao.test(txt))
  const credenciais = lerCredenciais(txt)
  const temIa = iptc?.ia === true || ferramentas.some((f) => f.familia === 'ia')

  let veredito: Veredito
  if (temIa) veredito = 'ia_declarada'
  else if (credenciais.tem) veredito = 'credenciais_sem_ia'
  else if (ferramentas.length > 0) veredito = 'ferramenta_identificada'
  else veredito = 'sem_indicacao'

  const resumo =
    veredito === 'ia_declarada'
      ? 'Este arquivo declara conteúdo gerado por inteligência artificial.'
      : veredito === 'credenciais_sem_ia'
        ? 'Este arquivo traz Content Credentials, e elas não declaram geração por IA.'
        : veredito === 'ferramenta_identificada'
          ? `Feito com ${ferramentas.map((f) => f.nome).join(' e ')}, segundo o próprio arquivo.`
          : 'O arquivo não diz nada sobre a própria origem.'

  return {
    veredito,
    ferramentas,
    declarados,
    marcaIptc: iptc ? { rotulo: iptc.rotulo, ia: iptc.ia } : undefined,
    temCredenciais: credenciais.tem,
    geradorC2pa: credenciais.gerador,
    resumo,
  }
}
