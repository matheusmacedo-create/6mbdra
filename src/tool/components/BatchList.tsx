import type { Job, ProcessSettings } from '../lib/types'
import { JobRow } from './JobRow'

interface Props {
  jobs: Job[]
  process: ProcessSettings
  onRemove: (id: string) => void
  onRetry: (id: string) => void
  onAllowSigned: (id: string) => void
}

export function BatchList({ jobs, process, onRemove, onRetry, onAllowSigned }: Props) {
  if (jobs.length === 0) return null
  return (
    <div className="batch-list" aria-live="polite">
      {jobs.map((j) => (
        <JobRow key={j.id} job={j} process={process} onRemove={onRemove} onRetry={onRetry} onAllowSigned={onAllowSigned} />
      ))}
    </div>
  )
}
