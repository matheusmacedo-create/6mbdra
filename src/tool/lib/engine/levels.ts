/**
 * Níveis de compressão, do mais conservador ao mais agressivo.
 * O pipeline começa no nível mais leve que provavelmente cabe no limite,
 * sobe de nível só se precisar e, se sobrar folga, volta para um mais leve.
 *
 * Imagens 1 bit (digitalizações em preto e branco puro, CCITT G4/JBIG2) nunca
 * são reamostradas: subamostrar bilevel destrói o texto. Elas ficam como estão
 * e, se o documento não couber, ele é dividido.
 */
export interface Level {
  id: number
  label: string
  description: string
  /** Só otimização estrutural: não reamostra nem recodifica imagens JPEG. */
  structuralOnly: boolean
  /** Resolução alvo (dpi) para imagens coloridas e em tons de cinza (0 = não reamostrar). */
  dpi: number
  /** QFactor do DCTEncode (0,4 = qualidade alta … 1,5 = baixa). */
  qFactor: number
}

export const LEVELS: Level[] = [
  { id: 1, label: 'Estrutural', description: 'Remove redundâncias sem tocar nas imagens', structuralOnly: true, dpi: 0, qFactor: 0 },
  { id: 2, label: 'Mínima', description: '300 dpi, praticamente idêntico ao original', structuralOnly: false, dpi: 300, qFactor: 0.4 },
  { id: 3, label: 'Leve', description: '200 dpi, alta nitidez', structuralOnly: false, dpi: 200, qFactor: 0.5 },
  { id: 4, label: 'Média', description: '150 dpi, boa leitura em tela e impressão', structuralOnly: false, dpi: 150, qFactor: 0.76 },
  { id: 5, label: 'Forte', description: '120 dpi, leitura confortável em tela', structuralOnly: false, dpi: 120, qFactor: 1.0 },
  { id: 6, label: 'Máxima', description: '100 dpi, o mínimo que ainda lê números pequenos', structuralOnly: false, dpi: 100, qFactor: 1.3 },
]

/**
 * Fatores de redução medidos numa digitalização real de texto a 300 dpi
 * (Ghostscript 9.56, ver docs/decisoes-tecnicas.md). Só servem para escolher
 * em qual nível começar; o tamanho real é sempre medido.
 */
export const EXPECTED_RATIO: Record<number, number> = {
  1: 0.95,
  2: 0.8,
  3: 0.42,
  4: 0.25,
  5: 0.19,
  6: 0.12,
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
