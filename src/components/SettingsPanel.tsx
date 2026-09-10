import { useState } from 'react'
import type { Settings } from '../lib/types'
import { LIMIT_PRESETS } from '../lib/limits'
import { bytesToMb, mbToBytes } from '../lib/format'

interface Props {
  settings: Settings
  onChange: (s: Settings) => void
}

export function SettingsPanel({ settings, onChange }: Props) {
  const currentMb = bytesToMb(settings.limitBytes)
  const isPreset = LIMIT_PRESETS.some((p) => Math.abs(p.mb - currentMb) < 0.001)
  const [custom, setCustom] = useState(!isPreset)
  const [customValue, setCustomValue] = useState(isPreset ? '' : String(currentMb))

  const setMb = (mb: number) => {
    if (Number.isFinite(mb) && mb >= 0.1 && mb <= 500) onChange({ ...settings, limitBytes: mbToBytes(mb) })
  }

  return (
    <div className="settings">
      <div className="field">
        <label htmlFor="limit">Limite de tamanho por arquivo</label>
        <div className="limit-row">
          <select
            id="limit"
            value={custom ? 'custom' : String(currentMb)}
            onChange={(e) => {
              if (e.target.value === 'custom') {
                setCustom(true)
                setCustomValue(String(currentMb))
              } else {
                setCustom(false)
                setMb(Number(e.target.value))
              }
            }}
          >
            {LIMIT_PRESETS.map((p) => (
              <option key={p.mb} value={String(p.mb)}>
                {p.label} — {p.hint}
              </option>
            ))}
            <option value="custom">Outro valor…</option>
          </select>
          {custom && (
            <>
              <input
                type="number"
                inputMode="decimal"
                min={0.1}
                max={500}
                step={0.1}
                aria-label="Limite em megabytes"
                value={customValue}
                onChange={(e) => {
                  setCustomValue(e.target.value)
                  setMb(Number(e.target.value.replace(',', '.')))
                }}
              />
              <span>MB</span>
            </>
          )}
        </div>
        <div className="hint">
          Confira o limite no sistema do seu tribunal (PJe, e-SAJ, Projudi, eproc…). Miramos um pouco abaixo do valor para
          o arquivo não ser recusado por poucos KB.
        </div>
      </div>

      <div className="toggles">
        <label className="toggle">
          <input type="checkbox" checked={settings.autoSplit} onChange={(e) => onChange({ ...settings, autoSplit: e.target.checked })} />
          <span>
            <span className="t-label">Dividir em partes quando não couber</span>
            <br />
            <span className="t-hint">Se nem a compressão máxima for suficiente, gera "parte 1 de 3", "parte 2 de 3"…</span>
          </span>
        </label>
        <label className="toggle">
          <input type="checkbox" checked={settings.grayscale} onChange={(e) => onChange({ ...settings, grayscale: e.target.checked })} />
          <span>
            <span className="t-label">Converter para tons de cinza</span>
            <br />
            <span className="t-hint">Reduz muito digitalizações coloridas. Desligue se cores importarem (carimbos, assinaturas, grifos).</span>
          </span>
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={settings.allowRasterFallback}
            onChange={(e) => onChange({ ...settings, allowRasterFallback: e.target.checked })}
          />
          <span>
            <span className="t-label">Modo de emergência para PDFs problemáticos</span>
            <br />
            <span className="t-hint">Se o motor principal falhar, transforma as páginas em imagens. O texto deixa de ser pesquisável.</span>
          </span>
        </label>
      </div>
    </div>
  )
}
