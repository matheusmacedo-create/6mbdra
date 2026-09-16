import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as pkijs from 'pkijs'
import { validarCadeia } from '../../src/tool/lib/cadeia-icp'
import { RAIZES_ICP } from '../../src/tool/lib/raizes-icp'

/**
 * Validação de cadeia contra as raízes da ICP-Brasil.
 *
 * As fixtures aqui são certificados REAIS de autoridades da ICP-Brasil, e isso é o ponto: uma
 * cadeia de teste própria provaria apenas que o código valida o que ele mesmo gerou. Com
 * certificados de verdade, o que fica provado é o depósito de raízes embutido contra assinaturas
 * do ITI.
 */
const cert = (n: string) => {
  const bruto = readFileSync(join(process.cwd(), 'tests', 'fixtures', 'icp', n))
  const texto = bruto.toString('latin1')
  const der = texto.includes('BEGIN CERTIFICATE')
    ? Buffer.from(texto.replace(/-----[^-]+-----/g, '').replace(/\s+/g, ''), 'base64')
    : bruto
  return pkijs.Certificate.fromBER(new Uint8Array(der))
}

describe('as raízes embutidas', () => {
  it('são doze, todas com impressão digital fixada e distinta', () => {
    expect(RAIZES_ICP).toHaveLength(12)
    expect(new Set(RAIZES_ICP.map((r) => r.sha256)).size).toBe(12)
    for (const r of RAIZES_ICP) expect(r.sha256, `v${r.versao}`).toMatch(/^[0-9a-f]{64}$/)
  })

  it('a impressão digital fixada bate com o certificado guardado', async () => {
    /*
     * É o que torna aceitável ter baixado as raízes por HTTP: certificado é autoautenticável, e a
     * impressão digital é o que garante a origem — não o canal. Se alguém trocar um `der` aqui sem
     * trocar o `sha256`, este teste quebra.
     */
    for (const r of RAIZES_ICP) {
      const bytes = Uint8Array.from(Buffer.from(r.der, 'base64'))
      const resumo = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
      const hex = [...resumo].map((b) => b.toString(16).padStart(2, '0')).join('')
      expect(hex, `raiz v${r.versao}`).toBe(r.sha256)
    }
  })

  it('cada raiz é um certificado legível e autoassinado', () => {
    for (const r of RAIZES_ICP) {
      const c = pkijs.Certificate.fromBER(Uint8Array.from(Buffer.from(r.der, 'base64')))
      const dn = (n: pkijs.RelativeDistinguishedNames) =>
        n.typesAndValues.map((t) => `${t.type}=${String(t.value.valueBlock.value)}`).join('|')
      expect(dn(c.subject), `v${r.versao}`).toBe(dn(c.issuer))
      expect(r.nome).toMatch(/Raiz Brasileira/)
    }
  })
})

describe('validação contra certificados reais da ICP-Brasil', () => {
  it('monta a cadeia de dois níveis, como numa assinatura de verdade', async () => {
    /*
     * É a estrutura real: o certificado do signatário é emitido por uma AC, que é emitida pela
     * raiz. A AC vem DENTRO do arquivo assinado (é o que o segundo argumento representa); a raiz,
     * não — ela mora no código. Um teste de um nível só não exercitaria isso.
     */
    const r = await validarCadeia(cert('ac-prime-v5.crt'), [cert('ac-soluti-v5.crt')])
    expect(r.estado).toBe('icp_brasil')
    expect(r.raiz).toMatch(/Raiz Brasileira v5/)
    expect(r.altura).toBe(3)
  })

  it('a MESMA autoridade, sem o elo intermediário, vira "incompleta" e não "fora da ICP"', async () => {
    /*
     * O par com o teste acima é o que prova a distinção valer: mesmo certificado, mesma origem,
     * mudou só o que veio junto no arquivo. Dizer "fora da ICP-Brasil" aqui seria acusar de
     * irregular um certificado perfeitamente regular — o erro que mais custaria caro neste produto.
     */
    const r = await validarCadeia(cert('ac-prime-v5.crt'), [])
    expect(r.estado).toBe('incompleta')
    expect(r.estado).not.toBe('fora_da_icp')
  })

  it('autoridade emitida direto pela raiz também fecha', async () => {
    const r = await validarCadeia(cert('ac-digital-mais.crt'), [])
    expect(r.estado).toBe('icp_brasil')
    expect(r.altura).toBe(2)
  })

  it('reconhece outro ramo, com outra raiz', async () => {
    const r = await validarCadeia(cert('ac-certisign-g4.crt'), [])
    expect(r.estado).toBe('icp_brasil')
    expect(r.raiz).toMatch(/Raiz Brasileira v10/)
  })

  it('ramo Ed25519 vira "não verificada", NUNCA "fora da ICP"', async () => {
    /*
     * As raízes v6 e v7 e todo o ramo do INMETRO (carimbo do tempo) usam Ed25519, que a biblioteca
     * de ASN.1 usada aqui não verifica. São certificados ICP-Brasil legítimos: chamá-los de "fora da
     * ICP-Brasil" seria uma acusação falsa contra um documento correto.
     *
     * É a mesma regra que governa o módulo inteiro — impossibilidade de conferir nunca vira
     * veredito negativo — aplicada ao lugar onde ela é mais fácil de violar sem perceber.
     */
    const r = await validarCadeia(cert('inmetro-ed25519.crt'), [])
    expect(r.estado).toBe('nao_verificada')
    expect(r.estado).not.toBe('fora_da_icp')
    // E precisa dizer para onde o caminho aponta, senão a resposta não ajuda ninguém.
    expect(r.raiz).toMatch(/Raiz Brasileira v6/)
    expect(r.motivo).toMatch(/algoritmo/i)
  })

  it('uma raiz entregue como signatária é reconhecida, e não confundida com autoassinado qualquer', async () => {
    const v13 = pkijs.Certificate.fromBER(Uint8Array.from(Buffer.from(RAIZES_ICP.find((r) => r.versao === 13)!.der, 'base64')))
    const r = await validarCadeia(v13, [])
    expect(r.estado).toBe('icp_brasil')
  })
})

describe('os casos que não são ICP-Brasil', () => {
  it('certificado que assina a si mesmo fica de fora, com o motivo certo', async () => {
    const { conferirAssinatura } = await import('../../src/tool/lib/assinatura')
    const bytes = new Uint8Array(readFileSync(join(process.cwd(), 'tests', 'fixtures', 'assinado-autoassinado.pdf')))
    const r = await conferirAssinatura(bytes)
    expect(r.cadeia?.estado).toBe('fora_da_icp')
    expect(r.cadeia?.motivo).toMatch(/assina a si mesmo/i)
  })

  it('cadeia sem os elos intermediários é "incompleta", não "fora da ICP"', async () => {
    /*
     * A distinção protege quem não tem culpa: faltar uma autoridade que o arquivo deveria ter
     * trazido é defeito do arquivo, não prova de que o certificado seja irregular.
     */
    const { conferirAssinatura } = await import('../../src/tool/lib/assinatura')
    const bytes = new Uint8Array(readFileSync(join(process.cwd(), 'tests', 'fixtures', 'assinado-ok.pdf')))
    const r = await conferirAssinatura(bytes)
    // A fixture traz só a folha; a AC de teste não vai junto.
    expect(r.cadeia?.estado).toBe('incompleta')
    expect(r.cadeia?.motivo).toMatch(/não trouxe a autoridade/i)
  })

  it('a verificação de cadeia nunca busca nada na rede', async () => {
    /*
     * Consultar revogação ou baixar uma autoridade faltante contaria a um terceiro que ESTE
     * documento está sendo conferido aqui — o oposto da promessa do produto. O teste trava isso no
     * nível do código, não da intenção.
     */
    const original = globalThis.fetch
    let chamou = false
    globalThis.fetch = (...a: Parameters<typeof fetch>) => { chamou = true; return original(...a) }
    try {
      await validarCadeia(cert('ac-prime-v5.crt'), [])
      await validarCadeia(cert('inmetro-ed25519.crt'), [])
      expect(chamou, 'a validação de cadeia saiu para a rede').toBe(false)
    } finally {
      globalThis.fetch = original
    }
  })
})
