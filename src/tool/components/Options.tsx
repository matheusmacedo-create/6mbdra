import type { Settings } from '../lib/types'
import { track } from '../lib/analytics'

interface Props {
  settings: Settings
  onChange: (s: Settings) => void
}

/** Opções de processamento (card "Como preparar"). */
export function Options({ settings, onChange }: Props) {
  const alterar = (tipo: 'dividir' | 'cinza', ligado: boolean) => {
    track('opcao_alterada', { tipo, situacao: ligado ? 'ligado' : 'desligado' })
  }
  return (
    <div className="toggles">
      <label className="toggle">
        <input type="checkbox" checked={settings.autoSplit} onChange={(e) => {
            alterar('dividir', e.target.checked)
            onChange({ ...settings, autoSplit: e.target.checked })
          }} />
        <span>
          <span className="t-label">Dividir automaticamente se necessário</span>
          <br />
          <span className="t-hint">Cria partes numeradas sem cortar nenhuma página.</span>
        </span>
      </label>
      <label className="toggle">
        <input type="checkbox" checked={settings.grayscale} onChange={(e) => {
            alterar('cinza', e.target.checked)
            onChange({ ...settings, grayscale: e.target.checked })
          }} />
        <span>
          <span className="t-label">Usar tons de cinza para reduzir mais</span>
          <br />
          <span className="t-hint">Ative somente quando as cores do documento não forem importantes.</span>
        </span>
      </label>
    </div>
  )
}
