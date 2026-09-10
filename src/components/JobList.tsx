import type { Job } from '../lib/types'
import { JobRow } from './JobRow'
import { downloadZip } from '../lib/download'
import { formatBytes } from '../lib/format'

interface Props {
  jobs: Job[]
  limitBytes: number
  onRemove: (id: string) => void
  onRetry: (id: string) => void
  onClear: () => void
}

export function JobList({ jobs, limitBytes, onRemove, onRetry, onClear }: Props) {
  if (jobs.length === 0) return null
  const done = jobs.filter((j) => j.status === 'done')
  const outputs = done.flatMap((j) => j.outputs)
  const running = jobs.filter((j) => j.status === 'analyzing' || j.status === 'compressing' || j.status === 'splitting' || j.status === 'queued')
  const totalIn = done.reduce((a, j) => a + j.originalSize, 0)
  const totalOut = outputs.reduce((a, o) => a + o.size, 0)

  return (
    <section className="card" aria-live="polite">
      <div className="jobs-header">
        <h2 style={{ margin: 0 }}>
          <span className="step">3</span>Seus arquivos
        </h2>
        <span className="jobs-summary">
          {jobs.length} arquivo{jobs.length === 1 ? '' : 's'}
          {running.length > 0 ? ` · ${running.length} em andamento` : ''}
          {done.length > 0 ? ` · ${done.length} pronto${done.length === 1 ? '' : 's'} (${formatBytes(totalIn)} → ${formatBytes(totalOut)})` : ''}
        </span>
        <span className="spacer" />
        {outputs.length > 1 && (
          <button className="btn" onClick={() => downloadZip(outputs)} data-testid="download-all">
            Baixar todos (.zip)
          </button>
        )}
        {running.length === 0 && (
          <button className="btn secondary" onClick={onClear}>
            Limpar lista
          </button>
        )}
      </div>
      {jobs.map((j) => (
        <JobRow key={j.id} job={j} limitBytes={limitBytes} onRemove={onRemove} onRetry={onRetry} />
      ))}
    </section>
  )
}
