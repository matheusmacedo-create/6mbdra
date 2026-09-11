import type { Level } from './levels'

export interface GsArgsOptions {
  level: Level
  grayscale: boolean
}

export const GS_INPUT = '/input.pdf'
export const GS_OUTPUT = '/output.pdf'

/**
 * Linha de comando do Ghostscript (pdfwrite) para um nível.
 *
 * Observações medidas (docs/decisoes-tecnicas.md):
 * - -dJPEGQ é ignorado pelo pdfwrite; a qualidade JPEG vem de /QFactor via setdistillerparams.
 * - Imagens 1 bit ficam em CCITT G4 e nunca são reamostradas (Subsample só aceita fatores
 *   inteiros e Bicubic transformaria em cinza 8 bits, inflando o arquivo).
 * - Sem -dQUIET de propósito: as linhas "Page N" viram progresso.
 */
export function buildGsArgs(opts: GsArgsOptions): string[] {
  const { level, grayscale } = opts
  const common = [
    '-dSAFER',
    '-dBATCH',
    '-dNOPAUSE',
    '-dNOPROMPT',
    '-sDEVICE=pdfwrite',
    '-dCompatibilityLevel=1.5',
    // Estrutura
    '-dDetectDuplicateImages=true',
    '-dEmbedAllFonts=true',
    '-dSubsetFonts=true',
    '-dCompressFonts=true',
    '-dCompressPages=true',
    '-dUseFlateCompression=true',
    '-dPreserveAnnots=true',
    // Bilevel: preserva CCITT, não reamostra
    '-dDownsampleMonoImages=false',
    '-dEncodeMonoImages=true',
    '-dMonoImageFilter=/CCITTFaxEncode',
    // Cor
    ...(grayscale
      ? ['-sColorConversionStrategy=Gray', '-dProcessColorModel=/DeviceGray', '-dOverrideICC=true']
      : ['-sColorConversionStrategy=LeaveColorUnchanged']),
    `-sOutputFile=${GS_OUTPUT}`,
  ]

  if (level.structuralOnly) {
    return [
      ...common,
      '-dDownsampleColorImages=false',
      '-dDownsampleGrayImages=false',
      '-dAutoFilterColorImages=true',
      '-dAutoFilterGrayImages=true',
      '-dPassThroughJPEGImages=true',
      GS_INPUT,
    ]
  }

  const dict = `<< /QFactor ${level.qFactor} /Blend 1 /HSamples [2 1 1 2] /VSamples [2 1 1 2] >>`
  return [
    ...common,
    '-dDownsampleColorImages=true',
    `-dColorImageResolution=${level.dpi}`,
    '-dColorImageDownsampleType=/Bicubic',
    '-dColorImageDownsampleThreshold=1.0',
    '-dDownsampleGrayImages=true',
    `-dGrayImageResolution=${level.dpi}`,
    '-dGrayImageDownsampleType=/Bicubic',
    '-dGrayImageDownsampleThreshold=1.0',
    '-dAutoFilterColorImages=false',
    '-dColorImageFilter=/DCTEncode',
    '-dAutoFilterGrayImages=false',
    '-dGrayImageFilter=/DCTEncode',
    '-dPassThroughJPEGImages=false',
    '-c',
    `<< /ColorImageDict ${dict} /GrayImageDict ${dict} >> setdistillerparams`,
    '-f',
    GS_INPUT,
  ]
}
