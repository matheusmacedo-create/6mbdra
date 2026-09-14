import type { Job, ProcessSettings } from '../lib/types'
import { JobRow } from './JobRow'

interface Props {
  jobs: Job[]
  process: ProcessSettings
  onRemove: (id: string) => void
  onRetry: (id: string) => void
  onAllow: (id: string) => void
  /** Quando presente, cada linha ganha setas de ordem (a ordem vale para o PDF juntado e o ZIP). */
  onMove?: (id: string, delta: -1 | 1) => void
}

// Sem aria-live aqui: a lista muda o tempo todo durante o processamento e leitores de tela
// leriam cada troca de estágio. Os marcos são anunciados pela região de status do App.
export function BatchList({ jobs, process, onRemove, onRetry, onAllow, onMove }: Props) {
  if (jobs.length === 0) return null
  return (
    <div className="batch-list">
      {jobs.map((j, i) => (
        <JobRow
          key={j.id}
          job={j}
          process={process}
          onRemove={onRemove}
          onRetry={onRetry}
          onAllow={onAllow}
          onMove={onMove}
          posicao={i + 1}
          total={jobs.length}
        />
      ))}
    </div>
  )
}
