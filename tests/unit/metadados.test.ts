import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { dataPdf, lerMetadados } from '../../src/tool/lib/metadados'

/**
 * Leitura de metadados de PDF.
 *
 * As fixtures são montadas aqui, com nomes inventados, e isso é deliberado: a medição que motivou
 * esta ferramenta encontrou o NOME COMPLETO de uma pessoa real dentro de um documento público de
 * tribunal, que ela certamente não sabe estar ali. Guardar esse nome no repositório para servir de
 * teste seria cometer exatamente o vazamento que a ferramenta existe para avisar.
 */
const pdf = (corpo: string) => new TextEncoder().encode(corpo)

/** Um PDF mínimo com dicionário /Info. */
function comInfo(campos: string): Uint8Array {
  return pdf(`%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n2 0 obj\n<< ${campos} >>\nendobj\ntrailer\n<< /Info 2 0 R >>\n%%EOF\n`)
}

describe('datas de PDF', () => {
  it('lê o formato completo, com fuso', () => {
    expect(dataPdf("D:20260915120000-03'00'")).toBe('2026-09-15T12:00:00-03:00')
  })

  it('aceita data encurtada, que é comum', () => {
    expect(dataPdf('D:20190705')).toBe('2019-07-05T00:00:00Z')
  })

  it('devolve nada em vez de chutar quando a data não dá para ler', () => {
    // Data pela metade exibida como se fosse completa é pior que data nenhuma.
    expect(dataPdf('D:abc')).toBeUndefined()
    expect(dataPdf('sem data')).toBeUndefined()
    expect(dataPdf('D:99999999')).toBeUndefined()
  })
})

describe('o que o arquivo conta', () => {
  it('lê autor, programas e datas do /Info', () => {
    const m = lerMetadados(comInfo(`/Author (Fulano de Tal) /Creator (Microsoft Word) /Producer (Adobe PDF Library 10.0) /ModDate (D:20211210154036-03'00')`))
    expect(m.autor).toBe('Fulano de Tal')
    expect(m.criadoPor).toBe('Microsoft Word')
    expect(m.gravadoPor).toBe('Adobe PDF Library 10.0')
    expect(m.alteradoEm).toBe('2021-12-10T15:40:36-03:00')
    expect(m.vazio).toBe(false)
  })

  it('decodifica UTF-16, que é como nome com acento chega', () => {
    /*
     * Sem isto, "João" aparece na tela como "þÿ\0J\0o\0ã\0o". Apareceu num arquivo real do TJAP
     * durante a medição que originou esta ferramenta.
     */
    const m = lerMetadados(comInfo('/Author (\\376\\377\\000J\\000o\\000\\343\\000o)'))
    expect(m.autor).toBe('João')
  })

  it('lê string em hexadecimal, o outro jeito de escrever em PDF', () => {
    // "Ana" em hex.
    const m = lerMetadados(comInfo('/Author <416E61>'))
    expect(m.autor).toBe('Ana')
  })

  it('arquivo sem metadado nenhum é marcado como vazio, e isso não é defeito', () => {
    // Para quem ENVIA um documento, vazio é o estado desejável.
    const m = lerMetadados(pdf('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n'))
    expect(m.vazio).toBe(true)
    expect(m.autor).toBeUndefined()
  })

  it('quando há várias revisões, vale o /Info mais recente', () => {
    /*
     * PDF permite salvar acrescentando ao fim. O dicionário antigo continua no arquivo, e ler o
     * primeiro mostraria o autor de anos atrás como se fosse o atual.
     */
    const bytes = pdf(
      `%PDF-1.7\n2 0 obj\n<< /Author (Primeiro Autor) /ModDate (D:20200101000000Z) >>\nendobj\ntrailer\n<< /Info 2 0 R >>\n%%EOF\n` +
      `${' '.repeat(80)}\n5 0 obj\n<< /Author (Autor Recente) /ModDate (D:20260101000000Z) >>\nendobj\ntrailer\n<< /Info 5 0 R >>\n%%EOF\n`,
    )
    const m = lerMetadados(bytes)
    expect(m.autor).toBe('Autor Recente')
    expect(m.alteradoEm).toBe('2026-01-01T00:00:00Z')
    expect(m.revisoes.length).toBe(2)
  })

  it('lê o histórico de edição do XMP', () => {
    const bytes = pdf(
      `%PDF-1.7\n<x:xmpmeta><xmpMM:History><rdf:Seq>` +
      `<rdf:li stEvt:action="created" stEvt:when="2019-01-20T10:00:00-03:00" stEvt:softwareAgent="Adobe InDesign CC"/>` +
      `<rdf:li stEvt:action="converted" stEvt:when="2019-01-21T17:44:27-02:00" stEvt:softwareAgent="Adobe PDF Library"/>` +
      `</rdf:Seq></xmpMM:History></x:xmpmeta>\n%%EOF\n`,
    )
    const m = lerMetadados(bytes)
    expect(m.historico).toHaveLength(2)
    expect(m.historico[0].acao).toBe('created')
    expect(m.historico[1].programa).toBe('Adobe PDF Library')
    expect(m.historico[1].quando).toBe('2019-01-21T17:44:27-02:00')
  })
})

describe('o cruzamento com a assinatura', () => {
  it('não acusa alteração num arquivo assinado bem formado', async () => {
    const m = lerMetadados(new Uint8Array(readFileSync(join(process.cwd(), 'tests', 'fixtures', 'assinado-ok.pdf'))))
    expect(m.temAssinatura).toBe(true)
    expect(m.revisoesDepoisDaAssinatura).toBe(0)
  })

  it('prova que houve escrita depois da assinatura, sem depender de data declarada', () => {
    /*
     * O ponto da ferramenta inteira. Todo o resto deste módulo é declaração — `/ModDate` é o que o
     * programa escreveu e qualquer um edita. Isto aqui é aritmética sobre os bytes que a assinatura
     * protege: se veio depois, veio depois, e o arquivo não tem como mentir sem quebrar a
     * assinatura.
     */
    const base = new Uint8Array(readFileSync(join(process.cwd(), 'tests', 'fixtures', 'assinado-ok.pdf')))
    const acrescentado = new TextEncoder().encode('\n% pagina anexada depois da assinatura\n' + ' '.repeat(200) + '\n%%EOF\n')
    const comSobra = new Uint8Array(base.length + acrescentado.length)
    comSobra.set(base, 0)
    comSobra.set(acrescentado, base.length)

    const m = lerMetadados(comSobra)
    expect(m.temAssinatura).toBe(true)
    expect(m.revisoesDepoisDaAssinatura).toBeGreaterThan(0)
    expect(m.revisoes.at(-1)?.depoisDaAssinatura).toBe(true)
    // E a primeira revisão continua sendo a protegida.
    expect(m.revisoes[0].depoisDaAssinatura).toBe(false)
  })

  it('num arquivo sem assinatura não existe revisão "posterior à assinatura"', () => {
    const m = lerMetadados(comInfo('/Author (Fulano)'))
    expect(m.temAssinatura).toBe(false)
    expect(m.revisoesDepoisDaAssinatura).toBe(0)
    for (const r of m.revisoes) expect(r.depoisDaAssinatura).toBeUndefined()
  })
})
