import { deriveKind, isStale as isStaleJob, targetFor, type Job, type ProcessSettings } from '../lib/types'
import { formatBytes, formatDuration, formatReduction } from '../lib/format'
import { downloadFile, downloadZip } from '../lib/download'
import { LEVELS } from '../lib/engine/levels'
import { baseName } from '../lib/naming'

interface Props {
  job: Job
  process: ProcessSettings
  onRemove: (id: string) => void
  onRetry: (id: string) => void
  onAllow: (id: string) => void
}

const KIND_LABEL: Record<ReturnType<typeof deriveKind>, { text: string; cls: string }> = {
  analyzing: { text: 'Analisando…', cls: 'info' },
  ready: { text: 'Será otimizado', cls: 'info' },
  unchanged: { text: 'Já cabe · mantido', cls: 'ok' },
  signed: { text: 'Assinado digitalmente', cls: 'warn' },
  restricted: { text: 'Com restrições de edição', cls: 'warn' },
  protected: { text: 'Exige senha', cls: 'err' },
  invalid: { text: 'Não é um PDF legível', cls: 'err' },
  queued: { text: 'Na fila', cls: 'info' },
  processing: { text: 'Processando…', cls: 'info' },
  done: { text: '✓ Pronto', cls: 'ok' },
  error: { text: 'Não deu certo', cls: 'err' },
}

function pageRangeLabel(range: [number, number]): string {
  return range[0] === range[1] ? `página ${range[0]}` : `páginas ${range[0]}–${range[1]}`
}

export function JobRow({ job, process, onRemove, onRetry, onAllow }: Props) {
  const targetBytes = targetFor(job, process)
  const kind = deriveKind(job, process)
  const stale = isStaleJob(job, process)
  const badge = stale ? { text: 'Fora da meta atual', cls: 'warn' } : KIND_LABEL[kind]
  const busy = kind === 'processing' || kind === 'queued'
  const totalOut = job.outputs.reduce((a, o) => a + o.size, 0)
  const level = job.level ? LEVELS.find((l) => l.id === job.level) : undefined
  const elapsed = job.startedAt && job.finishedAt ? formatDuration(job.finishedAt - job.startedAt) : null
  const pages = job.analysis?.pages

  return (
    <div className="job" data-testid="job" data-kind={kind}>
      <div className="job-top">
        <span className="pdf-icon" aria-hidden="true">PDF</span>
        <div className="job-title">
          <div className="job-name">{job.name}</div>
          <div className="job-meta">
            {formatBytes(job.originalSize)}
            {pages ? ` · ${pages} página${pages === 1 ? '' : 's'}` : ''}
            {kind === 'done' && level ? ` · compressão ${level.label.toLowerCase()}${level.dpi ? ` (${level.dpi} dpi)` : ''}` : ''}
            {kind === 'done' && job.contentUntouched && job.outputs.length > 0 ? ' · páginas copiadas sem recompressão' : ''}
            {elapsed && (kind === 'done' || kind === 'error') ? ` · ${elapsed}` : ''}
          </div>
        </div>
        <span className={`badge ${badge.cls}`}>{badge.text}</span>
        <div className="job-actions">
          {stale && (
            <button className="btn small" onClick={() => onRetry(job.id)} data-testid="reprocess">
              Reprocessar com a meta atual
            </button>
          )}
          {kind === 'done' && job.outputs.length === 1 && (
            <button className={`btn small${stale ? ' secondary' : ''}`} onClick={() => downloadFile(job.outputs[0])}>
              Baixar ({formatBytes(job.outputs[0].size)})
            </button>
          )}
          {kind === 'done' && job.outputs.length > 1 && (
            <button className={`btn small${stale ? ' secondary' : ''}`} onClick={() => downloadZip(job.outputs, `${baseName(job.name)}_partes.zip`, 'partes')}>
              Baixar as {job.outputs.length} partes (.zip)
            </button>
          )}
          {kind === 'error' && job.outputs.length > 0 && (
            <button className="btn small secondary" onClick={() => downloadFile(job.outputs[0])} title="Baixa o melhor resultado obtido, mesmo acima do limite">
              Baixar mesmo assim ({formatBytes(job.outputs[0].size)})
            </button>
          )}
          {kind === 'error' && (
            <button className="btn small secondary" onClick={() => onRetry(job.id)}>
              Tentar de novo
            </button>
          )}
          {kind === 'signed' && (
            <button className="btn small secondary" onClick={() => onAllow(job.id)} data-testid="allow-signed">
              Processar mesmo assim
            </button>
          )}
          {kind === 'restricted' && (
            <button className="btn small secondary" onClick={() => onAllow(job.id)} data-testid="allow-restricted">
              Processar mesmo assim
            </button>
          )}
          <button className="btn small secondary" onClick={() => onRemove(job.id)} aria-label={`${busy ? 'Cancelar' : 'Remover'} ${job.name}`}>
            {busy ? 'Cancelar' : 'Remover'}
          </button>
        </div>
      </div>

      {kind === 'processing' && (
        <div className="indent">
          <div
            className={`progress${job.progress <= 0 ? ' indeterminate' : ''}`}
            role="progressbar"
            aria-label={`Progresso de ${job.name}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={job.progress > 0 ? Math.round(job.progress * 100) : undefined}
            aria-valuetext={job.stage}
          >
            <div style={{ width: `${Math.max(2, job.progress * 100)}%` }} />
          </div>
          <div className="stage">{job.stage}</div>
        </div>
      )}

      {kind === 'done' && job.outputs.length > 0 && (
        <div className="sizes indent">
          <span className="from">{formatBytes(job.originalSize)}</span>
          <span aria-hidden="true" className="arrow">→</span>
          <span className="to">{job.outputs.length > 1 ? `${job.outputs.length} partes, ${formatBytes(totalOut)} no total` : formatBytes(totalOut)}</span>
          {!job.contentUntouched && <span className="pct">−{formatReduction(job.originalSize, totalOut)}</span>}
          {!stale && job.outputs.every((o) => o.size <= targetBytes) && <span className="badge ok">dentro da meta</span>}
        </div>
      )}

      {kind === 'done' && job.outputs.length > 1 && (
        <div className="parts indent">
          {job.outputs.map((o) => (
            <div className="part" key={o.name}>
              <span className="part-name">
                {o.name}
                {o.pageRange ? <span className="job-meta"> · {pageRangeLabel(o.pageRange)}</span> : null}
              </span>
              <span className="badge ok">{formatBytes(o.size)}</span>
              <button className="btn small secondary" onClick={() => downloadFile(o)} aria-label={`Baixar ${o.name}`}>
                Baixar
              </button>
            </div>
          ))}
        </div>
      )}

      {kind === 'done' && job.outputs.length === 0 && (
        <div className="note info indent">Já estava dentro da meta: mantido sem alteração.</div>
      )}
      {kind === 'signed' && (
        <div className="note warn indent">
          Detectamos uma assinatura digital. Qualquer alteração invalida a assinatura, por isso este arquivo não será processado. O ideal é
          preparar o PDF <em>antes</em> de assinar. Se a assinatura não for necessária, você pode processar mesmo assim.
        </div>
      )}
      {kind === 'restricted' && (
        <div className="note warn indent">
          Este PDF abre sem senha, mas tem restrições de edição ou impressão (senha de permissões). Não removemos proteções por padrão: se
          processado, o arquivo preparado sai sem essas restrições. Se isso não for um problema, você pode processar mesmo assim.
        </div>
      )}
      {kind === 'protected' && (
        <div className="note err indent">
          Este PDF exige senha para ser aberto. Não removemos proteções: abra-o no programa de origem com a senha, salve uma cópia sem senha e adicione de novo.
        </div>
      )}
      {kind === 'invalid' && (
        <div className="note err indent">Não foi possível ler este arquivo como PDF. {job.analysis?.reason ? `(${job.analysis.reason})` : ''}</div>
      )}
      {stale && (
        <div className="note warn indent">
          Este arquivo foi preparado para a meta de {formatBytes(job.targetBytes!)}; a meta atual é {formatBytes(targetBytes)} e o resultado não cabe nela. Reprocesse antes de protocolar.
        </div>
      )}
      {kind === 'unchanged' && job.analysis?.signed && (
        <div className="note info indent">Assinado digitalmente e já dentro da meta: mantido exatamente como está.</div>
      )}
      {process.perPageBytes && (kind === 'ready' || kind === 'unchanged') && job.analysis?.pages ? (
        <div className="job-meta indent">
          Meta para este arquivo: {formatBytes(targetBytes)} (este sistema também limita cada página a {formatBytes(process.perPageBytes)}).
        </div>
      ) : null}
      {kind === 'done' && job.warnings.map((w) => <div className="note warn indent" key={w}>{w}</div>)}
      {kind === 'error' && <div className="note err indent">{job.error}</div>}
    </div>
  )
}
