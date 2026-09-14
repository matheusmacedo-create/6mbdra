import type { Settings } from '../lib/types'

interface Props {
  settings: Settings
  onChange: (s: Settings) => void
}

/** Opções de processamento (card "Como preparar"). */
export function Options({ settings, onChange }: Props) {
  return (
    <div className="toggles">
      <label className="toggle">
        <input type="checkbox" checked={settings.autoSplit} onChange={(e) => onChange({ ...settings, autoSplit: e.target.checked })} />
        <span>
          <span className="t-label">Dividir automaticamente se necessário</span>
          <br />
          <span className="t-hint">Cria partes numeradas sem cortar nenhuma página.</span>
        </span>
      </label>
      <label className="toggle">
        <input type="checkbox" checked={settings.grayscale} onChange={(e) => onChange({ ...settings, grayscale: e.target.checked })} />
        <span>
          <span className="t-label">Usar tons de cinza para reduzir mais</span>
          <br />
          <span className="t-hint">Ative somente quando as cores do documento não forem importantes.</span>
        </span>
      </label>
    </div>
  )
}
