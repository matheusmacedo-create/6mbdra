/**
 * Níveis de compressão, do mais leve (melhor qualidade) ao mais agressivo.
 * O pipeline tenta do mais leve possível para o mais forte, parando no primeiro
 * que cabe no limite — assim o documento fica o mais nítido que o limite permite.
 */
export interface Level {
  id: number
  label: string
  description: string
  /** Resolução alvo para imagens coloridas / cinza (dpi) */
  colorDpi: number
  grayDpi: number
  /** Resolução alvo para imagens 1-bit (digitalizações em preto e branco puro) */
  monoDpi: number
  /** Qualidade JPEG 1..100 */
  jpegQuality: number
}

export const LEVELS: Level[] = [
  { id: 1, label: 'Leve', description: 'Mantém alta nitidez (200 dpi)', colorDpi: 200, grayDpi: 200, monoDpi: 400, jpegQuality: 85 },
  { id: 2, label: 'Média', description: 'Boa leitura em tela e impressão (150 dpi)', colorDpi: 150, grayDpi: 150, monoDpi: 300, jpegQuality: 75 },
  { id: 3, label: 'Forte', description: 'Leitura confortável em tela (110 dpi)', colorDpi: 110, grayDpi: 110, monoDpi: 300, jpegQuality: 65 },
  { id: 4, label: 'Máxima', description: 'Menor tamanho possível, ainda legível (80 dpi)', colorDpi: 80, grayDpi: 80, monoDpi: 200, jpegQuality: 50 },
]

/**
 * Fatores empíricos aproximados de redução de tamanho para digitalizações a 300 dpi.
 * Usados só para escolher em qual nível começar (evita rodar passes inúteis).
 */
export const EXPECTED_RATIO: Record<number, number> = {
  1: 0.45,
  2: 0.22,
  3: 0.12,
  4: 0.06,
}

/** Escolhe o nível inicial: o mais leve cuja redução esperada já deve caber no alvo. */
export function pickStartLevel(inputBytes: number, targetBytes: number): Level {
  for (const level of LEVELS) {
    if (inputBytes * EXPECTED_RATIO[level.id] <= targetBytes) return level
  }
  return LEVELS[LEVELS.length - 1]
}

export function nextLevel(level: Level): Level | undefined {
  return LEVELS.find((l) => l.id === level.id + 1)
}

export function prevLevel(level: Level): Level | undefined {
  return LEVELS.find((l) => l.id === level.id - 1)
}
