/**
 * Gera as fixtures de PDF assinado usadas pelos testes do conferidor.
 *
 * Não são documentos da ICP-Brasil: a cadeia é de teste, gerada aqui. Servem para provar que o
 * parse e a checagem de integridade funcionam sem servidor — a validação contra raízes reais é
 * outra dependência, ainda não construída.
 *
 * Uso: node scripts/fixtures/gera-assinado.mjs
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { webcrypto } from 'node:crypto'
import * as pkijs from 'pkijs'
import * as asn1js from 'asn1js'

pkijs.setEngine('node', new pkijs.CryptoEngine({ name: 'node', crypto: webcrypto }))

const ESPACO = 8192
const DESTINO = join(process.cwd(), 'tests', 'fixtures')

/** Certificado autoassinado + chave, para servir de signatário de teste. */
async function certificadoDeTeste(nomeComum) {
  const chaves = await webcrypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  )
  const cert = new pkijs.Certificate()
  cert.version = 2
  cert.serialNumber = new asn1js.Integer({ value: 20260916 })
  for (const alvo of [cert.issuer, cert.subject]) {
    alvo.typesAndValues.push(
      new pkijs.AttributeTypeAndValue({ type: '2.5.4.3', value: new asn1js.PrintableString({ value: nomeComum }) }),
    )
  }
  cert.notBefore.value = new Date(Date.UTC(2026, 0, 1))
  cert.notAfter.value = new Date(Date.UTC(2028, 0, 1))
  await cert.subjectPublicKeyInfo.importKey(chaves.publicKey, pkijs.getCrypto(true))
  await cert.sign(chaves.privateKey, 'SHA-256', pkijs.getCrypto(true))
  return { cert, chave: chaves.privateKey }
}

/** PDF de uma página com campo de assinatura e /Contents reservado com zeros. */
function montaPdf() {
  const objs = new Map()
  objs.set(1, '<< /Type /Catalog /Pages 2 0 R /AcroForm << /Fields [5 0 R] /SigFlags 3 >> >>')
  objs.set(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>')
  objs.set(3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Annots [5 0 R] >>')
  const fluxo = 'BT /F1 12 Tf 72 760 Td (Peticao de teste assinada digitalmente) Tj ET'
  objs.set(4, `<< /Length ${fluxo.length} >>\nstream\n${fluxo}\nendstream`)
  objs.set(5, '<< /Type /Annot /Subtype /Widget /FT /Sig /T (Assinatura1) /Rect [0 0 0 0] /V 6 0 R /P 3 0 R /F 132 >>')

  const partes = ['%PDF-1.7\n%\xe2\xe3\xcf\xd3\n']
  const offs = new Map()
  let tam = partes[0].length
  for (const [n, corpo] of [...objs].sort((a, b) => a[0] - b[0])) {
    offs.set(n, tam)
    const t = `${n} 0 obj\n${corpo}\nendobj\n`
    partes.push(t)
    tam += t.length
  }

  offs.set(6, tam)
  const marcador = '[0 0000000000 0000000000 0000000000]'
  const cabeca =
    '6 0 obj\n<< /Type /Sig /Filter /Adobe.PPKLite /SubFilter /adbe.pkcs7.detached ' +
    `/Name (FULANO DE TAL) /M (D:20260915120000-03'00') /ByteRange ${marcador} /Contents <`
  partes.push(cabeca)
  const iniContents = tam + cabeca.length
  const zeros = '0'.repeat(ESPACO * 2)
  const rabo = `${zeros}> >>\nendobj\n`
  partes.push(rabo)
  const fimContents = iniContents + zeros.length
  let corpo = partes.join('')

  const iniXref = corpo.length
  let xref = `xref\n0 8\n0000000000 65535 f \n`
  for (let n = 1; n <= 6; n++) xref += `${String(offs.get(n)).padStart(10, '0')} 00000 n \n`
  corpo += xref + `trailer\n<< /Size 8 /Root 1 0 R >>\nstartxref\n${iniXref}\n%%EOF\n`

  // ByteRange real: os dois trechos fora do buraco do /Contents.
  const br = `[0 ${iniContents - 1} ${fimContents + 1} ${corpo.length - (fimContents + 1)}]`
  corpo = corpo.replace(marcador, br.padEnd(marcador.length, ' '))
  return { pdf: Buffer.from(corpo, 'latin1'), iniContents, fimContents }
}

/** Monta o CMS destacado sobre os bytes do ByteRange, opcionalmente declarando uma política. */
async function assina(assinados, { cert, chave }, oidPolitica) {
  const resumo = await webcrypto.subtle.digest('SHA-256', assinados)
  const atributos = [
    new pkijs.Attribute({ type: '1.2.840.113549.1.9.3', values: [new asn1js.ObjectIdentifier({ value: '1.2.840.113549.1.7.1' })] }),
    new pkijs.Attribute({ type: '1.2.840.113549.1.9.4', values: [new asn1js.OctetString({ valueHex: resumo })] }),
  ]
  if (oidPolitica) {
    /*
     * signature-policy-identifier (RFC 5126 §5.8.1). Vai entre os atributos ASSINADOS de propósito:
     * é o que impede alguém de trocar a política declarada sem quebrar a assinatura.
     */
    atributos.push(
      new pkijs.Attribute({
        type: '1.2.840.113549.1.9.16.2.15',
        values: [
          new asn1js.Sequence({
            value: [
              new asn1js.ObjectIdentifier({ value: oidPolitica }),
              new asn1js.Sequence({
                value: [
                  new pkijs.AlgorithmIdentifier({ algorithmId: '2.16.840.1.101.3.4.2.1' }).toSchema(),
                  new asn1js.OctetString({ valueHex: resumo }),
                ],
              }),
            ],
          }),
        ],
      }),
    )
  }

  const signed = new pkijs.SignedData({
    version: 1,
    encapContentInfo: new pkijs.EncapsulatedContentInfo({ eContentType: '1.2.840.113549.1.7.1' }),
    signerInfos: [
      new pkijs.SignerInfo({
        version: 1,
        sid: new pkijs.IssuerAndSerialNumber({ issuer: cert.issuer, serialNumber: cert.serialNumber }),
        signedAttrs: new pkijs.SignedAndUnsignedAttributes({ type: 0, attributes: atributos }),
      }),
    ],
    certificates: [cert],
  })
  await signed.sign(chave, 0, 'SHA-256')
  const info = new pkijs.ContentInfo({ contentType: '1.2.840.113549.1.7.2', content: signed.toSchema(true) })
  return Buffer.from(info.toSchema().toBER(false))
}

function insere(pdf, ini, fim, cms) {
  const hex = cms.toString('hex').toUpperCase()
  const espaco = fim - ini
  if (hex.length > espaco) throw new Error(`CMS de ${hex.length} não cabe em ${espaco}`)
  return Buffer.concat([pdf.subarray(0, ini), Buffer.from(hex + '0'.repeat(espaco - hex.length), 'latin1'), pdf.subarray(fim)])
}

const signatario = await certificadoDeTeste('FULANO DE TAL:12345678901')

for (const [arquivo, oid] of [
  ['assinado-ok.pdf', null],
  // AD-RB v1.3, a política PAdES aprovada mais usada no dia a dia.
  ['assinado-politica.pdf', '2.16.76.1.7.1.11.1.3'],
]) {
  const { pdf, iniContents, fimContents } = montaPdf()
  const assinados = Buffer.concat([pdf.subarray(0, iniContents - 1), pdf.subarray(fimContents + 1)])
  const final = insere(pdf, iniContents, fimContents, await assina(assinados, signatario, oid))
  writeFileSync(join(DESTINO, arquivo), final)
  console.log(`  ${arquivo}: ${final.length} bytes, assinatura cobre ${assinados.length}${oid ? `, política ${oid}` : ''}`)

  if (arquivo === 'assinado-ok.pdf') {
    // O gêmeo alterado: UM byte trocado dentro do trecho assinado.
    const quebrado = Buffer.from(final)
    quebrado[200] = quebrado[200] === 0x41 ? 0x42 : 0x41
    writeFileSync(join(DESTINO, 'assinado-quebrado.pdf'), quebrado)
    console.log(`  assinado-quebrado.pdf: 1 byte trocado na posição 200`)
  }
}
