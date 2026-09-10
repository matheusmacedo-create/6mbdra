import { GhostscriptEngine } from './ghostscript'
import { RasterEngine } from './raster'
import type { CompressionEngine } from './types'

export function createEngines(): CompressionEngine[] {
  const engines: CompressionEngine[] = []
  if (GhostscriptEngine.isSupported()) engines.push(new GhostscriptEngine())
  if (RasterEngine.isSupported()) engines.push(new RasterEngine())
  return engines
}

export { GhostscriptEngine, RasterEngine }
