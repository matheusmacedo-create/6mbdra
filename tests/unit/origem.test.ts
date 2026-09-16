import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { lerOrigem } from '../../src/tool/lib/origem'

/**
 * Origem do documento.
 *
 * O teste mais importante deste arquivo é o último bloco: o que a ferramenta se recusa a dizer.
 */
const bytes = (s: string) => new TextEncoder().encode(s)
const arquivo = (n: string) => new Uint8Array(readFileSync(join(process.cwd(), 'tests', 'fixtures', 'c2pa', n)))

describe('identificação da ferramenta pelo que o arquivo declara', () => {
  it('reconhece os programas mais comuns nos documentos reais', () => {
    const casos: [string, string][] = [
      ['Microsoft® Word 2019', 'Microsoft Word'],
      ['Skia/PDF m139 Google Docs Renderer', 'Google Docs'],
      ['Canva', 'Canva'],
      ['Adobe InDesign 14.0', 'Adobe InDesign'],
      ['GPL Ghostscript 8.71', 'Ghostscript'],
      ['PDFium', 'PDFium'],
    ]
    for (const [declarado, esperado] of casos) {
      const o = lerOrigem(bytes('%PDF-1.7'), [declarado])
      expect(o.ferramentas[0]?.nome, declarado).toBe(esperado)
      expect(o.veredito).toBe('ferramenta_identificada')
    }
  })

  it('não confunde ferramenta que TEM recursos de IA com documento feito por IA', () => {
    /*
     * Canva e Adobe Express têm geração por IA e são usados o tempo todo sem ela. Dizer "feito por
     * IA" porque o arquivo saiu do Canva seria inventar — e é exatamente o falso positivo que
     * derrubaria a credibilidade da ferramenta no primeiro caso real.
     */
    for (const nome of ['Canva', 'Adobe Express']) {
      const o = lerOrigem(bytes('%PDF-1.7'), [nome])
      expect(o.veredito, nome).toBe('ferramenta_identificada')
      expect(o.veredito).not.toBe('ia_declarada')
      expect(o.ferramentas[0].familia).toBe('design')
      // E a nota precisa dizer isso em voz alta, não só o código.
      expect(o.ferramentas[0].nota).toMatch(/não diz se foram usados/i)
    }
  })

  it('arquivo que não declara nada devolve "sem indicação", e diz isso', () => {
    const o = lerOrigem(bytes('%PDF-1.4\n%%EOF'), [undefined, undefined])
    expect(o.veredito).toBe('sem_indicacao')
    expect(o.ferramentas).toEqual([])
    expect(o.resumo).toMatch(/não diz nada sobre a própria origem/i)
  })
})

describe('a marca oficial de conteúdo gerado por IA', () => {
  it('reconhece trainedAlgorithmicMedia como IA declarada', () => {
    // Valor padronizado da IPTC: quem afirma é o gerador, não nós.
    const o = lerOrigem(bytes('%PDF-1.7 <Iptc4xmpExt:DigitalSourceType>http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia</Iptc4xmpExt:DigitalSourceType>'), [])
    expect(o.veredito).toBe('ia_declarada')
    expect(o.marcaIptc?.ia).toBe(true)
    expect(o.resumo).toMatch(/declara conteúdo gerado por inteligência artificial/i)
  })

  it('composição com IA também conta', () => {
    const o = lerOrigem(bytes('x compositeWithTrainedAlgorithmicMedia x'), [])
    expect(o.veredito).toBe('ia_declarada')
  })

  it('algorithmicMedia puro NÃO é IA — e esse é o falso positivo mais fácil de cometer', () => {
    /*
     * Pela IPTC, `algorithmicMedia` é conteúdo criado por algoritmo que NÃO parte de dados de
     * treino: geração procedural, gráfico calculado, captura de tela. A primeira versão deste
     * módulo marcava como IA enquanto o próprio rótulo dizia "não necessariamente" — o código
     * contradizia o texto que ele mesmo exibia.
     */
    const o = lerOrigem(bytes('x digitalsourcetype/algorithmicMedia x'), [])
    expect(o.veredito).not.toBe('ia_declarada')
    expect(o.marcaIptc?.ia).toBe(false)
  })
})

describe('Content Credentials (C2PA) em arquivo real', () => {
  it('encontra o manifesto e lê o gerador declarado', () => {
    /*
     * Fixture da implementação de referência do próprio projeto C2PA. Um manifesto montado por nós
     * provaria só que o nosso leitor entende o nosso gerador.
     */
    const o = lerOrigem(arquivo('com-credenciais.jpg'), [])
    expect(o.temCredenciais).toBe(true)
    expect(o.geradorC2pa).toBe('make_test_images/0.33.1 c2pa-rs/0.33.1')
  })

  it('lê o gerador pelo comprimento do CBOR, sem lixo em volta', () => {
    /*
     * A primeira versão raspava caracteres imprimíveis e devolvia o byte de cabeçalho do CBOR na
     * frente, invadindo a chave seguinte: "x&make_test_images/…/0.33.1tclaim_generator_info".
     */
    const o = lerOrigem(arquivo('com-credenciais.jpg'), [])
    expect(o.geradorC2pa).not.toMatch(/claim_generator_info/)
    expect(o.geradorC2pa).not.toMatch(/[\x00-\x1f]/)
  })

  it('credenciais sem marca de IA não viram acusação de IA', () => {
    const o = lerOrigem(arquivo('com-credenciais.jpg'), [])
    expect(o.veredito).toBe('credenciais_sem_ia')
  })
})

describe('o que a ferramenta se recusa a dizer', () => {
  it('nenhum resultado carrega probabilidade, percentual ou pontuação', () => {
    /*
     * A regra que define o módulo. Detector de texto por IA não funciona de forma confiável — a
     * própria OpenAI desligou o dela por baixa precisão. Num produto usado para instruir processo,
     * um percentual errado vira acusação falsa contra alguém.
     *
     * Um número implica calibração que não temos. Este teste existe para que ninguém acrescente um
     * "score" achando que melhora a ferramenta.
     */
    const amostras = [
      lerOrigem(bytes('%PDF trainedAlgorithmicMedia'), ['ChatGPT']),
      lerOrigem(bytes('%PDF'), ['Microsoft® Word 2019']),
      lerOrigem(bytes('%PDF'), []),
      lerOrigem(arquivo('com-credenciais.jpg'), []),
    ]
    for (const o of amostras) {
      const tudo = JSON.stringify(o).toLowerCase()
      expect(tudo, 'apareceu vocabulário de probabilidade').not.toMatch(/probabilidade|\bchance\b|percentual|%|\bscore\b|pontuação|\bprovável\b/)
      // E o vocabulário afirmativo é sempre de declaração.
      if (o.veredito !== 'sem_indicacao') expect(tudo).toMatch(/declara|segundo o próprio arquivo/)
    }
  })

  it('nunca afirma que um documento É de IA — no máximo que ele declara ser', () => {
    const o = lerOrigem(bytes('%PDF trainedAlgorithmicMedia'), [])
    expect(o.resumo).toMatch(/declara/)
    expect(o.resumo).not.toMatch(/^este arquivo (foi|é) (feito|gerado) por/i)
  })
})
