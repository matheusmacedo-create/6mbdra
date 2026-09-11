import type { Job, ProcessSettings } from '../lib/types'
import { JobRow } from './JobRow'

interface Props {
  jobs: Job[]
  process: ProcessSettings
  onRemove: (id: string) => void
  onRetry: (id: string) => void
  onAllow: (id: string) => void
}

// Sem aria-live aqui: a lista muda o tempo todo durante o processamento e leitores de tela
// leriam cada troca de estágio. Os marcos são anunciados pela região de status do App.
export function BatchList({ jobs, process, onRemove, onRetry, onAllow }: Props) {
  if (jobs.length === 0) return null
  return (
    <div className="batch-list">
      {jobs.map((j) => (
        <JobRow key={j.id} job={j} process={process} onRemove={onRemove} onRetry={onRetry} onAllow={onAllow} />
      ))}
    </div>
  )
}
