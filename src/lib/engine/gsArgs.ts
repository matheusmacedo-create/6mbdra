import type { Level } from './levels'

export interface GsArgsOptions {
  level: Level
  grayscale: boolean
  password?: string
}

export const GS_INPUT = '/input.pdf'
export const GS_OUTPUT = '/output.pdf'

/**
 * Monta a linha de comando do Ghostscript (pdfwrite) para um nível de compressão.
 * Sem -dQUIET de propósito: as linhas "Page N" do stdout viram progresso.
 */
export function buildGsArgs(opts: GsArgsOptions): string[] {
  const { level, grayscale, password } = opts
  const args = [
    '-dSAFER',
    '-dBATCH',
    '-dNOPAUSE',
    '-dNOPROMPT',
    '-sDEVICE=pdfwrite',
    '-dCompatibilityLevel=1.5',
    // Imagens
    '-dDownsampleColorImages=true',
    `-dColorImageResolution=${level.colorDpi}`,
    '-dColorImageDownsampleType=/Bicubic',
    '-dColorImageDownsampleThreshold=1.0',
    '-dDownsampleGrayImages=true',
    `-dGrayImageResolution=${level.grayDpi}`,
    '-dGrayImageDownsampleType=/Bicubic',
    '-dGrayImageDownsampleThreshold=1.0',
    '-dDownsampleMonoImages=true',
    `-dMonoImageResolution=${level.monoDpi}`,
    '-dMonoImageDownsampleType=/Subsample',
    '-dMonoImageDownsampleThreshold=1.0',
    '-dAutoFilterColorImages=false',
    '-dColorImageFilter=/DCTEncode',
    '-dAutoFilterGrayImages=false',
    '-dGrayImageFilter=/DCTEncode',
    '-dEncodeMonoImages=true',
    '-dMonoImageFilter=/CCITTFaxEncode',
    `-dJPEGQ=${level.jpegQuality}`,
    '-dPassThroughJPEGImages=false',
    '-dDetectDuplicateImages=true',
    // Fontes e estrutura
    '-dEmbedAllFonts=true',
    '-dSubsetFonts=true',
    '-dCompressFonts=true',
    '-dCompressPages=true',
    '-dUseFlateCompression=true',
    // Não mexer em cor a menos que o usuário peça tons de cinza
    ...(grayscale
      ? ['-sColorConversionStrategy=Gray', '-dProcessColorModel=/DeviceGray', '-dOverrideICC=true']
      : ['-sColorConversionStrategy=LeaveColorUnchanged']),
    // Preserva marcadores/links do original
    '-dPreserveAnnots=true',
    ...(password ? [`-sPDFPassword=${password}`] : []),
    `-sOutputFile=${GS_OUTPUT}`,
    GS_INPUT,
  ]
  return args
}
