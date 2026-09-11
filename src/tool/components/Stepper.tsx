export type Phase = 'config' | 'review' | 'processing' | 'result'

const STEPS: { key: Phase; label: string }[] = [
  { key: 'config', label: 'Configurar' },
  { key: 'review', label: 'Revisar o lote' },
  { key: 'processing', label: 'Preparar' },
  { key: 'result', label: 'Baixar' },
]

export function Stepper({ phase }: { phase: Phase }) {
  const active = STEPS.findIndex((s) => s.key === phase)
  return (
    <ol className="stepper" aria-label="Etapas">
      {STEPS.map((s, i) => (
        <li key={s.key} className={i < active ? 'done' : i === active ? 'active' : ''} aria-current={i === active ? 'step' : undefined}>
          <span className="step-num" aria-hidden="true">{i < active ? '✓' : i + 1}</span>
          <span className="step-label">{s.label}</span>
        </li>
      ))}
    </ol>
  )
}
