import { useEffect, useState } from 'react'
import type { Settings } from '../lib/types'
import { opcoesPorRamo, regrasVigentes, regraPorId, formatLimite, limiteBytes, metaBytes, mostrarBytesDoLimite, percentualMeta, rotuloContexto, rotuloSistema, tribunalPorSigla, RAMO_ROTULO, TRIBUNAIS, META_PERCENTUAL_PADRAO } from '../lib/regras'
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
  const grupos = opcoesPorRamo(regras)
  const regra = settings.ruleId ? regraPorId(settings.ruleId) : undefined
  // Tribunal exibido: o escolhido (regra nacional herdada) ou o da própria regra.
  const siglaEscolhida = regra ? (settings.tribunal && regra.abrange?.includes(settings.tribunal) ? settings.tribunal : regra.tribunal_sigla) : undefined
  const tribunalEscolhido = siglaEscolhida ? tribunalPorSigla(siglaEscolhida) : undefined
  const herdada = regra !== undefined && siglaEscolhida !== regra.tribunal_sigla
  const valorSelect = regra ? (herdada ? `${regra.id}@${siglaEscolhida}` : regra.id) : 'custom'
  const cobertos = new Set([...grupos.values()].flat().map((o) => o.tribunal.sigla)).size
  const [customText, setCustomText] = useState(String(settings.customMb).replace('.', ','))
  const resolved = resolveSettings(settings)
  const customValid = regra !== undefined || isValidMb(parseMb(customText))

  useEffect(() => {
    onValidity?.(customValid)
  }, [customValid, onValidity])

  const setCustom = (text: string) => {
    setCustomText(text)
    const n = parseMb(text)
    if (isValidMb(n)) onChange({ ...settings, ruleId: null, tribunal: null, customMb: n })
  }

  return (
    <div className="rule-selector">
      <div className="field">
        <label htmlFor="regra" className="sr-only">
          Tribunal e sistema
        </label>
        <select
          id="regra"
          value={valorSelect}
          onChange={(e) => {
            const v = e.target.value
            if (v === 'custom') onChange({ ...settings, ruleId: null, tribunal: null })
            else {
              const [id, sigla] = v.split('@')
              const r = regraPorId(id)
              onChange({ ...settings, ruleId: id, tribunal: sigla ?? null })
              if (r) track('regra_selecionada', { tribunal: sigla ?? r.tribunal_sigla, sistema: r.sistema })
            }
          }}
        >
          <option value="custom">Outro limite (informar em MB)</option>
          {[...grupos.entries()].map(([ramo, lista]) => (
            <optgroup key={ramo} label={RAMO_ROTULO[ramo]}>
              {lista.map((o) => {
                const r = o.regra
                const ctx = rotuloContexto(r, { omitirAmbos: true })
                return (
                  <option key={`${r.id}@${o.tribunal.sigla}`} value={o.herdada ? `${r.id}@${o.tribunal.sigla}` : r.id}>
                    {o.tribunal.sigla} · {rotuloSistema(r)} · {formatLimite(r)}
                    {ctx ? ` · ${ctx}` : ''}
                    {o.herdada ? ' · regra nacional' : ''}
                    {r.situacao === 'em_revisao' ? ' · em revisão' : ''}
                  </option>
                )
              })}
            </optgroup>
          ))}
        </select>
        <div className="hint">
          {cobertos} dos {TRIBUNAIS.length} tribunais com regra. Não achou o seu? Escolha "Outro limite" e confira na tela de anexar do sistema (
          <a href="/tribunais/">diretório</a>).
        </div>
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
            1.000.000 bytes.
          </div>
        </div>
      )}

      <div className="rule-info" data-testid="rule-info">
        {regra ? (
          <>
            <div className="rule-name">
              {siglaEscolhida} · {rotuloSistema(regra)} <span className="sub">— {tribunalEscolhido?.nome ?? regra.tribunal_nome}</span>
              {rotuloContexto(regra) ? <span className="sub"> · {rotuloContexto(regra)}</span> : null}
              {herdada ? <span className="sub"> · regra nacional ({regra.tribunal_sigla})</span> : null}
            </div>
            <dl>
              <div>
                <dt>Limite declarado</dt>
                <dd>
                  {formatLimite(regra)}
                  {mostrarBytesDoLimite(regra) ? ` (${formatBytes(limiteBytes(regra))})` : ''}
                </dd>
              </div>
              <div>
                <dt>Meta segura</dt>
                <dd>
                  {formatBytes(metaBytes(regra))} · {percentualMeta(regra)}%
                </dd>
              </div>
              {regra.limite_por_pagina_kb && (
                <div>
                  <dt>Por página</dt>
                  <dd>até {regra.limite_por_pagina_kb} KB</dd>
                </div>
              )}
              {regra.limite_total_peticao_mb && (
                <div>
                  <dt>Por petição</dt>
                  <dd>até {regra.limite_total_peticao_mb} MB</dd>
                </div>
              )}
              {regra.limite_condicional && (
                <div>
                  <dt>Com {regra.limite_condicional.min_paginas}+ páginas</dt>
                  <dd>
                    {regra.limite_condicional.limite_valor} {regra.limite_condicional.limite_unidade}
                  </dd>
                </div>
              )}
              {regra.exige_pdfa && (
                <div>
                  <dt>Formato</dt>
                  <dd>PDF/A na inicial</dd>
                </div>
              )}
              <div>
                <dt>Verificado em</dt>
                <dd>{formatDate(regra.verificado_em)}</dd>
              </div>
            </dl>
            {regra.situacao === 'em_revisao' && (
              <div className="note warn" style={{ marginTop: 12 }}>
                <span className="badge warn inline">em revisão</span> {regra.motivo_revisao}
              </div>
            )}
            {regra.limite_por_pagina_kb ? <p className="hint" style={{ marginTop: 10 }}>A meta de cada arquivo considera o número de páginas.</p> : null}
            {regra.exige_pdfa ? <p className="hint" style={{ marginTop: 10 }}>Converta para PDF/A depois de compactar e antes de assinar.</p> : null}
            {regra.observacoes && (
              <p className="hint" style={{ marginTop: 10 }}>
                {regra.observacoes}
              </p>
            )}
            <p className="source">
              Fonte:{' '}
              <a href={regra.fonte_url} target="_blank" rel="noreferrer noopener">
                {regra.fonte_titulo}
              </a>
              . Se o sistema recusar, ajuste o limite e <a href="/contato/">avise a gente</a>.
            </p>
          </>
        ) : (
          <dl>
            <div>
              <dt>Limite informado</dt>
              <dd>{formatBytes(resolved.limitBytes)}</dd>
            </div>
            <div>
              <dt>Meta segura</dt>
              <dd>
                {formatBytes(resolved.targetBytes)} · {META_PERCENTUAL_PADRAO}%
              </dd>
            </div>
          </dl>
        )}
      </div>
    </div>
  )
}
