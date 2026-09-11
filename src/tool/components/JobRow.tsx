import { deriveKind, type Job } from '../lib/types'
import { formatBytes, formatDuration, formatReduction } from '../lib/format'
import { downloadFile, downloadZip } from '../lib/download'
import { LEVELS } from '../lib/engine/levels'

interface Props {
  job: Job
  targetBytes: number
  onRemove: (id: string) => void
  onRetry: (id: string) => void
  onAllowSigned: (id: string) => void
}

const KIND_LABEL: Record<ReturnType<typeof deriveKind>, { text: string; cls: string }> = {
  analyzing: { text: 'Analisando…', cls: 'info' },
  ready: { text: 'Será otimizado', cls: 'info' },
  unchanged: { text: 'Já cabe · mantido', cls: 'ok' },
  signed: { text: 'Assinado digitalmente', cls: 'warn' },
  protected: { text: 'Protegido por senha', cls: 'err' },
  invalid: { text: 'Não é um PDF legível', cls: 'err' },
  queued: { text: 'Na fila', cls: 'info' },
  processing: { text: 'Processando…', cls: 'info' },
  done: { text: '✓ Pronto', cls: 'ok' },
  error: { text: 'Não deu certo', cls: 'err' },
}

export function JobRow({ job, targetBytes, onRemove, onRetry, onAllowSigned }: Props) {
  const kind = deriveKind(job, targetBytes)
  const badge = KIND_LABEL[kind]
  const busy = kind === 'processing' || kind === 'queued'
  const totalOut = job.outputs.reduce((a, o) => a + o.size, 0)
  const level = job.level ? LEVELS.find((l) => l.id === job.level) : undefined
  const elapsed = job.startedAt && job.finishedAt ? formatDuration(job.finishedAt - job.startedAt) : null
  const pages = job.analysis?.pages

  return (
    <div className="job" data-testid="job" data-kind={kind}>
      <div className="job-top">
        <div className="job-title">
          <div className="job-name">{job.name}</div>
          <div className="job-meta">
            {formatBytes(job.originalSize)}
            {pages ? ` · ${pages} página${pages === 1 ? '' : 's'}` : ''}
            {kind === 'done' && level ? ` · compressão ${level.label.toLowerCase()}${level.dpi ? ` (${level.dpi} dpi)` : ''}` : ''}
            {kind === 'done' && job.contentUntouched && job.outputs.length > 0 ? ' · conteúdo intacto' : ''}
            {elapsed && (kind === 'done' || kind === 'error') ? ` · ${elapsed}` : ''}
          </div>
        </div>
        <span className={`badge ${badge.cls}`}>{badge.text}</span>
        <div className="job-actions">
          {kind === 'done' && job.outputs.length === 1 && (
            <button className="btn small" onClick={() => downloadFile(job.outputs[0])}>
              Baixar ({formatBytes(job.outputs[0].size)})
            </button>
          )}
          {kind === 'done' && job.outputs.length > 1 && (
            <button className="btn small" onClick={() => downloadZip(job.outputs, `${job.name.replace(/\.pdf$/i, '')}_partes.zip`)}>
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
            <button className="btn small secondary" onClick={() => onAllowSigned(job.id)} data-testid="allow-signed">
              Processar mesmo assim
            </button>
          )}
          <button className="btn small secondary" onClick={() => onRemove(job.id)} aria-label={`Remover ${job.name}`}>
            {busy ? 'Cancelar' : 'Remover'}
          </button>
        </div>
      </div>

      {kind === 'processing' && (
        <>
          <div className={`progress${job.progress <= 0 ? ' indeterminate' : ''}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(job.progress * 100)}>
            <div style={{ width: `${Math.max(2, job.progress * 100)}%` }} />
          </div>
          <div className="stage">{job.stage}</div>
        </>
      )}

      {kind === 'done' && job.outputs.length > 0 && (
        <div className="sizes">
          <span className="from">{formatBytes(job.originalSize)}</span>
          <span aria-hidden="true">→</span>
          <span className="to">{job.outputs.length > 1 ? `${job.outputs.length} partes, ${formatBytes(totalOut)} no total` : formatBytes(totalOut)}</span>
          {!job.contentUntouched && <span className="pct">−{formatReduction(job.originalSize, totalOut)}</span>}
          {job.outputs.every((o) => o.size <= (job.targetBytes ?? targetBytes)) && <span className="badge ok">dentro da meta</span>}
        </div>
      )}

      {kind === 'done' && job.outputs.length > 1 && (
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

      {kind === 'unchanged' && (
        <div className="note info">Este arquivo já está dentro da meta de {formatBytes(targetBytes)}. Ele será mantido exatamente como está.</div>
      )}
      {kind === 'done' && job.outputs.length === 0 && (
        <div className="note info">Já estava dentro da meta: mantido sem alteração.</div>
      )}
      {kind === 'signed' && (
        <div className="note warn">
          Detectamos uma assinatura digital. Qualquer alteração invalida a assinatura, por isso este arquivo não será processado. O ideal é
          preparar o PDF <em>antes</em> de assinar. Se a assinatura não for necessária, você pode processar mesmo assim.
        </div>
      )}
      {kind === 'protected' && (
        <div className="note err">
          Este PDF está protegido por senha. Não removemos proteções: abra-o no programa de origem, salve uma cópia sem senha e adicione de novo.
        </div>
      )}
      {kind === 'invalid' && (
        <div className="note err">Não foi possível ler este arquivo como PDF. {job.analysis?.reason ? `(${job.analysis.reason})` : ''}</div>
      )}
      {kind === 'done' && job.warnings.map((w) => <div className="note warn" key={w}>{w}</div>)}
      {kind === 'error' && <div className="note err">{job.error}</div>}
    </div>
  )
}
