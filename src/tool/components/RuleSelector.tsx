import { useEffect, useState } from 'react'
import type { Settings } from '../lib/types'
import { agruparPorTribunal, regrasVigentes, regraPorId, formatLimite, limiteBytes, metaBytes, mostrarBytesDoLimite, percentualMeta, rotuloContexto, rotuloSistema, META_PERCENTUAL_PADRAO } from '../lib/regras'
import { formatBytes, formatDate } from '../lib/format'
import { CUSTOM_MB_MAX, CUSTOM_MB_MIN, resolveSettings } from '../lib/limits'
import { track } from '../lib/analytics'

interface Props {
  settings: Settings
  onChange: (s: Settings) => void
  /** Avisa quando o limite manual digitado é inválido (o botão Preparar fica bloqueado). */
  onValidity?: (valid: boolean) => void
}

function parseMb(text: string): number {
  return Number(text.trim().replace(',', '.'))
}

function isValidMb(n: number): boolean {
  return Number.isFinite(n) && n >= CUSTOM_MB_MIN && n <= CUSTOM_MB_MAX
}

const fmtMb = (n: number) => n.toLocaleString('pt-BR')

export function RuleSelector({ settings, onChange, onValidity }: Props) {
  const regras = regrasVigentes()
  const grupos = agruparPorTribunal(regras)
  const regra = settings.ruleId ? regraPorId(settings.ruleId) : undefined
  const [customText, setCustomText] = useState(String(settings.customMb).replace('.', ','))
  const resolved = resolveSettings(settings)
  const customValid = regra !== undefined || isValidMb(parseMb(customText))

  useEffect(() => {
    onValidity?.(customValid)
  }, [customValid, onValidity])

  const setCustom = (text: string) => {
    setCustomText(text)
    const n = parseMb(text)
    if (isValidMb(n)) onChange({ ...settings, ruleId: null, customMb: n })
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
                  {rotuloSistema(r)} · {formatLimite(r)}
                  {rotuloContexto(r, { omitirAmbos: true }) ? ` · ${rotuloContexto(r, { omitirAmbos: true })}` : ''}
                  {r.situacao === 'em_revisao' ? ' · em revisão' : ''}
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
              aria-describedby={customValid ? 'limite-hint' : 'limite-erro limite-hint'}
              aria-invalid={customValid ? undefined : true}
              value={customText}
              onChange={(e) => setCustom(e.target.value)}
              data-testid="custom-limit"
            />
            <span>MB</span>
          </div>
          {!customValid && (
            <div className="hint err" id="limite-erro" data-testid="custom-limit-error">
              Informe um número entre {fmtMb(CUSTOM_MB_MIN)} e {fmtMb(CUSTOM_MB_MAX)} MB (use vírgula para decimais, como 1,5).
            </div>
          )}
          <div className="hint" id="limite-hint">
            Informe o limite exatamente como o tribunal declara: a margem de segurança de {META_PERCENTUAL_PADRAO}% é aplicada por nós. Consideramos 1 MB =
            1.000.000 bytes (a leitura mais conservadora).
          </div>
        </div>
      )}

      <div className="rule-info" data-testid="rule-info">
        {regra ? (
          <>
            <div>
              <strong>{regra.tribunal_sigla} · {rotuloSistema(regra)}</strong> — {regra.tribunal_nome}
              {rotuloContexto(regra) ? ` · ${rotuloContexto(regra)}` : ''}
            </div>
            <dl>
              <div>
                <dt>Limite declarado</dt>
                <dd>
                  {formatLimite(regra)}
                  {mostrarBytesDoLimite(regra) ? ` (${formatBytes(limiteBytes(regra))})` : ''}
                </dd>
              </div>
              <div><dt>Meta segura</dt><dd>{formatBytes(metaBytes(regra))} ({percentualMeta(regra)}% do limite)</dd></div>
              {regra.limite_por_pagina_kb && <div><dt>Por página</dt><dd>até {regra.limite_por_pagina_kb} KB (a meta de cada arquivo considera o número de páginas)</dd></div>}
              {regra.limite_total_peticao_mb && <div><dt>Por petição</dt><dd>soma dos arquivos até {regra.limite_total_peticao_mb} MB</dd></div>}
              {regra.limite_condicional && <div><dt>Condicional</dt><dd>{regra.limite_condicional.limite_valor} {regra.limite_condicional.limite_unidade} para arquivos com {regra.limite_condicional.min_paginas} páginas ou mais</dd></div>}
              {regra.exige_pdfa && <div><dt>Formato</dt><dd>exige PDF/A na petição inicial (converta depois de compactar)</dd></div>}
              <div><dt>Fonte oficial</dt><dd><a href={regra.fonte_url} target="_blank" rel="noreferrer noopener">{regra.fonte_titulo}</a></dd></div>
              <div><dt>Verificado em</dt><dd>{formatDate(regra.verificado_em)}</dd></div>
              {regra.situacao === 'em_revisao' && <div><dt>Situação</dt><dd><span className="badge warn">em revisão</span> {regra.motivo_revisao}</dd></div>}
            </dl>
            {regra.observacoes && <p className="hint">{regra.observacoes}</p>}
            <p className="hint">
              Regras mudam. Se o sistema recusar o arquivo, ajuste o limite manualmente e <a href="/contato/">avise a gente</a>.
            </p>
          </>
        ) : (
          <div>
            Limite: <strong>{formatBytes(resolved.limitBytes)}</strong> · meta segura: <strong>{formatBytes(resolved.targetBytes)}</strong> ({META_PERCENTUAL_PADRAO}% do limite, para
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
