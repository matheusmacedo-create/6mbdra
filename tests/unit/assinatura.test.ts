import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { conferirAssinatura } from '../../src/tool/lib/assinatura'
import { OIDS_PADES_APROVADOS, politicaDoOid } from '../../src/tool/lib/politicas-icp'

/**
 * Sonda da Etapa 0 do Conferidor de Assinaturas.
 *
 * A pergunta que estes testes respondem não é "o produto funciona" — é a anterior: DÁ para conferir
 * a integridade de uma assinatura PAdES sem servidor? Se não desse, todo o resto da especificação
 * cairia junto, e é por isso que a própria spec marca esta etapa como bloqueante.
 *
 * As fixtures são geradas com cadeia de teste própria (não ICP-Brasil): a validação de cadeia real
 * é outra dependência, ainda não verificada.
 */
const ler = (n: string) => new Uint8Array(readFileSync(join(process.cwd(), 'tests', 'fixtures', n)))

describe('conferência de assinatura PAdES no navegador', () => {
  it('reconhece um PDF assinado e íntegro', async () => {
    const r = await conferirAssinatura(ler('assinado-ok.pdf'))
    expect(r.estado).toBe('conferida')
    expect(r.signatarios.length).toBeGreaterThan(0)
    expect(r.signatarios[0].nome).toContain('FULANO DE TAL')
    expect(r.cobertura!.assinados).toBeGreaterThan(0)
  })

  it('detecta alteração de UM byte dentro do trecho assinado', async () => {
    /*
     * É o estado que mais importa na prática: o advogado comprimiu ou editou o PDF depois de
     * assinar e não sabe. Um byte trocado precisa derrubar a conferência — se não derrubar, a
     * ferramenta dá um falso "pode protocolar" e causa exatamente o dano que existe para evitar.
     */
    const r = await conferirAssinatura(ler('assinado-quebrado.pdf'))
    expect(r.estado).toBe('quebrada')
    expect(r.orientacao).toMatch(/original/i)
    /*
     * E precisa ser 'quebrada', não 'indeterminada'. Parece detalhe e não é: pkijs LANÇA exceção
     * para resumo que não bate, com signatureVerified = null — indistinguível de "não consegui
     * verificar". Quem simplificar o módulo para confiar só no verify() faz este teste falhar, que
     * é exatamente o ponto: o aviso mais importante do produto sumiria em silêncio.
     */
    expect(r.estado).not.toBe('indeterminada')
  })

  it('não inventa assinatura em PDF que não tem', async () => {
    const semAssinatura = new TextEncoder().encode('%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF')
    const r = await conferirAssinatura(semAssinatura)
    expect(r.estado).toBe('sem_assinatura')
    expect(r.signatarios).toEqual([])
  })

  it('nunca usa a palavra "válida" — conferência não é atestado jurídico', async () => {
    /*
     * A spec chama isto de "o erro que mataria o produto": dizer "assinatura válida" e o juízo
     * recusar a peça. A disciplina de vocabulário precisa sobreviver à pressão por uma mensagem
     * mais simples, e um teste é mais firme que uma intenção.
     */
    for (const f of ['assinado-ok.pdf', 'assinado-quebrado.pdf']) {
      const r = await conferirAssinatura(ler(f))
      const tudo = [r.estado, r.orientacao, r.motivo ?? ''].join(' ').toLowerCase()
      expect(tudo, `"${f}" usa vocabulário de validade jurídica`).not.toMatch(/\bválid|\binválid|autentic/)
    }
  })
})

describe('o modo de falha perigoso', () => {
  it('sem WebCrypto responde "indeterminada", nunca "quebrada"', async () => {
    /*
     * Foi assim que a sonda falhou: página sem contexto seguro, crypto.subtle indefinido, e o
     * módulo dizia "quebrada" para um arquivo íntegro. Mandar recuperar um original que nunca se
     * perdeu é o pior erro que este produto pode cometer — pior que não existir.
     */
    // A guarda é lida a cada chamada, não no import — então basta trocar o global e chamar de novo.
    const original = globalThis.crypto
    try {
      Object.defineProperty(globalThis, 'crypto', { value: { subtle: undefined }, configurable: true })
      const r = await conferirAssinatura(ler('assinado-ok.pdf'))
      expect(r.estado).toBe('indeterminada')
      expect(r.estado).not.toBe('quebrada')
      // E o texto precisa dizer que NÃO deu para conferir, não que o arquivo está errado.
      expect(`${r.orientacao} ${r.motivo ?? ''}`).toMatch(/não foi possível conferir/i)
    } finally {
      Object.defineProperty(globalThis, 'crypto', { value: original, configurable: true })
    }
  })
})

describe('políticas do DOC-ICP-15 (dependência 2 da Etapa 0)', () => {
  it('lê a política declarada nos atributos assinados', async () => {
    /*
     * A fixture declara AD-RB v1.3. O atributo fica entre os ASSINADOS, então lê-lo é confiável
     * mesmo sem validar a cadeia — trocar a política declarada quebraria a assinatura.
     */
    const r = await conferirAssinatura(ler('assinado-politica.pdf'))
    expect(r.estado).toBe('conferida')
    expect(r.politica?.oid).toBe('2.16.76.1.7.1.11.1.3')
    expect(r.politica?.sigla).toBe('AD-RB')
    expect(r.politica?.aprovada).toBe(true)
  })

  it('não inventa política quando a assinatura não declara nenhuma', async () => {
    const r = await conferirAssinatura(ler('assinado-ok.pdf'))
    expect(r.estado).toBe('conferida')
    expect(r.politica).toBeUndefined()
  })

  it('a lista oficial de PAdES aprovadas tem as 18 entradas do LPA_PAdES', () => {
    /*
     * Lidas do LPA_PAdES.der publicado pelo ITI (2,9 KB, 18 políticas em quatro famílias). Se a
     * ICP publicar uma versão nova, este número muda — e é melhor o teste avisar do que a lista
     * envelhecer em silêncio.
     */
    expect(OIDS_PADES_APROVADOS).toHaveLength(18)
    expect(new Set(OIDS_PADES_APROVADOS).size).toBe(18)
    const familias = new Set(OIDS_PADES_APROVADOS.map((o) => politicaDoOid(o)!.sigla))
    expect([...familias].sort()).toEqual(['AD-RA', 'AD-RB', 'AD-RC', 'AD-RT'])
  })

  it('OID de fora do arco brasileiro não vira política da ICP', () => {
    // Assinatura estrangeira ou sem política é comum, e não é defeito do documento.
    expect(politicaDoOid('1.2.840.113549.1.9.16.2.15')).toBeNull()
    expect(politicaDoOid('2.16.76.1.7.1.99.1')).toBeNull()
  })

  it('reconhece a família mas marca como não aprovada um OID fora da lista', () => {
    /*
     * A lista é a fonte da verdade, não o padrão do OID: um identificador que PARECE AD-RB mas não
     * está publicado não pode passar por aprovado.
     */
    const p = politicaDoOid('2.16.76.1.7.1.11.1.9')
    expect(p?.sigla).toBe('AD-RB')
    expect(p?.aprovada).toBe(false)
  })
})
