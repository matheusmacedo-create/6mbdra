import { PDFDocument, PDFHexString, PDFName, PDFString, StandardFonts, rgb, pushGraphicsState, popGraphicsState, concatTransformationMatrix, drawObject } from 'pdf-lib'
import { zlibSync } from 'fflate'
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { encryptPdfRc4 } from '../helpers/encryptPdf'

export const FIXTURE_DIR = join(process.cwd(), 'test-results', 'fixtures')
const A4: [number, number] = [595.28, 841.89]

/** Ruído pseudoaleatório determinístico (incompressível → PDF grande), com "linhas de texto". */
function noise(width: number, height: number, seed: number): Uint8Array {
  const data = new Uint8Array(width * height * 3)
  let s = seed >>> 0 || 1
  for (let i = 0; i < data.length; i++) {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    data[i] = 180 + ((s >>> 0) % 76)
  }
  for (let y = 40; y < height - 40; y += 22) {
    for (let yy = y; yy < y + 4; yy++) {
      for (let x = 40; x < width - 40; x++) {
        const i = (yy * width + x) * 3
        data[i] = 20
        data[i + 1] = 20
        data[i + 2] = 30
      }
    }
  }
  return data
}

/** Cria um PDF "digitalizado": cada página é uma imagem RGB grande (FlateDecode de ruído). */
export async function makeScanPdf(path: string, pages: number, width = 1240, height = 1754): Promise<void> {
  const doc = await PDFDocument.create()
  for (let p = 0; p < pages; p++) {
    const compressed = zlibSync(noise(width, height, 1234 + p), { level: 1 })
    const stream = doc.context.stream(compressed, {
      Type: 'XObject',
      Subtype: 'Image',
      Width: width,
      Height: height,
      ColorSpace: 'DeviceRGB',
      BitsPerComponent: 8,
      Filter: 'FlateDecode',
    })
    const ref = doc.context.register(stream)
    const page = doc.addPage(A4)
    const name = page.node.newXObject('Im', ref)
    page.pushOperators(pushGraphicsState(), concatTransformationMatrix(A4[0], 0, 0, A4[1], 0, 0), drawObject(name), popGraphicsState())
  }
  writeFileSync(path, await doc.save({ useObjectStreams: false }))
}

export async function makeTextPdf(path: string, pages: number): Promise<void> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  for (let p = 0; p < pages; p++) {
    const page = doc.addPage(A4)
    for (let i = 0; i < 40; i++) {
      page.drawText(`Pagina ${p + 1}, linha ${i + 1}: texto nativo pesquisavel do documento.`, {
        x: 50,
        y: 800 - i * 18,
        size: 11,
        font,
        color: rgb(0.1, 0.1, 0.1),
      })
    }
  }
  writeFileSync(path, await doc.save())
}

export interface Fixtures {
  scanBig: string
  scanHuge: string
  signedBig: string
  /** Cópia do scan grande só com restrições do dono (senha de usuário vazia: abre sem senha) */
  restricted: string
  /** Cópia do scan grande que exige senha de usuário para abrir */
  userPassword: string
  text: string
  corrupt: string
}

/** Cópia do scan grande com um campo de assinatura mínimo (/FT /Sig + /ByteRange). */
export async function makeSignedCopy(src: string, path: string): Promise<void> {
  const doc = await PDFDocument.load(readFileSync(src))
  const sigValue = doc.context.obj({ Type: 'Sig', Filter: 'Adobe.PPKLite', SubFilter: 'adbe.pkcs7.detached', ByteRange: [0, 0, 0, 0], Contents: PDFHexString.of('00') })
  const field = doc.context.obj({ FT: 'Sig', T: PDFString.of('Assinatura1'), V: doc.context.register(sigValue) })
  doc.catalog.set(PDFName.of('AcroForm'), doc.context.obj({ Fields: [doc.context.register(field)], SigFlags: 3 }))
  writeFileSync(path, await doc.save({ useObjectStreams: false }))
}

export async function ensureFixtures(): Promise<Fixtures> {
  mkdirSync(FIXTURE_DIR, { recursive: true })
  const scanBig = join(FIXTURE_DIR, 'scan_big.pdf')
  const scanHuge = join(FIXTURE_DIR, 'scan_huge.pdf')
  const signedBig = join(FIXTURE_DIR, 'scan_signed.pdf')
  const restricted = join(FIXTURE_DIR, 'scan_restrito.pdf')
  const userPassword = join(FIXTURE_DIR, 'scan_com_senha.pdf')
  const text = join(FIXTURE_DIR, 'text.pdf')
  const corrupt = join(FIXTURE_DIR, 'corrupt.pdf')
  if (!existsSync(scanBig)) await makeScanPdf(scanBig, 3)
  if (!existsSync(scanHuge)) await makeScanPdf(scanHuge, 12)
  if (!existsSync(signedBig)) await makeSignedCopy(scanBig, signedBig)
  if (!existsSync(restricted)) writeFileSync(restricted, await encryptPdfRc4(new Uint8Array(readFileSync(scanBig)), { ownerPassword: 'dono' }))
  if (!existsSync(userPassword)) writeFileSync(userPassword, await encryptPdfRc4(new Uint8Array(readFileSync(scanBig)), { ownerPassword: 'dono', userPassword: 'segredo' }))
  if (!existsSync(text)) await makeTextPdf(text, 20)
  if (!existsSync(corrupt)) {
    const junk = new Uint8Array(7 * 1024 * 1024)
    let s = 99
    for (let i = 0; i < junk.length; i++) {
      s = (s * 1103515245 + 12345) >>> 0
      junk[i] = s >>> 24
    }
    writeFileSync(corrupt, Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.from(junk)]))
  }
  return { scanBig, scanHuge, signedBig, restricted, userPassword, text, corrupt }
}
