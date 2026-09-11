import { PDFDocument, PDFName, PDFDict, PDFArray } from 'pdf-lib'

import type { Analysis } from './splitTypes'

export type { Analysis }

/** Mensagens internas do pdf-lib não ajudam o usuário; traduz para algo compreensível. */
function friendlyReason(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  if (/password|encrypt/i.test(msg)) return 'O PDF está protegido.'
  if (/Cannot read|undefined|null|Expected|Failed to parse|Invalid|xref|trailer|object/i.test(msg)) return 'A estrutura interna do PDF está danificada.'
  return msg.length > 120 ? 'A estrutura interna do PDF está danificada.' : msg
}

const BYTE_RANGE = textBytes('/ByteRange')
const SIG_TYPE = textBytes('/Sig')

function textBytes(s: string): Uint8Array {
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff
  return out
}

/** Busca simples de bytes (suficiente: padrões curtos, arquivos grandes, roda no worker). */
export function containsBytes(hay: Uint8Array, needle: Uint8Array, limit = hay.length): boolean {
  const n = needle.length
  const end = Math.min(hay.length, limit) - n
  const first = needle[0]
  outer: for (let i = 0; i <= end; i++) {
    if (hay[i] !== first) continue
    for (let j = 1; j < n; j++) if (hay[i + j] !== needle[j]) continue outer
    return true
  }
  return false
}

/** Cabeçalho %PDF em até 1 KB (o padrão tolera lixo antes). */
export function hasPdfHeader(bytes: Uint8Array): boolean {
  return containsBytes(bytes, textBytes('%PDF-'), 1024)
}

function hasSignatureField(doc: PDFDocument): boolean {
  try {
    const acro = doc.catalog.lookup(PDFName.of('AcroForm'))
    if (!(acro instanceof PDFDict)) return false
    const fields = acro.lookup(PDFName.of('Fields'))
    if (!(fields instanceof PDFArray)) return false
    for (let i = 0; i < fields.size(); i++) {
      const f = fields.lookup(i)
      if (f instanceof PDFDict && f.lookup(PDFName.of('FT'))?.toString() === '/Sig') return true
    }
  } catch {
    // estrutura inesperada: cai na busca por bytes
  }
  return false
}

/**
 * Análise prévia (spec RF05): validade, páginas, proteção e assinatura,
 * sem alterar nada. Roda no worker de pdf-lib.
 */
export async function analyzePdf(bytes: Uint8Array): Promise<Analysis> {
  if (!hasPdfHeader(bytes)) {
    return { valid: false, pages: 0, encrypted: false, signed: false, reason: 'O arquivo não começa como um PDF.' }
  }
  // Assinatura: /ByteRange só existe em assinaturas; /Sig confirma. Busca em bytes cobre
  // arquivos cujo AcroForm o pdf-lib não consegue ler.
  const signedByBytes = containsBytes(bytes, BYTE_RANGE) && containsBytes(bytes, SIG_TYPE)
  let doc: PDFDocument
  try {
    doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false, throwOnInvalidObject: false })
  } catch (e) {
    return { valid: false, pages: 0, encrypted: false, signed: signedByBytes, reason: friendlyReason(e) }
  }
  try {
    const pages = doc.getPageCount()
    if (pages === 0) return { valid: false, pages: 0, encrypted: doc.isEncrypted, signed: signedByBytes, reason: 'O PDF não tem páginas.' }
    return { valid: true, pages, encrypted: doc.isEncrypted, signed: signedByBytes || hasSignatureField(doc) }
  } catch (e) {
    // Estrutura tão danificada que o pdf-lib carregou mas não acha a árvore de páginas.
    return { valid: false, pages: 0, encrypted: false, signed: signedByBytes, reason: friendlyReason(e) }
  }
}
