/**
 * Gerador de fixtures (só Node): pega um PDF do pdf-lib SEM object streams e devolve
 * uma cópia cifrada com o standard security handler, para testar o detector
 * (src/tool/lib/pdfCrypt.ts) e o Ghostscript com arquivos "só restrições do dono"
 * (senha de usuário vazia) e com senha de usuário de verdade.
 *
 * Algoritmos citados: ISO 32000-1:2008 §7.6.3 (Alg. 1–6) e ISO 32000-2:2020
 * §7.6.4.3–§7.6.4.4 (Alg. 2.B, 8, 9, 10). AES/SHA de `node:crypto`; MD5/RC4 do módulo.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFRawStream, PDFStream, PDFString } from 'pdf-lib'
import type { PDFContext, PDFObject } from 'pdf-lib'
import {
  computeKeyR234,
  computeUserEntryR234,
  concatBytes,
  fileKeyLength,
  hash2B,
  md5,
  objectKeyR234,
  padPassword,
  passwordBytes,
  permissionsLE,
  rc4,
  xorKey,
} from '../../src/tool/lib/pdfCrypt'
import type { EncryptInfo } from '../../src/tool/lib/pdfCrypt'

/** /P típico de "só restrições": imprimir permitido (bit 3), todo o resto negado. */
export const DEFAULT_PERMISSIONS = -1852

export interface Rc4Options {
  ownerPassword: string
  /** Padrão '' → o arquivo abre sem senha (só restrições do dono). */
  userPassword?: string
  /** 3 = /V 2 (RC4 128 bits, PDF 1.4); 4 = /V 4 com crypt filter /V2 (PDF 1.5). Padrão 3. */
  r?: 3 | 4
  permissions?: number
}

export interface Aes256Options {
  ownerPassword: string
  userPassword?: string
  permissions?: number
}

const EMPTY = new Uint8Array(0)
const ZERO_IV = new Uint8Array(16)

export function toHex(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += b.toString(16).padStart(2, '0')
  return s
}

function rand(n: number): Uint8Array {
  return new Uint8Array(randomBytes(n))
}

/** /ID determinístico (16 bytes) derivado de um rótulo. */
function deterministicId(label: string): Uint8Array {
  return md5(new TextEncoder().encode('6mbdra-fixture:' + label))
}

// ---------------------------------------------------------------------------
// AES (node:crypto)
// ---------------------------------------------------------------------------

/** AES-256-CBC; `pad` liga o PKCS#7. Serve para cifrar e decifrar (testes). */
export function aes256Cbc(key: Uint8Array, iv: Uint8Array, data: Uint8Array, opts: { pad: boolean; decrypt?: boolean }): Uint8Array {
  const c = opts.decrypt ? createDecipheriv('aes-256-cbc', key, iv) : createCipheriv('aes-256-cbc', key, iv)
  c.setAutoPadding(opts.pad)
  return new Uint8Array(Buffer.concat([c.update(data), c.final()]))
}

/** AES-256-ECB sem padding (um bloco: /Perms, Algoritmo 10). */
export function aes256EcbNoPad(key: Uint8Array, data: Uint8Array): Uint8Array {
  const c = createCipheriv('aes-256-ecb', key, null)
  c.setAutoPadding(false)
  return new Uint8Array(Buffer.concat([c.update(data), c.final()]))
}

// ---------------------------------------------------------------------------
// Algoritmo 3 — entrada /O para R2–R4
// ---------------------------------------------------------------------------

/**
 * Algoritmo 3 (ISO 32000-1 §7.6.3.4):
 * a) senha do dono (ou a do usuário se não houver) + PAD  b) MD5
 * c) (R≥3) 50× MD5 dos primeiros n bytes  d) chave RC4 = primeiros n bytes
 * e) senha do usuário + PAD  f) RC4  g) (R≥3) 19 passadas com chave XOR i  h) = /O.
 */
export function computeOwnerEntryR234(info: Pick<EncryptInfo, 'r' | 'length'>, ownerPw: Uint8Array, userPw: Uint8Array): Uint8Array {
  const n = fileKeyLength(info)
  let hash = md5(padPassword(ownerPw.length ? ownerPw : userPw))
  if (info.r >= 3) for (let i = 0; i < 50; i++) hash = md5(hash.subarray(0, n))
  const key = hash.slice(0, n)
  let x = rc4(key, padPassword(userPw))
  if (info.r >= 3) for (let i = 1; i <= 19; i++) x = rc4(xorKey(key, i), x)
  return x
}

// ---------------------------------------------------------------------------
// Percurso dos objetos: cifra streams e strings de todos os objetos indiretos
// ---------------------------------------------------------------------------

type ObjectCipher = (objectNumber: number, generationNumber: number, data: Uint8Array) => Uint8Array

function encryptStringsIn(obj: PDFObject, enc: (data: Uint8Array) => Uint8Array): void {
  if (obj instanceof PDFDict) {
    for (const [key, value] of obj.entries()) {
      if (value instanceof PDFString || value instanceof PDFHexString) obj.set(key, PDFHexString.of(toHex(enc(value.asBytes()))))
      else encryptStringsIn(value, enc)
    }
  } else if (obj instanceof PDFArray) {
    for (let i = 0; i < obj.size(); i++) {
      const value = obj.get(i)
      if (value instanceof PDFString || value instanceof PDFHexString) obj.set(i, PDFHexString.of(toHex(enc(value.asBytes()))))
      else encryptStringsIn(value, enc)
    }
  }
}

/**
 * Cifra o conteúdo de todo stream e toda string (direta) de cada objeto indireto,
 * com a chave do objeto que os contém. Deve rodar ANTES de registrar o /Encrypt
 * (as strings dele — /O, /U, ... — não são cifradas) e o /ID fica no trailer, fora daqui.
 * Streams viram PDFRawStream com o mesmo dicionário; o pdf-lib recalcula /Length ao salvar.
 */
function encryptAllObjects(ctx: PDFContext, cipher: ObjectCipher): void {
  for (const [ref, obj] of ctx.enumerateIndirectObjects()) {
    const enc = (data: Uint8Array) => cipher(ref.objectNumber, ref.generationNumber, data)
    if (obj instanceof PDFStream) {
      encryptStringsIn(obj.dict, enc)
      ctx.assign(ref, PDFRawStream.of(obj.dict, enc(obj.getContents())))
    } else {
      encryptStringsIn(obj, enc)
    }
  }
}

function setId(ctx: PDFContext, id0: Uint8Array): void {
  ctx.trailerInfo.ID = ctx.obj([PDFHexString.of(toHex(id0)), PDFHexString.of(toHex(id0))])
}

// ---------------------------------------------------------------------------
// RC4 (R3: /V 2; R4: /V 4 + /CF /StdCF /CFM /V2)
// ---------------------------------------------------------------------------

export async function encryptPdfRc4(bytes: Uint8Array, opts: Rc4Options): Promise<Uint8Array> {
  const r = opts.r ?? 3
  const p = (opts.permissions ?? DEFAULT_PERMISSIONS) | 0
  const doc = await PDFDocument.load(bytes, { updateMetadata: false })
  const ctx = doc.context
  const userPw = passwordBytes(opts.userPassword ?? '', r)
  const ownerPw = passwordBytes(opts.ownerPassword, r)
  const id0 = deterministicId(`rc4:r${r}:${opts.ownerPassword}:${opts.userPassword ?? ''}:${p}`)

  // Algoritmo 3 → /O; Algoritmo 2 → chave de arquivo; Algoritmo 5 → /U (16 bytes + 16 de padding).
  const base: EncryptInfo = { filter: 'Standard', v: r === 4 ? 4 : 2, r, length: 128, o: EMPTY, u: EMPTY, p, encryptMetadata: true, id0 }
  const o = computeOwnerEntryR234(base, ownerPw, userPw)
  const info: EncryptInfo = { ...base, o }
  const fileKey = computeKeyR234(info, userPw)
  const u = concatBytes([computeUserEntryR234(info, fileKey), new Uint8Array(16)])

  // Algoritmo 1: chave por objeto; RC4 mantém o tamanho, então /Length continua válido.
  encryptAllObjects(ctx, (num, gen, data) => rc4(objectKeyR234(fileKey, num, gen), data))

  const O = PDFHexString.of(toHex(o))
  const U = PDFHexString.of(toHex(u))
  const encDict =
    r === 4
      ? ctx.obj({
          Filter: 'Standard',
          V: 4,
          R: 4,
          Length: 128,
          CF: { StdCF: { CFM: 'V2', AuthEvent: 'DocOpen', Length: 16 } },
          StmF: 'StdCF',
          StrF: 'StdCF',
          P: p,
          O,
          U,
        })
      : ctx.obj({ Filter: 'Standard', V: 2, R: 3, Length: 128, P: p, O, U })
  ctx.trailerInfo.Encrypt = ctx.register(encDict)
  setId(ctx, id0)
  return doc.save({ useObjectStreams: false, updateFieldAppearances: false })
}

// ---------------------------------------------------------------------------
// AES-256 (R6: /V 5 + /CF /StdCF /CFM /AESV3)
// ---------------------------------------------------------------------------

export async function encryptPdfAes256(bytes: Uint8Array, opts: Aes256Options): Promise<Uint8Array> {
  const p = (opts.permissions ?? DEFAULT_PERMISSIONS) | 0
  const doc = await PDFDocument.load(bytes, { updateMetadata: false })
  const ctx = doc.context
  const userPw = passwordBytes(opts.userPassword ?? '', 6)
  const ownerPw = passwordBytes(opts.ownerPassword, 6)
  const id0 = deterministicId(`aes256:r6:${opts.ownerPassword}:${opts.userPassword ?? ''}:${p}`)
  const fileKey = rand(32)

  // Algoritmo 8: /U = hash2B(senha_u, sal_validação, "") + sal_validação + sal_chave;
  // /UE = AES-256-CBC sem padding, IV zero, chave hash2B(senha_u, sal_chave, ""), sobre a chave de arquivo.
  const uValidationSalt = rand(8)
  const uKeySalt = rand(8)
  const u = concatBytes([await hash2B(userPw, uValidationSalt, EMPTY), uValidationSalt, uKeySalt])
  const ue = aes256Cbc(await hash2B(userPw, uKeySalt, EMPTY), ZERO_IV, fileKey, { pad: false })

  // Algoritmo 9: igual, com udata = os 48 bytes de /U.
  const oValidationSalt = rand(8)
  const oKeySalt = rand(8)
  const o = concatBytes([await hash2B(ownerPw, oValidationSalt, u), oValidationSalt, oKeySalt])
  const oe = aes256Cbc(await hash2B(ownerPw, oKeySalt, u), ZERO_IV, fileKey, { pad: false })

  // Algoritmo 10: /Perms = AES-256-ECB(chave de arquivo) de P(4 LE) + ffffffff + 'T' + 'adb' + 4 aleatórios.
  const permsPlain = concatBytes([permissionsLE(p), new Uint8Array([0xff, 0xff, 0xff, 0xff]), new TextEncoder().encode('Tadb'), rand(4)])
  const perms = aes256EcbNoPad(fileKey, permsPlain)

  // AESV3: a chave do objeto É a chave de arquivo; IV aleatório de 16 bytes na frente + PKCS#7.
  encryptAllObjects(ctx, (_num, _gen, data) => {
    const iv = rand(16)
    return concatBytes([iv, aes256Cbc(fileKey, iv, data, { pad: true })])
  })

  const encDict = ctx.obj({
    Filter: 'Standard',
    V: 5,
    R: 6,
    Length: 256,
    CF: { StdCF: { CFM: 'AESV3', AuthEvent: 'DocOpen', Length: 32 } },
    StmF: 'StdCF',
    StrF: 'StdCF',
    EncryptMetadata: true,
    P: p,
    O: PDFHexString.of(toHex(o)),
    U: PDFHexString.of(toHex(u)),
    OE: PDFHexString.of(toHex(oe)),
    UE: PDFHexString.of(toHex(ue)),
    Perms: PDFHexString.of(toHex(perms)),
  })
  ctx.trailerInfo.Encrypt = ctx.register(encDict)
  setId(ctx, id0)
  const out = await doc.save({ useObjectStreams: false, updateFieldAppearances: false })
  // R6 é PDF 2.0. O PDFWriter do pdf-lib ignora context.header e grava sempre "%PDF-1.7";
  // trocar os 8 bytes do cabeçalho não mexe em nenhum offset da xref.
  out.set(new TextEncoder().encode('%PDF-2.0'), 0)
  return out
}
