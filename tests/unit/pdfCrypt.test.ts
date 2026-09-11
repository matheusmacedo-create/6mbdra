import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { createCipheriv, createHash } from 'node:crypto'
import createModule from '@jspawn/ghostscript-wasm/gs.js'
import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFRef, PDFStream, StandardFonts } from 'pdf-lib'
import {
  authenticateUserPassword,
  computeKeyR234,
  concatBytes,
  hash2B,
  md5,
  objectKeyR234,
  opensWithEmptyUserPassword,
  passwordBytes,
  rc4,
  readEncryptInfo,
} from '../../src/tool/lib/pdfCrypt'
import { aes256Cbc, encryptPdfAes256, encryptPdfRc4, toHex } from '../helpers/encryptPdf'

const ascii = (s: string) => new TextEncoder().encode(s)
const EMPTY = new Uint8Array(0)

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

async function threePagePdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  for (let i = 0; i < 3; i++) {
    const page = doc.addPage([595, 842])
    page.drawText(`Pagina ${i + 1} do documento de teste`, { x: 50, y: 780, size: 24, font })
  }
  return doc.save({ useObjectStreams: false })
}

const loadIgnoring = (bytes: Uint8Array) => PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false })

/** Conteúdo bruto (como gravado no arquivo) do content stream da primeira página + sua ref. */
function firstPageContent(doc: PDFDocument): { ref: PDFRef; bytes: Uint8Array } {
  // O pdf-lib grava /Contents como array de referências.
  const contents = doc.getPage(0).node.get(PDFName.of('Contents'))
  const ref = contents instanceof PDFArray ? contents.get(0) : contents
  if (!(ref instanceof PDFRef)) throw new Error('Contents não é referência indireta')
  const stream = doc.context.lookup(ref)
  if (!(stream instanceof PDFStream)) throw new Error('Contents não é stream')
  return { ref, bytes: stream.getContents() }
}

function encryptDict(doc: PDFDocument): PDFDict {
  return doc.context.lookup(doc.context.trailerInfo.Encrypt, PDFDict)
}

// ---------------------------------------------------------------------------
// Ghostscript (WASM) sob Node — espelha src/tool/workers/gs.worker.ts
// ---------------------------------------------------------------------------

const require = createRequire(import.meta.url)
const wasmBytes = readFileSync(require.resolve('@jspawn/ghostscript-wasm/gs.wasm'))

function lineSink(onLine: (line: string) => void) {
  let buf: number[] = []
  return (c: number | null) => {
    if (c === null || c === 10) {
      if (buf.length) onLine(String.fromCharCode(...buf))
      buf = []
      return
    }
    buf.push(c)
  }
}

interface GsResult {
  exitCode: number
  log: string
  output: Uint8Array
}

async function runGs(input: Uint8Array, extraArgs: string[] = []): Promise<GsResult> {
  const lines: string[] = []
  const Module = await createModule({
    noInitialRun: true,
    // Sob Node o glue tentaria `fetch()` do caminho do wasm: instanciamos com os bytes lidos do disco.
    instantiateWasm: (imports, cb) => {
      WebAssembly.instantiate(wasmBytes, imports).then((r) => cb(r.instance, r.module))
      return {}
    },
    stdout: lineSink((l) => lines.push(l)),
    stderr: lineSink((l) => lines.push(l)),
    print: (t) => lines.push(t),
    printErr: (t) => lines.push(t),
  })
  Module.FS.writeFile('/input.pdf', input)
  let exitCode = 0
  try {
    const code = Module.callMain(['-dSAFER', '-dBATCH', '-dNOPAUSE', '-dNOPROMPT', '-sDEVICE=pdfwrite', '-sOutputFile=/output.pdf', ...extraArgs, '/input.pdf'])
    exitCode = typeof code === 'number' ? code : 0
  } catch (e) {
    const status = (e as { status?: unknown })?.status
    if (typeof status === 'number') exitCode = status
    else throw e
  }
  let output = new Uint8Array(0)
  try {
    output = Module.FS.readFile('/output.pdf', { encoding: 'binary' }).slice()
  } catch {
    // sem saída
  }
  return { exitCode, log: lines.join('\n'), output }
}

async function expectGsOpens(bytes: Uint8Array, extraArgs: string[] = []): Promise<GsResult> {
  const r = await runGs(bytes, extraArgs)
  expect(r.exitCode, r.log).toBe(0)
  expect(r.log).not.toMatch(/password/i)
  expect(new TextDecoder().decode(r.output.subarray(0, 5))).toBe('%PDF-')
  const out = await PDFDocument.load(r.output)
  expect(out.isEncrypted).toBe(false)
  expect(out.getPageCount()).toBe(3)
  return r
}

/**
 * Ghostscript 9.56 (WASM) NÃO sinaliza a recusa pelo exit code: sai com 0, imprime
 * "This file requires a password for access." / "Couldn't initialise file." e o pdfwrite
 * ainda grava um PDF de 1 página em branco. A recusa tem de ser lida do log.
 */
async function expectGsRefuses(bytes: Uint8Array): Promise<GsResult> {
  const r = await runGs(bytes)
  expect(r.log).toMatch(/requires a password/i)
  expect(r.log).toMatch(/Couldn't initialise file/i)
  expect(r.log).not.toMatch(/Processing pages 1 through 3/)
  if (r.output.length) {
    const out = await PDFDocument.load(r.output)
    expect(out.getPageCount()).toBeLessThan(3)
  }
  return r
}

// ---------------------------------------------------------------------------
// Primitivas
// ---------------------------------------------------------------------------

describe('md5', () => {
  it('bate com os vetores da RFC 1321', () => {
    expect(toHex(md5(ascii('')))).toBe('d41d8cd98f00b204e9800998ecf8427e')
    expect(toHex(md5(ascii('abc')))).toBe('900150983cd24fb0d6963f7d28e17f72')
    expect(toHex(md5(ascii('message digest')))).toBe('f96b697d7cb7938d525a2f31aaf161d0')
    // 80 bytes → dois blocos de 64 (exercita o padding que cruza bloco)
    expect(toHex(md5(ascii('12345678901234567890123456789012345678901234567890123456789012345678901234567890')))).toBe(
      '57edf4a22be3c955ac49da2e2107b67a',
    )
  })
  it('lida com tamanhos na fronteira do padding (55, 56, 64 bytes) igual ao node:crypto', () => {
    for (const n of [55, 56, 63, 64, 65, 119, 120, 1000]) {
      const data = new Uint8Array(n).map((_, i) => (i * 7 + 3) & 0xff)
      expect(toHex(md5(data))).toBe(createHash('md5').update(data).digest('hex'))
    }
  })
})

describe('rc4', () => {
  it('bate com os vetores conhecidos', () => {
    expect(toHex(rc4(ascii('Key'), ascii('Plaintext')))).toBe('bbf316e8d940af0ad3')
    expect(toHex(rc4(ascii('Wiki'), ascii('pedia')))).toBe('1021bf0420')
    expect(toHex(rc4(ascii('Secret'), ascii('Attack at dawn')))).toBe('45a01f645fc35b383552544b9bf5')
  })
  it('é simétrica', () => {
    const key = ascii('chave')
    const data = new Uint8Array(300).map((_, i) => i & 0xff)
    expect(rc4(key, rc4(key, data))).toEqual(data)
  })
})

/** Algoritmo 2.B reimplementado com node:crypto (AES sem padding nativo), para conferir o hash2B do WebCrypto. */
function hash2BNode(password: Uint8Array, salt: Uint8Array, udata: Uint8Array): Uint8Array {
  let k = new Uint8Array(createHash('sha256').update(concatBytes([password, salt, udata])).digest())
  let e = new Uint8Array(0)
  let i = 0
  do {
    const block = concatBytes([password, k, udata])
    const k1 = new Uint8Array(block.length * 64)
    for (let j = 0; j < 64; j++) k1.set(block, j * block.length)
    const c = createCipheriv('aes-128-cbc', k.subarray(0, 16), k.subarray(16, 32))
    c.setAutoPadding(false)
    e = new Uint8Array(Buffer.concat([c.update(k1), c.final()]))
    const mod = e.subarray(0, 16).reduce((a, b) => a + b, 0) % 3
    k = new Uint8Array(createHash(mod === 0 ? 'sha256' : mod === 1 ? 'sha384' : 'sha512').update(e).digest())
    i++
  } while (i < 64 || e[e.length - 1] > i - 32)
  return k.slice(0, 32)
}

describe('hash2B (ISO 32000-2 Algoritmo 2.B)', () => {
  const salt = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])
  it('é determinístico, tem 32 bytes e muda com senha/sal/udata', async () => {
    const a = await hash2B(EMPTY, salt, EMPTY)
    const b = await hash2B(EMPTY, salt, EMPTY)
    expect(a.length).toBe(32)
    expect(toHex(a)).toBe(toHex(b))
    expect(toHex(await hash2B(ascii('x'), salt, EMPTY))).not.toBe(toHex(a))
    expect(toHex(await hash2B(EMPTY, new Uint8Array(8), EMPTY))).not.toBe(toHex(a))
    expect(toHex(await hash2B(EMPTY, salt, ascii('u')))).not.toBe(toHex(a))
  })
  it('coincide com a reimplementação em node:crypto (AES-CBC sem padding nativo)', async () => {
    expect(toHex(await hash2B(EMPTY, salt, EMPTY))).toBe(toHex(hash2BNode(EMPTY, salt, EMPTY)))
    expect(toHex(await hash2B(ascii('segredo'), salt, EMPTY))).toBe(toHex(hash2BNode(ascii('segredo'), salt, EMPTY)))
    const udata = new Uint8Array(48).map((_, i) => i)
    expect(toHex(await hash2B(ascii('dono'), salt, udata))).toBe(toHex(hash2BNode(ascii('dono'), salt, udata)))
  })
})

// ---------------------------------------------------------------------------
// Detector + fixtures
// ---------------------------------------------------------------------------

describe('readEncryptInfo / opensWithEmptyUserPassword', () => {
  it('documento sem /Encrypt: info null, abre sem senha', async () => {
    const doc = await loadIgnoring(await threePagePdf())
    expect(doc.isEncrypted).toBe(false)
    expect(readEncryptInfo(doc)).toBeNull()
    expect(await opensWithEmptyUserPassword(doc)).toBe(true)
  })

  it('RC4 R3 só com restrições do dono → true; decifra o content stream com a chave', async () => {
    const plain = await threePagePdf()
    const bytes = await encryptPdfRc4(plain, { ownerPassword: 'dono' })
    const doc = await loadIgnoring(bytes)
    expect(doc.isEncrypted).toBe(true)
    const info = readEncryptInfo(doc)
    expect(info).toMatchObject({ filter: 'Standard', v: 2, r: 3, length: 128, p: -1852, encryptMetadata: true })
    expect(info!.o.length).toBe(32)
    expect(info!.u.length).toBe(32)
    expect(info!.id0.length).toBe(16)
    expect(await opensWithEmptyUserPassword(doc)).toBe(true)
    expect(await authenticateUserPassword(info!, passwordBytes('errada', 3))).toBe(false)

    // Round-trip: Algoritmo 2 + Algoritmo 1 devolvem o conteúdo original da página.
    const original = firstPageContent(await loadIgnoring(plain))
    const encrypted = firstPageContent(doc)
    expect(toHex(encrypted.bytes)).not.toBe(toHex(original.bytes))
    const fileKey = computeKeyR234(info!, EMPTY)
    expect(fileKey.length).toBe(16)
    const objKey = objectKeyR234(fileKey, encrypted.ref.objectNumber, encrypted.ref.generationNumber)
    expect(toHex(rc4(objKey, encrypted.bytes))).toBe(toHex(original.bytes))
  })

  it('RC4 R3 com senha de usuário "segredo" → false; a senha certa valida', async () => {
    const bytes = await encryptPdfRc4(await threePagePdf(), { ownerPassword: 'dono', userPassword: 'segredo' })
    const doc = await loadIgnoring(bytes)
    expect(doc.isEncrypted).toBe(true)
    const info = readEncryptInfo(doc)!
    expect(info.r).toBe(3)
    expect(await opensWithEmptyUserPassword(doc)).toBe(false)
    expect(await authenticateUserPassword(info, passwordBytes('segredo', 3))).toBe(true)
    expect(await authenticateUserPassword(info, passwordBytes('dono', 3))).toBe(false)
  })

  it('RC4 R4 (/V 4, /CF /StdCF /V2): só dono → true; com senha → false', async () => {
    const plain = await threePagePdf()
    const ownerOnly = await loadIgnoring(await encryptPdfRc4(plain, { ownerPassword: 'dono', r: 4 }))
    expect(ownerOnly.isEncrypted).toBe(true)
    expect(readEncryptInfo(ownerOnly)).toMatchObject({ v: 4, r: 4, length: 128 })
    expect(await opensWithEmptyUserPassword(ownerOnly)).toBe(true)

    const withUser = await loadIgnoring(await encryptPdfRc4(plain, { ownerPassword: 'dono', userPassword: 'segredo', r: 4 }))
    expect(readEncryptInfo(withUser)).toMatchObject({ v: 4, r: 4 })
    expect(await opensWithEmptyUserPassword(withUser)).toBe(false)
    expect(await authenticateUserPassword(readEncryptInfo(withUser)!, passwordBytes('segredo', 4))).toBe(true)
  })

  it('AES-256 R6 só com restrições do dono → true; recupera a chave por /UE e decifra o stream', async () => {
    const plain = await threePagePdf()
    const bytes = await encryptPdfAes256(plain, { ownerPassword: 'dono' })
    expect(new TextDecoder().decode(bytes.subarray(0, 8))).toBe('%PDF-2.0')
    const doc = await loadIgnoring(bytes)
    expect(doc.isEncrypted).toBe(true)
    const info = readEncryptInfo(doc)
    expect(info).toMatchObject({ filter: 'Standard', v: 5, r: 6, length: 256, p: -1852, encryptMetadata: true })
    expect(info!.o.length).toBe(48)
    expect(info!.u.length).toBe(48)
    expect(await opensWithEmptyUserPassword(doc)).toBe(true)
    expect(await authenticateUserPassword(info!, passwordBytes('errada', 6))).toBe(false)

    // Algoritmo 2.A: chave intermediária = hash2B(senha, sal de chave, ""); chave de arquivo = AES-256-CBC⁻¹(UE), IV zero.
    const ue = encryptDict(doc).lookup(PDFName.of('UE'), PDFHexString).asBytes()
    expect(ue.length).toBe(32)
    const intermediate = await hash2B(EMPTY, info!.u.subarray(40, 48), EMPTY)
    const fileKey = aes256Cbc(intermediate, new Uint8Array(16), ue, { pad: false, decrypt: true })
    expect(fileKey.length).toBe(32)

    const original = firstPageContent(await loadIgnoring(plain))
    const encrypted = firstPageContent(doc)
    expect(encrypted.bytes.length % 16).toBe(0)
    expect(encrypted.bytes.length).toBeGreaterThan(original.bytes.length + 16)
    const decrypted = aes256Cbc(fileKey, encrypted.bytes.subarray(0, 16), encrypted.bytes.subarray(16), { pad: true, decrypt: true })
    expect(toHex(decrypted)).toBe(toHex(original.bytes))
    // /Length do stream cifrado foi recalculado pelo pdf-lib
    const lengthObj = doc.context.lookup(encrypted.ref, PDFStream).dict.lookup(PDFName.of('Length'))
    expect(String(lengthObj)).toBe(String(encrypted.bytes.length))
  })

  it('AES-256 R6 com senha de usuário "segredo" → false; a senha certa valida', async () => {
    const doc = await loadIgnoring(await encryptPdfAes256(await threePagePdf(), { ownerPassword: 'dono', userPassword: 'segredo' }))
    expect(doc.isEncrypted).toBe(true)
    const info = readEncryptInfo(doc)!
    expect(info.r).toBe(6)
    expect(await opensWithEmptyUserPassword(doc)).toBe(false)
    expect(await authenticateUserPassword(info, passwordBytes('segredo', 6))).toBe(true)
    expect(await authenticateUserPassword(info, passwordBytes('dono', 6))).toBe(false)
  })

  it('filtro que não é /Standard ou /R desconhecido → null', async () => {
    const doc = await loadIgnoring(await encryptPdfRc4(await threePagePdf(), { ownerPassword: 'dono' }))
    const enc = encryptDict(doc)
    enc.set(PDFName.of('Filter'), PDFName.of('Adobe.PubSec'))
    expect(await opensWithEmptyUserPassword(doc)).toBeNull()
    enc.set(PDFName.of('Filter'), PDFName.of('Standard'))
    enc.set(PDFName.of('R'), doc.context.obj(7))
    expect(await opensWithEmptyUserPassword(doc)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Ghostscript como oráculo externo
// ---------------------------------------------------------------------------

describe('Ghostscript (WASM) abre fixtures só-dono e recusa senha de usuário', () => {
  it('RC4 R3 só dono: abre sem senha e reescreve 3 páginas', async () => {
    await expectGsOpens(await encryptPdfRc4(await threePagePdf(), { ownerPassword: 'dono' }))
  })
  it('RC4 R4 só dono: abre sem senha', async () => {
    await expectGsOpens(await encryptPdfRc4(await threePagePdf(), { ownerPassword: 'dono', r: 4 }))
  })
  it('AES-256 R6 só dono: abre sem senha', async () => {
    await expectGsOpens(await encryptPdfAes256(await threePagePdf(), { ownerPassword: 'dono' }))
  })
  it('RC4 R3 com senha de usuário: recusa; com -sPDFPassword abre', async () => {
    const bytes = await encryptPdfRc4(await threePagePdf(), { ownerPassword: 'dono', userPassword: 'segredo' })
    await expectGsRefuses(bytes)
    await expectGsOpens(bytes, ['-sPDFPassword=segredo'])
  })
  it('AES-256 R6 com senha de usuário: recusa; com -sPDFPassword abre', async () => {
    const bytes = await encryptPdfAes256(await threePagePdf(), { ownerPassword: 'dono', userPassword: 'segredo' })
    await expectGsRefuses(bytes)
    await expectGsOpens(bytes, ['-sPDFPassword=segredo'])
  })
})
