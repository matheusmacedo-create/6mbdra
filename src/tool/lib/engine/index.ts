import { GhostscriptEngine } from './ghostscript'
import type { CompressionEngine } from './types'

export function createEngine(): CompressionEngine | null {
  return GhostscriptEngine.isSupported() ? new GhostscriptEngine() : null
}

export { GhostscriptEngine }
