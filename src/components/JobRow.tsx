import type { Job } from '../lib/types'
import { formatBytes, formatDuration, formatReduction } from '../lib/format'
import { downloadFile, downloadZip } from '../lib/download'
import { LEVELS } from '../lib/engine/levels'

interface Props {
  job: Job
  limitBytes: number
  onRemove: (id: string) => void
  onRetry: (id: string) => void
}

function StatusBadge({ job }: { job: Job }) {
  switch (job.status) {
    case 'queued':
      return <span className="badge info">Na fila</span>
    case 'analyzing':
    case 'compressing':
    case 'splitting':
      return <span className="badge info">Processando…</span>
    case 'done':
      return <span className="badge ok">✓ Pronto</span>
    case 'skipped':
      return <span className="badge ok">✓ Já cabe</span>
    case 'error':
      return <span className="badge err">Não deu certo</span>
  }
}

export function JobRow({ job, limitBytes, onRemove, onRetry }: Props) {
  const running = job.status === 'analyzing' || job.status === 'compressing' || job.status === 'splitting'
  const totalOut = job.outputs.reduce((a, o) => a + o.size, 0)
  const level = job.level ? LEVELS.find((l) => l.id === job.level) : undefined
  const elapsed = job.startedAt && job.finishedAt && job.status !== 'skipped' ? formatDuration(job.finishedAt - job.startedAt) : null

  return (
    <div className="job" data-testid="job" data-status={job.status}>
      <div className="job-top">
        <div className="job-title">
          <div className="job-name">{job.name}</div>
          <div className="job-meta">
            {formatBytes(job.originalSize)}
            {job.pages ? ` · ${job.pages} página${job.pages === 1 ? '' : 's'}` : ''}
            {level && job.status !== 'skipped' ? ` · compressão ${level.label.toLowerCase()} (${level.colorDpi} dpi)` : ''}
            {elapsed ? ` · ${elapsed}` : ''}
          </div>
        </div>
        <StatusBadge job={job} />
        <div className="job-actions">
          {job.status === 'done' && job.outputs.length === 1 && (
            <button className="btn small" onClick={() => downloadFile(job.outputs[0])}>
              Baixar ({formatBytes(job.outputs[0].size)})
            </button>
          )}
          {job.status === 'done' && job.outputs.length > 1 && (
            <button className="btn small" onClick={() => downloadZip(job.outputs, `${job.name.replace(/\.pdf$/i, '')} - partes.zip`)}>
              Baixar todas as partes (.zip)
            </button>
          )}
          {job.status === 'error' && job.outputs.length > 0 && (
            <button className="btn small secondary" onClick={() => downloadFile(job.outputs[0])} title="Baixa o melhor resultado obtido, mesmo acima do limite">
              Baixar mesmo assim ({formatBytes(job.outputs[0].size)})
            </button>
          )}
          {job.status === 'error' && (
            <button className="btn small secondary" onClick={() => onRetry(job.id)}>
              Tentar de novo
            </button>
          )}
          <button className="btn small secondary" onClick={() => onRemove(job.id)} aria-label={`Remover ${job.name}`}>
            {running ? 'Cancelar' : 'Remover'}
          </button>
        </div>
      </div>

      {running && (
        <>
          <div className={`progress${job.progress <= 0 ? ' indeterminate' : ''}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(job.progress * 100)}>
            <div style={{ width: `${Math.max(2, job.progress * 100)}%` }} />
          </div>
          <div className="stage">{job.stage}</div>
        </>
      )}

      {job.status === 'done' && (
        <div className="sizes">
          <span className="from">{formatBytes(job.originalSize)}</span>
          <span aria-hidden="true">→</span>
          <span className="to">{job.outputs.length > 1 ? `${job.outputs.length} partes, ${formatBytes(totalOut)} no total` : formatBytes(totalOut)}</span>
          <span className="pct">−{formatReduction(job.originalSize, totalOut)}</span>
          {job.outputs.length === 1 && job.outputs[0].size <= limitBytes && <span className="badge ok">dentro do limite</span>}
        </div>
      )}

      {job.status === 'done' && job.outputs.length > 1 && (
        <div className="parts">
          {job.outputs.map((o) => (
            <div className="part" key={o.name}>
              <span className="part-name">
                {o.name}
                {o.pageRange ? <span className="job-meta"> · páginas {o.pageRange[0]}–{o.pageRange[1]}</span> : null}
              </span>
              <span className="badge ok">{formatBytes(o.size)}</span>
              <button className="btn small secondary" onClick={() => downloadFile(o)}>
                Baixar
              </button>
            </div>
          ))}
        </div>
      )}

      {job.status === 'skipped' && (
        <div className="note info">
          Este arquivo tem {formatBytes(job.originalSize)} e já está dentro do limite de {formatBytes(limitBytes)}. Não precisa compactar.
        </div>
      )}
      {job.warning && job.status === 'done' && <div className="note warn">{job.warning}</div>}
      {job.status === 'error' && <div className="note err">{job.error}</div>}
    </div>
  )
}
