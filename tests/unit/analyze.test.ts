import { describe, it, expect } from 'vitest'
import { PDFDocument, PDFName, PDFString, PDFHexString, PDFArray, PDFNumber } from 'pdf-lib'
import { analyzePdf, containsBytes, hasPdfHeader } from '../../src/tool/lib/analyze'

async function simplePdf(pages = 2): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  for (let i = 0; i < pages; i++) doc.addPage([595, 842])
  return doc.save()
}

async function signedPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.addPage([595, 842])
  // Campo de assinatura mínimo: /FT /Sig com /V contendo /ByteRange
  const sigValue = doc.context.obj({
    Type: 'Sig',
    Filter: 'Adobe.PPKLite',
    SubFilter: 'adbe.pkcs7.detached',
    ByteRange: PDFArray.withContext(doc.context),
    Contents: PDFHexString.of('00'),
  })
  ;(sigValue.get(PDFName.of('ByteRange')) as PDFArray).push(PDFNumber.of(0))
  const field = doc.context.obj({ FT: 'Sig', T: PDFString.of('Assinatura1'), V: doc.context.register(sigValue) })
  const fieldRef = doc.context.register(field)
  const fields = doc.context.obj([fieldRef])
  doc.catalog.set(PDFName.of('AcroForm'), doc.context.obj({ Fields: fields, SigFlags: 3 }))
  return doc.save({ useObjectStreams: false })
}

describe('analyzePdf', () => {
  it('reads pages of a plain PDF', async () => {
    const a = await analyzePdf(await simplePdf(3))
    expect(a).toMatchObject({ valid: true, pages: 3, encrypted: false, signed: false })
  })
  it('detects digital signatures', async () => {
    const a = await analyzePdf(await signedPdf())
    expect(a.valid).toBe(true)
    expect(a.signed).toBe(true)
  })
  it('rejects non-PDF bytes', async () => {
    const a = await analyzePdf(new TextEncoder().encode('isto não é um pdf'))
    expect(a.valid).toBe(false)
    expect(a.reason).toMatch(/não começa/)
  })
  it('flags garbage after a PDF header as invalid', async () => {
    const junk = new Uint8Array(50_000)
    for (let i = 0; i < junk.length; i++) junk[i] = (i * 7919) & 0xff
    const bytes = new Uint8Array([...new TextEncoder().encode('%PDF-1.4\n'), ...junk])
    const a = await analyzePdf(bytes)
    expect(a.valid).toBe(false)
  })
  it('byte search helpers', () => {
    const hay = new TextEncoder().encode('abc /ByteRange [0 1 2 3] xyz')
    expect(containsBytes(hay, new TextEncoder().encode('/ByteRange'))).toBe(true)
    expect(containsBytes(hay, new TextEncoder().encode('/Sig'))).toBe(false)
    expect(hasPdfHeader(new TextEncoder().encode('junk\n%PDF-1.7'))).toBe(true)
  })
})
