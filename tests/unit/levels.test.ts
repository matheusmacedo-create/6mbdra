import { describe, it, expect } from 'vitest'
import { LEVELS, EXPECTED_RATIO, pickStartLevel } from '../../src/tool/lib/engine/levels'
import { buildGsArgs } from '../../src/tool/lib/engine/gsArgs'

describe('levels', () => {
  it('has a structural level first and strictly decreasing dpi after it', () => {
    expect(LEVELS[0].structuralOnly).toBe(true)
    for (let i = 2; i < LEVELS.length; i++) expect(LEVELS[i].dpi).toBeLessThan(LEVELS[i - 1].dpi)
    expect(LEVELS[LEVELS.length - 1].dpi).toBeGreaterThanOrEqual(100) // piso de legibilidade
    for (const l of LEVELS) expect(EXPECTED_RATIO[l.id]).toBeDefined()
  })
  it('picks the lightest level whose expected ratio fits', () => {
    expect(pickStartLevel(6_000_000, 5_700_000).id).toBe(1) // 0.95 cabe
    expect(pickStartLevel(7_000_000, 5_700_000).id).toBe(2) // 0.8 cabe
    expect(pickStartLevel(20_000_000, 5_700_000).id).toBe(4) // 0.42 não, 0.25 cabe
    expect(pickStartLevel(1_000_000_000, 5_700_000).id).toBe(LEVELS.length)
  })
})

describe('gs args', () => {
  it('never resamples bilevel images and keeps CCITT', () => {
    for (const level of LEVELS) {
      const a = buildGsArgs({ level, grayscale: false })
      expect(a).toContain('-dDownsampleMonoImages=false')
      expect(a).toContain('-dMonoImageFilter=/CCITTFaxEncode')
      expect(a).toContain('-dSAFER')
      expect(a[a.length - 1]).toBe('/input.pdf')
    }
  })
  it('structural level passes JPEGs through; others downsample with QFactor', () => {
    const s = buildGsArgs({ level: LEVELS[0], grayscale: false })
    expect(s).toContain('-dPassThroughJPEGImages=true')
    expect(s.join(' ')).not.toContain('setdistillerparams')
    const l = buildGsArgs({ level: LEVELS[3], grayscale: true })
    expect(l).toContain('-dColorImageResolution=150')
    expect(l.join(' ')).toContain('/QFactor 0.76')
    expect(l).toContain('-sColorConversionStrategy=Gray')
    expect(l.indexOf('-c')).toBeLessThan(l.indexOf('-f'))
  })
})
