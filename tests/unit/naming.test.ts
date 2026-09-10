import { describe, it, expect } from 'vitest'
import { baseName, compressedName, partName, uniqueNames } from '../../src/lib/naming'
import { formatBytes, formatReduction } from '../../src/lib/format'

describe('naming', () => {
  it('strips .pdf case-insensitively and sanitizes', () => {
    expect(baseName('Petição Inicial.PDF')).toBe('Petição Inicial')
    expect(baseName('a/b:c*.pdf')).toBe('a b c')
    expect(baseName('.pdf')).toBe('documento')
  })
  it('builds output names', () => {
    expect(compressedName('doc.pdf')).toBe('doc - compactado.pdf')
    expect(partName('doc.pdf', 2, 3)).toBe('doc - parte 2 de 3.pdf')
  })
  it('makes names unique', () => {
    expect(uniqueNames(['a.pdf', 'a.pdf', 'b.pdf', 'a.pdf'])).toEqual(['a.pdf', 'a (2).pdf', 'b.pdf', 'a (3).pdf'])
  })
})

describe('format', () => {
  it('formats bytes in pt-BR', () => {
    expect(formatBytes(6 * 1024 * 1024)).toBe('6,0 MB')
    expect(formatBytes(4.25 * 1024 * 1024)).toBe('4,3 MB')
    expect(formatBytes(15.7 * 1024 * 1024)).toBe('15,7 MB')
    expect(formatBytes(137.2 * 1024 * 1024)).toBe('137 MB')
    expect(formatBytes(830 * 1024)).toBe('830 KB')
    expect(formatBytes(12)).toBe('12 B')
  })
  it('formats reduction', () => {
    expect(formatReduction(100, 13)).toBe('87%')
    expect(formatReduction(100, 120)).toBe('0%')
  })
})
