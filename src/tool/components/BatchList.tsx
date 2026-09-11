import type { Job } from '../lib/types'
import { JobRow } from './JobRow'

interface Props {
  jobs: Job[]
  targetBytes: number
  onRemove: (id: string) => void
  onRetry: (id: string) => void
  onAllowSigned: (id: string) => void
}

export function BatchList({ jobs, targetBytes, onRemove, onRetry, onAllowSigned }: Props) {
  if (jobs.length === 0) return null
  return (
    <div className="batch-list" aria-live="polite">
      {jobs.map((j) => (
        <JobRow key={j.id} job={j} targetBytes={targetBytes} onRemove={onRemove} onRetry={onRetry} onAllowSigned={onAllowSigned} />
      ))}
    </div>
  )
}
