/**
 * Criptografia do "standard security handler" de PDF, só o suficiente para responder:
 * "este PDF cifrado abre com senha de usuário VAZIA?" (ou seja, só carrega restrições
 * de edição do dono e não exige senha para abrir).
 *
 * Roda em Web Worker e em Node ≥ 22 (vitest): não importa nada específico de Node.
 * SHA-2 e AES-CBC vêm de `globalThis.crypto.subtle`; MD5 e RC4 (que o WebCrypto não
 * tem) estão implementados abaixo em TypeScript puro.
 *
 * Referências (números de algoritmo citados nos comentários):
 * - ISO 32000-1:2008 (PDF 1.7) §7.6.3 — Algoritmos 1 a 6 (RC4/AESV2, R2–R4).
 * - Adobe Supplement to ISO 32000, BaseVersion 1.7, ExtensionLevel 3 — R5 (AESV3, SHA-256).
 * - ISO 32000-2:2020 (PDF 2.0) §7.6.4.3.3/§7.6.4.3.4 — R6, Algoritmo 2.B (hash iterado).
 */
import { PDFArray, PDFBool, PDFDict, PDFHexString, PDFName, PDFNumber, PDFRef, PDFString } from 'pdf-lib'
import type { PDFDocument, PDFObject } from 'pdf-lib'

export interface EncryptInfo {
  /** /Filter sem a barra inicial (ex.: "Standard"). */
  filter: string
  /** /V (algoritmo): 1, 2, 4 ou 5. */
  v: number
  /** /R (revisão do standard security handler): 2, 3, 4, 5 ou 6. */
  r: number
  /** /Length em bits (padrão 40). */
  length: number
  /** /O — 32 bytes (R2–R4) ou 48 bytes (R5/R6). */
  o: Uint8Array
  /** /U — 32 bytes (R2–R4) ou 48 bytes (R5/R6). */
  u: Uint8Array
  /** /P normalizado para int32 com sinal. */
  p: number
  /** /EncryptMetadata (padrão true). */
  encryptMetadata: boolean
  /** Primeiro elemento do /ID do trailer (vazio se o arquivo não tiver /ID). */
  id0: Uint8Array
}

/** Cadeia de padding do Algoritmo 2 (ISO 32000-1 §7.6.3.3), 32 bytes. */
export const PASSWORD_PAD = new Uint8Array([
  0x28, 0xbf, 0x4e, 0x5e, 0x4e, 0x75, 0x8a, 0x41, 0x64, 0x00, 0x4e, 0x56, 0xff, 0xfa, 0x01, 0x08, 0x2e, 0x2e, 0x00, 0xb6, 0xd0,
  0x68, 0x3e, 0x80, 0x2f, 0x0c, 0xa9, 0xfe, 0x64, 0x53, 0x69, 0x7a,
])

// ---------------------------------------------------------------------------
// Utilidades de bytes
// ---------------------------------------------------------------------------

export function concatBytes(parts: Uint8Array[]): Uint8Array {
  let total = 0
  for (const p of parts) total += p.length
  const out = new Uint8Array(total)
  let off = 0
  for (const p of parts) {
    out.set(p, off)
    off += p.length
  }
  return out
}

/** Cópia em um ArrayBuffer novo (o WebCrypto exige `Uint8Array<ArrayBuffer>`). */
function fresh(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(bytes.length)
  out.set(bytes)
  return out
}

function bytesEqual(a: Uint8Array, b: Uint8Array, len = a.length): boolean {
  if (a.length < len || b.length < len) return false
  let diff = 0
  for (let i = 0; i < len; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

/** /P como 4 bytes little-endian (int32 com sinal), exigido pelo Algoritmo 2 passo d. */
export function permissionsLE(p: number): Uint8Array {
  const out = new Uint8Array(4)
  new DataView(out.buffer).setInt32(0, p | 0, true)
  return out
}

/**
 * Converte a senha em bytes conforme a revisão:
 * - R2–R4: PDFDocEncoding/Latin-1, cortada em 32 bytes (Algoritmo 2 passo a).
 * - R5/R6: UTF-8 (a norma pede SASLprep; ASCII puro é idêntico), cortada em 127 bytes.
 */
export function passwordBytes(password: string, r: number): Uint8Array {
  if (r >= 5) return new TextEncoder().encode(password).subarray(0, 127)
  const out = new Uint8Array(Math.min(32, password.length))
  for (let i = 0; i < out.length; i++) out[i] = password.charCodeAt(i) & 0xff
  return out
}

/** Algoritmo 2 passo a: senha + PAD, truncada a 32 bytes. */
export function padPassword(password: Uint8Array): Uint8Array {
  const out = new Uint8Array(32)
  const n = Math.min(32, password.length)
  out.set(password.subarray(0, n))
  out.set(PASSWORD_PAD.subarray(0, 32 - n), n)
  return out
}

// ---------------------------------------------------------------------------
// MD5 (RFC 1321) — implementação direta, usada pelos Algoritmos 1–5.
// ---------------------------------------------------------------------------

const MD5_S = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4, 11, 16,
  23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
]
const MD5_K = new Uint32Array(64)
for (let i = 0; i < 64; i++) MD5_K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000) >>> 0

export function md5(input: Uint8Array): Uint8Array {
  const len = input.length
  const blocks = ((len + 8) >> 6) + 1
  const padded = new Uint8Array(blocks * 64)
  padded.set(input)
  padded[len] = 0x80
  const dv = new DataView(padded.buffer)
  const bitLen = len * 8
  dv.setUint32(padded.length - 8, bitLen >>> 0, true)
  dv.setUint32(padded.length - 4, Math.floor(bitLen / 0x100000000), true)

  let a0 = 0x67452301
  let b0 = 0xefcdab89
  let c0 = 0x98badcfe
  let d0 = 0x10325476
  const M = new Uint32Array(16)
  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) M[i] = dv.getUint32(off + i * 4, true)
    let A = a0
    let B = b0
    let C = c0
    let D = d0
    for (let i = 0; i < 64; i++) {
      let F: number
      let g: number
      if (i < 16) {
        F = (B & C) | (~B & D)
        g = i
      } else if (i < 32) {
        F = (D & B) | (~D & C)
        g = (5 * i + 1) & 15
      } else if (i < 48) {
        F = B ^ C ^ D
        g = (3 * i + 5) & 15
      } else {
        F = C ^ (B | ~D)
        g = (7 * i) & 15
      }
      F = (F + A + MD5_K[i] + M[g]) | 0
      A = D
      D = C
      C = B
      B = (B + ((F << MD5_S[i]) | (F >>> (32 - MD5_S[i])))) | 0
    }
    a0 = (a0 + A) | 0
    b0 = (b0 + B) | 0
    c0 = (c0 + C) | 0
    d0 = (d0 + D) | 0
  }
  const out = new Uint8Array(16)
  const ov = new DataView(out.buffer)
  ov.setUint32(0, a0 >>> 0, true)
  ov.setUint32(4, b0 >>> 0, true)
  ov.setUint32(8, c0 >>> 0, true)
  ov.setUint32(12, d0 >>> 0, true)
  return out
}

// ---------------------------------------------------------------------------
// RC4 — cifra de fluxo dos filtros /V2 (R2–R4). Simétrica: cifrar == decifrar.
// ---------------------------------------------------------------------------

export function rc4(key: Uint8Array, data: Uint8Array): Uint8Array {
  if (key.length === 0) throw new Error('rc4: chave vazia')
  const S = new Uint8Array(256)
  for (let i = 0; i < 256; i++) S[i] = i
  let j = 0
  for (let i = 0; i < 256; i++) {
    j = (j + S[i] + key[i % key.length]) & 0xff
    const t = S[i]
    S[i] = S[j]
    S[j] = t
  }
  const out = new Uint8Array(data.length)
  let i = 0
  j = 0
  for (let k = 0; k < data.length; k++) {
    i = (i + 1) & 0xff
    j = (j + S[i]) & 0xff
    const t = S[i]
    S[i] = S[j]
    S[j] = t
    out[k] = data[k] ^ S[(S[i] + S[j]) & 0xff]
  }
  return out
}

// ---------------------------------------------------------------------------
// SHA-2 / AES via WebCrypto
// ---------------------------------------------------------------------------

async function sha(algo: 'SHA-256' | 'SHA-384' | 'SHA-512', data: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await globalThis.crypto.subtle.digest(algo, fresh(data)))
}

export function sha256(data: Uint8Array): Promise<Uint8Array> {
  return sha('SHA-256', data)
}

/**
 * AES-128-CBC sem padding sobre `data` (múltiplo de 16 bytes). O WebCrypto sempre
 * aplica PKCS#7, então ciframos e descartamos o último bloco (que é só padding).
 */
async function aes128CbcNoPad(key: Uint8Array, iv: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  if (data.length % 16 !== 0) throw new Error('aes128CbcNoPad: tamanho não é múltiplo de 16')
  const k = await globalThis.crypto.subtle.importKey('raw', fresh(key), { name: 'AES-CBC' }, false, ['encrypt'])
  const enc = new Uint8Array(await globalThis.crypto.subtle.encrypt({ name: 'AES-CBC', iv: fresh(iv) }, k, fresh(data)))
  return enc.subarray(0, enc.length - 16)
}

// ---------------------------------------------------------------------------
// Algoritmos do standard security handler
// ---------------------------------------------------------------------------

/** Tamanho da chave de arquivo em bytes (n): 5 para R2; /Length/8 (5..16) para R3/R4. */
export function fileKeyLength(info: Pick<EncryptInfo, 'r' | 'length'>): number {
  if (info.r === 2) return 5
  const n = Math.floor((info.length || 40) / 8)
  return Math.max(5, Math.min(16, n))
}

/**
 * Algoritmo 2 (ISO 32000-1 §7.6.3.3): chave de arquivo a partir da senha de usuário.
 * a) senha + PAD (32 bytes)  b) MD5  c) + /O  d) + /P int32 LE  e) + ID[0]
 * f) (R≥4, EncryptMetadata=false) + ff ff ff ff  g) finaliza
 * h) (R≥3) 50 vezes: MD5 dos primeiros n bytes  i) chave = primeiros n bytes.
 */
export function computeKeyR234(info: EncryptInfo, password: Uint8Array): Uint8Array {
  const n = fileKeyLength(info)
  const parts = [padPassword(password), info.o.subarray(0, 32), permissionsLE(info.p), info.id0]
  if (info.r >= 4 && !info.encryptMetadata) parts.push(new Uint8Array([0xff, 0xff, 0xff, 0xff]))
  let hash = md5(concatBytes(parts))
  if (info.r >= 3) for (let i = 0; i < 50; i++) hash = md5(hash.subarray(0, n))
  return hash.slice(0, n)
}

/**
 * Algoritmo 1 (ISO 32000-1 §7.6.2): chave por objeto para RC4 (/V2) e AESV2.
 * MD5(chave + objnum 3 bytes LE + gen 2 bytes LE [+ "sAlT" se AES]) → primeiros min(n+5, 16) bytes.
 */
export function objectKeyR234(fileKey: Uint8Array, objectNumber: number, generationNumber: number, aes = false): Uint8Array {
  const extra = new Uint8Array(aes ? 9 : 5)
  extra[0] = objectNumber & 0xff
  extra[1] = (objectNumber >> 8) & 0xff
  extra[2] = (objectNumber >> 16) & 0xff
  extra[3] = generationNumber & 0xff
  extra[4] = (generationNumber >> 8) & 0xff
  if (aes) extra.set([0x73, 0x41, 0x6c, 0x54], 5)
  const hash = md5(concatBytes([fileKey, extra]))
  return hash.slice(0, Math.min(fileKey.length + 5, 16))
}

/** Chave XOR i, usada nas 19 passadas extras dos Algoritmos 3 e 5 (R≥3). */
export function xorKey(key: Uint8Array, i: number): Uint8Array {
  const out = new Uint8Array(key.length)
  for (let k = 0; k < key.length; k++) out[k] = key[k] ^ i
  return out
}

/**
 * Algoritmo 4 (R2) / Algoritmo 5 (R3–R4): valor esperado de /U para uma chave de arquivo.
 * - R2: RC4(chave, PAD) → 32 bytes.
 * - R≥3: MD5(PAD + ID[0]) → RC4(chave) → 19 passadas com chave XOR i (i=1..19) → 16 bytes
 *   (o arquivo completa com 16 bytes arbitrários; só os 16 primeiros contam na comparação).
 */
export function computeUserEntryR234(info: EncryptInfo, fileKey: Uint8Array): Uint8Array {
  if (info.r === 2) return rc4(fileKey, PASSWORD_PAD)
  let x = rc4(fileKey, md5(concatBytes([PASSWORD_PAD, info.id0])))
  for (let i = 1; i <= 19; i++) x = rc4(xorKey(fileKey, i), x)
  return x
}

/**
 * Algoritmo 2.B (ISO 32000-2 §7.6.4.3.4): hash iterado de R6.
 * K = SHA-256(senha + sal + udata); repete: K1 = (senha + K + udata) × 64;
 * E = AES-128-CBC sem padding (chave K[0..16], IV K[16..32]) de K1;
 * mod = soma(E[0..16]) % 3 → K = SHA-256/384/512(E); pára quando i ≥ 64 e E[último] ≤ i − 32.
 * Retorna os 32 primeiros bytes de K. (Para R5 o hash é só o SHA-256 inicial.)
 */
export async function hash2B(password: Uint8Array, salt: Uint8Array, udata: Uint8Array): Promise<Uint8Array> {
  let k = await sha('SHA-256', concatBytes([password, salt, udata]))
  let e: Uint8Array = new Uint8Array(0)
  let i = 0
  do {
    const block = concatBytes([password, k, udata])
    const k1 = new Uint8Array(block.length * 64)
    for (let j = 0; j < 64; j++) k1.set(block, j * block.length)
    e = await aes128CbcNoPad(k.subarray(0, 16), k.subarray(16, 32), k1)
    let sum = 0
    for (let j = 0; j < 16; j++) sum += e[j]
    const mod = sum % 3
    k = await sha(mod === 0 ? 'SHA-256' : mod === 1 ? 'SHA-384' : 'SHA-512', e)
    i++
  } while (i < 64 || e[e.length - 1] > i - 32)
  return k.slice(0, 32)
}

/**
 * Algoritmo 6 (R2–R4) / Algoritmo 11 (R6; R5 é a versão sem 2.B): a senha de usuário
 * dada valida o /U? `null` quando o handler/revisão não é suportado.
 */
export async function authenticateUserPassword(info: EncryptInfo, password: Uint8Array): Promise<boolean | null> {
  if (info.filter !== 'Standard') return null
  if (info.r >= 2 && info.r <= 4) {
    if (info.u.length < 32 || info.o.length < 32) return null
    const key = computeKeyR234(info, password)
    const expected = computeUserEntryR234(info, key)
    // R2 compara os 32 bytes; R3/R4 só os 16 primeiros (o resto é padding arbitrário).
    return bytesEqual(expected, info.u, info.r === 2 ? 32 : 16)
  }
  if (info.r === 5 || info.r === 6) {
    if (info.u.length < 48) return null
    const validationSalt = info.u.subarray(32, 40)
    const hash = info.r === 5 ? await sha('SHA-256', concatBytes([password, validationSalt])) : await hash2B(password, validationSalt, new Uint8Array(0))
    return bytesEqual(hash, info.u, 32)
  }
  return null
}

// ---------------------------------------------------------------------------
// Leitura do dicionário /Encrypt
// ---------------------------------------------------------------------------

function resolve(doc: PDFDocument, obj: PDFObject | undefined): PDFObject | undefined {
  return obj instanceof PDFRef ? doc.context.lookup(obj) : obj
}

function numberOf(doc: PDFDocument, dict: PDFDict, key: string): number | undefined {
  const v = resolve(doc, dict.get(PDFName.of(key)))
  return v instanceof PDFNumber ? v.asNumber() : undefined
}

function bytesOf(doc: PDFDocument, dict: PDFDict, key: string): Uint8Array | undefined {
  const v = resolve(doc, dict.get(PDFName.of(key)))
  return v instanceof PDFString || v instanceof PDFHexString ? v.asBytes() : undefined
}

function readId0(doc: PDFDocument): Uint8Array {
  const arr = resolve(doc, doc.context.trailerInfo.ID)
  if (!(arr instanceof PDFArray) || arr.size() === 0) return new Uint8Array(0)
  const first = resolve(doc, arr.get(0))
  return first instanceof PDFString || first instanceof PDFHexString ? first.asBytes() : new Uint8Array(0)
}

/**
 * Lê o /Encrypt do trailer. `null` se o documento não é cifrado ou se o dicionário
 * não tem o mínimo para decidir (/R, /O, /U).
 */
export function readEncryptInfo(doc: PDFDocument): EncryptInfo | null {
  const enc = resolve(doc, doc.context.trailerInfo.Encrypt)
  if (!(enc instanceof PDFDict)) return null

  const filterObj = resolve(doc, enc.get(PDFName.of('Filter')))
  const filter = filterObj instanceof PDFName ? filterObj.decodeText() : ''
  const v = numberOf(doc, enc, 'V') ?? 0
  const r = numberOf(doc, enc, 'R')
  const o = bytesOf(doc, enc, 'O')
  const u = bytesOf(doc, enc, 'U')
  if (r === undefined || !o || !u) return null

  let length = numberOf(doc, enc, 'Length')
  if (length === undefined && v >= 4) {
    // Sem /Length no topo: usa o do crypt filter padrão (lá pode estar em bytes).
    const cf = resolve(doc, enc.get(PDFName.of('CF')))
    const stmf = resolve(doc, enc.get(PDFName.of('StmF')))
    const cfName = stmf instanceof PDFName ? stmf.decodeText() : 'StdCF'
    const std = cf instanceof PDFDict ? resolve(doc, cf.get(PDFName.of(cfName))) : undefined
    const cfLen = std instanceof PDFDict ? numberOf(doc, std, 'Length') : undefined
    if (cfLen !== undefined) length = cfLen <= 40 ? cfLen * 8 : cfLen
  }
  if (length === undefined) length = r >= 5 ? 256 : 40

  const pRaw = numberOf(doc, enc, 'P') ?? -1
  const p = pRaw | 0 // /P pode vir como unsigned grande (ex.: 4294963392); normaliza para int32.

  const em = resolve(doc, enc.get(PDFName.of('EncryptMetadata')))
  const encryptMetadata = em instanceof PDFBool ? em.asBoolean() : true

  return { filter, v, r, length, o, u, p, encryptMetadata, id0: readId0(doc) }
}

/**
 * `true`: a senha de usuário vazia valida → o arquivo abre sem senha (só tem restrições
 * de dono). `false`: exige senha de usuário de verdade. `null`: não dá para decidir
 * (filtro que não é /Standard, /R desconhecido, entradas faltando).
 * Documento sem /Encrypt abre sem senha, logo `true`.
 */
export async function opensWithEmptyUserPassword(doc: PDFDocument): Promise<boolean | null> {
  if (!doc.context.trailerInfo.Encrypt) return true
  const info = readEncryptInfo(doc)
  if (!info) return null
  return authenticateUserPassword(info, new Uint8Array(0))
}
