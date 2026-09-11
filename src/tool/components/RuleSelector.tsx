import { useState } from 'react'
import type { Settings } from '../lib/types'
import { agruparPorTribunal, regrasVigentes, regraPorId, formatLimite, limiteBytes, metaBytes, REGRAS } from '../lib/regras'
import { formatBytes, formatDate } from '../lib/format'
import { CUSTOM_MB_MAX, CUSTOM_MB_MIN, resolveSettings } from '../lib/limits'
import { SITE } from '../../config/site'
import { track } from '../lib/analytics'

interface Props {
  settings: Settings
  onChange: (s: Settings) => void
}

export function RuleSelector({ settings, onChange }: Props) {
  const regras = regrasVigentes()
  const grupos = agruparPorTribunal(regras)
  const regra = settings.ruleId ? regraPorId(settings.ruleId) : undefined
  const [customText, setCustomText] = useState(String(settings.customMb).replace('.', ','))
  const resolved = resolveSettings(settings)

  const setCustom = (text: string) => {
    setCustomText(text)
    const n = Number(text.replace(',', '.'))
    if (Number.isFinite(n) && n >= CUSTOM_MB_MIN && n <= CUSTOM_MB_MAX) onChange({ ...settings, ruleId: null, customMb: n })
  }

  return (
    <div className="rule-selector">
      <div className="field">
        <label htmlFor="regra">Tribunal e sistema</label>
        <select
          id="regra"
          value={regra ? regra.id : 'custom'}
          onChange={(e) => {
            const v = e.target.value
            if (v === 'custom') onChange({ ...settings, ruleId: null })
            else {
              onChange({ ...settings, ruleId: v })
              const r = regraPorId(v)
              if (r) track('regra_selecionada', { tribunal: r.tribunal_sigla, sistema: r.sistema })
            }
          }}
        >
          <option value="custom">Outro limite (informar em MB)</option>
          {[...grupos.entries()].map(([grupo, lista]) => (
            <optgroup key={grupo} label={grupo}>
              {lista.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.sistema} · {formatLimite(r)}
                  {r.instancia && r.instancia !== 'não se aplica' ? ` · ${r.instancia}` : ''}
                  {r.tipo_peticionamento && r.tipo_peticionamento !== 'geral' ? ` · ${r.tipo_peticionamento}` : ''}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {regras.length === 0 && <div className="hint">Ainda não há regras de tribunal cadastradas. Informe o limite manualmente.</div>}
      </div>

      {!regra && (
        <div className="field">
          <label htmlFor="limite-mb">Limite por arquivo (MB)</label>
          <div className="limit-row">
            <input
              id="limite-mb"
              type="text"
              inputMode="decimal"
              aria-describedby="limite-hint"
              value={customText}
              onChange={(e) => setCustom(e.target.value)}
              data-testid="custom-limit"
            />
            <span>MB</span>
          </div>
          <div className="hint" id="limite-hint">
            Confira o valor no sistema do seu tribunal. Consideramos 1 MB = 1.000.000 bytes (a leitura mais conservadora).
          </div>
        </div>
      )}

      <div className="rule-info" data-testid="rule-info">
        {regra ? (
          <>
            <div>
              <strong>{regra.tribunal_sigla} · {regra.sistema}</strong> — {regra.tribunal_nome}
              {regra.instancia && regra.instancia !== 'não se aplica' ? ` · ${regra.instancia}` : ''}
              {regra.tipo_peticionamento && regra.tipo_peticionamento !== 'geral' ? ` · ${regra.tipo_peticionamento}` : ''}
            </div>
            <dl>
              <div><dt>Limite declarado</dt><dd>{formatLimite(regra)} ({formatBytes(limiteBytes(regra))})</dd></div>
              <div><dt>Meta segura</dt><dd>{formatBytes(metaBytes(regra))} ({regra.meta_segura_percentual ?? REGRAS.meta_segura_percentual_padrao}% do limite)</dd></div>
              <div><dt>Fonte oficial</dt><dd><a href={regra.fonte_url} target="_blank" rel="noreferrer noopener">{regra.fonte_titulo}</a></dd></div>
              <div><dt>Verificado em</dt><dd>{formatDate(regra.verificado_em)}{regra.situacao === 'em_revisao' ? ' · em revisão' : ''}</dd></div>
            </dl>
            {regra.observacoes && <p className="hint">{regra.observacoes}</p>}
            <p className="hint">
              Regras mudam. Se o sistema recusar o arquivo, ajuste o limite manualmente e <a href="/contato/">avise a gente</a>.
            </p>
          </>
        ) : (
          <div>
            Limite: <strong>{formatBytes(resolved.limitBytes)}</strong> · meta segura: <strong>{formatBytes(resolved.targetBytes)}</strong> ({SITE.safetyMarginPercent}% do limite, para
            o portal não recusar por diferença de contagem).
          </div>
        )}
      </div>

      <div className="toggles">
        <label className="toggle">
          <input type="checkbox" checked={settings.autoSplit} onChange={(e) => onChange({ ...settings, autoSplit: e.target.checked })} />
          <span>
            <span className="t-label">Dividir em partes quando não couber</span>
            <br />
            <span className="t-hint">Se nem a compressão máxima for suficiente, gera parte_01, parte_02… sem cortar páginas.</span>
          </span>
        </label>
        <label className="toggle">
          <input type="checkbox" checked={settings.grayscale} onChange={(e) => onChange({ ...settings, grayscale: e.target.checked })} />
          <span>
            <span className="t-label">Converter para tons de cinza</span>
            <br />
            <span className="t-hint">Reduz muito digitalizações coloridas. Deixe desligado se as cores importarem (carimbos, assinaturas, grifos).</span>
          </span>
        </label>
      </div>
    </div>
  )
}
