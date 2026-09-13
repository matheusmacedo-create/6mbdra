import type { Settings } from '../lib/types'

interface Props {
  settings: Settings
  onChange: (s: Settings) => void
}

/** Opções de processamento (card "Opções"). */
export function Options({ settings, onChange }: Props) {
  return (
    <div className="toggles">
      <label className="toggle">
        <input type="checkbox" checked={settings.autoSplit} onChange={(e) => onChange({ ...settings, autoSplit: e.target.checked })} />
        <span>
          <span className="t-label">Dividir em partes quando não couber</span>
          <br />
          <span className="t-hint">Gera parte_01, parte_02… sem cortar páginas.</span>
        </span>
      </label>
      <label className="toggle">
        <input type="checkbox" checked={settings.grayscale} onChange={(e) => onChange({ ...settings, grayscale: e.target.checked })} />
        <span>
          <span className="t-label">Converter para tons de cinza</span>
          <br />
          <span className="t-hint">Reduz muito digitalizações coloridas. Deixe desligado se as cores importarem.</span>
        </span>
      </label>
    </div>
  )
}
