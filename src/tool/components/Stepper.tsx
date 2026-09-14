export type Phase = 'config' | 'review' | 'processing' | 'result'

const STEPS: { key: Phase; label: string }[] = [
  { key: 'config', label: 'Selecionar PDFs' },
  { key: 'review', label: 'Escolher tribunal' },
  { key: 'processing', label: 'Preparar arquivos' },
  { key: 'result', label: 'Baixar lote' },
]

interface Props {
  phase: Phase
  /**
   * Antes de existir arquivo não faz sentido mostrar quatro etapas vazias: uma linha só diz
   * onde a pessoa está ("1 de 4 — Selecionar PDFs") sem encher a primeira tela.
   */
  compact?: boolean
}

export function Stepper({ phase, compact = false }: Props) {
  const active = Math.max(0, STEPS.findIndex((s) => s.key === phase))
  if (compact) {
    return (
      <p className="step-hint" data-testid="step-hint">
        {active + 1} de {STEPS.length} — {STEPS[active].label}
      </p>
    )
  }
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
