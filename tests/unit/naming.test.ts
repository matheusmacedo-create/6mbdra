import { describe, it, expect } from 'vitest'
import { baseName, compressedName, partName, uniqueNames, safeFileName, slug, numberedBase } from '../../src/tool/lib/naming'
import { formatBytes, formatReduction, formatDate } from '../../src/tool/lib/format'

describe('naming (spec §8.2)', () => {
  it('strips .pdf case-insensitively and makes names system-proof (no accents, spaces or specials)', () => {
    expect(baseName('Petição Inicial.PDF')).toBe('Peticao_Inicial')
    expect(baseName('a/b:c*.pdf')).toBe('a_b_c')
    expect(baseName('CONTRATO SOCIAL - JOÃO (v2).pdf')).toBe('CONTRATO_SOCIAL-JOAO_v2')
    expect(baseName('.pdf')).toBe('documento')
    expect(slug('x'.repeat(80))).toHaveLength(60)
    expect(numberedBase(3, 12, 'laudo')).toBe('03_laudo')
    expect(numberedBase(3, 120, 'laudo')).toBe('003_laudo')
  })
  it('builds output names with predictable suffixes', () => {
    expect(compressedName('contrato.pdf')).toBe('contrato_otimizado.pdf')
    expect(partName('laudo.pdf', 1, 3)).toBe('laudo_parte_01_de_03.pdf')
    expect(partName('laudo.pdf', 12, 120)).toBe('laudo_parte_012_de_120.pdf')
  })
  it('neutralizes path traversal and control characters in original names', () => {
    expect(safeFileName('..\\..\\x.pdf')).toBe('x.pdf')
    expect(safeFileName('../evil.pdf')).toBe('evil.pdf')
    expect(safeFileName('contrato: final.pdf')).toBe('contrato_final.pdf')
    expect(safeFileName('a\u0000b.pdf')).toBe('a_b.pdf')
    expect(safeFileName('...pdf')).toBe('documento.pdf')
  })
  it('makes names unique with a sequential number', () => {
    expect(uniqueNames(['a.pdf', 'a.pdf', 'b.pdf', 'A.pdf'])).toEqual(['a.pdf', 'a_2.pdf', 'b.pdf', 'A_3.pdf'])
  })
})

describe('format', () => {
  it('formats bytes as decimal MB in pt-BR', () => {
    expect(formatBytes(6_000_000)).toBe('6,0 MB')
    expect(formatBytes(4_250_000)).toBe('4,3 MB')
    expect(formatBytes(15_700_000)).toBe('15,7 MB')
    expect(formatBytes(137_200_000)).toBe('137 MB')
    expect(formatBytes(830_000)).toBe('830 KB')
    expect(formatBytes(12)).toBe('12 B')
  })
  it('formats reduction and dates', () => {
    expect(formatReduction(100, 13)).toBe('87%')
    expect(formatReduction(100, 120)).toBe('0%')
    expect(formatDate('2026-09-10')).toBe('10/09/2026')
  })
})
