import { useCallback, useEffect, useMemo, useState } from 'react'
import { DEFAULT_SETTINGS, deriveKind, isBusy, type Settings, type OutputFile, type Job } from './lib/types'
import { useJobQueue, type EngineStatus } from './hooks/useJobQueue'
import { DropZone } from './components/DropZone'
import { RuleSelector } from './components/RuleSelector'
import { BatchList } from './components/BatchList'
import { Stepper, type Phase } from './components/Stepper'
import { formatBytes } from './lib/format'
import { deviceCapacityWarning, resolveSettings } from './lib/limits'
import { regraPorId } from './lib/regras'
import { downloadZip } from './lib/download'
import { safeFileName } from './lib/naming'
import { track } from './lib/analytics'
import './tool.css'

const STORAGE_KEY = '6mb:settings:v2'

function loadSettings(): Settings {
  let s = DEFAULT_SETTINGS
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) s = { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) }
  } catch {
    // armazenamento indisponível: usa o padrão
  }
  // ?regra=<id> vindo das páginas de tribunal
  try {
    const q = new URLSearchParams(window.location.search).get('regra')
    if (q && regraPorId(q)) s = { ...s, ruleId: q }
  } catch {
    // sem window (SSR) ou URL inválida
  }
  if (s.ruleId && !regraPorId(s.ruleId)) s = { ...s, ruleId: null }
  return s
}

export default function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings)
  const process = useMemo(() => resolveSettings(settings), [settings])
  const [engine, setEngine] = useState<EngineStatus>({ state: 'idle' })
  const [notice, setNotice] = useState<string | null>(null)
  const { jobs, addFiles, remove, clear, start, cancel, retry, allowSigned } = useJobQueue(process, setEngine)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    } catch {
      // modo privado etc.
    }
  }, [settings])

  const kinds = jobs.map((j) => deriveKind(j, process.targetBytes))
  const counts = {
    ready: kinds.filter((k) => k === 'ready').length,
    unchanged: kinds.filter((k) => k === 'unchanged').length,
    blocked: kinds.filter((k) => k === 'signed' || k === 'protected' || k === 'invalid').length,
    busy: jobs.filter(isBusy).length,
    analyzing: kinds.filter((k) => k === 'analyzing').length,
    done: kinds.filter((k) => k === 'done').length,
    error: kinds.filter((k) => k === 'error').length,
  }
  const phase: Phase =
    jobs.length === 0 ? 'config' : counts.busy > 0 || counts.analyzing > 0 ? 'processing' : counts.ready === 0 && counts.done + counts.error > 0 ? 'result' : 'review'

  const onFiles = useCallback(
    (files: File[]) => {
      const pdfs = files.filter((f) => /\.pdf$/i.test(f.name) || f.type === 'application/pdf')
      const ignored = files.length - pdfs.length
      addFiles(pdfs)
      setNotice(ignored > 0 ? `${ignored} arquivo${ignored === 1 ? ' foi ignorado porque não é' : 's foram ignorados porque não são'} PDF.` : null)
    },
    [addFiles],
  )

  // Aviso ao fechar a aba com trabalho em andamento.
  useEffect(() => {
    if (counts.busy === 0) return
    const handler = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [counts.busy])

  const capacity = deviceCapacityWarning(jobs.map((j) => ({ size: j.originalSize })))

  /** Resultado preparado para outra meta e que não cabe na atual: fica fora do ZIP até reprocessar. */
  const isStale = (j: Job) => j.status === 'done' && j.targetBytes !== undefined && j.targetBytes !== process.targetBytes && j.outputs.some((o) => o.size > process.targetBytes)
  const [zipping, setZipping] = useState(false)
  /** Tudo que vai no ZIP: resultados prontos + originais mantidos, na ordem do lote. */
  const collectZip = async () => {
    if (zipping) return
    setZipping(true)
    try {
      const files: OutputFile[] = []
      for (const j of jobs) {
        const k = deriveKind(j, process.targetBytes)
        if (isStale(j)) continue
        if (k === 'done' && j.outputs.length > 0) files.push(...j.outputs)
        else if (k === 'unchanged' || (k === 'done' && j.outputs.length === 0)) {
          files.push({ name: safeFileName(j.name), bytes: new Uint8Array(await j.file.arrayBuffer()), size: j.originalSize, kind: 'original' })
        }
      }
      if (files.length) {
        downloadZip(files)
        track('download', { tipo: 'zip', arquivos: files.length })
      }
    } finally {
      setZipping(false)
    }
  }
  const zipCount = jobs.filter((j) => {
    const k = deriveKind(j, process.targetBytes)
    return (k === 'done' || k === 'unchanged') && !isStale(j)
  }).length
  const staleCount = jobs.filter(isStale).length

  const processedDone = jobs.filter((j) => j.status === 'done')
  const totalIn = processedDone.reduce((a, j) => a + j.originalSize, 0)
  const totalOut = processedDone.reduce((a, j) => a + (j.outputs.length ? j.outputs.reduce((x, o) => x + o.size, 0) : j.originalSize), 0)

  return (
    <div className="tool" data-phase={phase}>
      <Stepper phase={phase} />

      <section className="card" aria-labelledby="h-config">
        <h2 id="h-config">
          <span className="step">1</span>Escolha o tribunal ou o limite
        </h2>
        <RuleSelector settings={settings} onChange={setSettings} />
      </section>

      <section className="card" aria-labelledby="h-files">
        <h2 id="h-files">
          <span className="step">2</span>Adicione os PDFs
        </h2>
        <DropZone onFiles={onFiles} compact={jobs.length > 0} />
        {notice && (
          <div className="note warn" style={{ marginTop: 12 }} role="status">
            {notice}
          </div>
        )}
        <div className="engine-status" data-testid="engine-status" data-state={engine.state}>
          <span className={`dot${engine.state === 'ready' ? ' ready' : engine.state === 'error' ? ' err' : ''}`} aria-hidden="true" />
          {engine.state === 'loading' && 'Preparando o motor de compressão (só na primeira vez, cerca de 11 MB)…'}
          {engine.state === 'ready' && `Motor pronto. Meta: até ${formatBytes(process.targetBytes)} por arquivo (limite de ${formatBytes(process.limitBytes)}).`}
          {engine.state === 'error' && `${engine.message ?? 'O motor de compressão não carregou.'} Ainda é possível dividir arquivos em partes.`}
          {engine.state === 'idle' && 'Iniciando…'}
        </div>
      </section>

      {jobs.length > 0 && (
        <section className="card" aria-labelledby="h-batch">
          <div className="jobs-header">
            <h2 id="h-batch" style={{ margin: 0 }}>
              <span className="step">3</span>
              {phase === 'result' ? 'Resultado' : phase === 'processing' ? 'Preparando…' : 'Revise o lote'}
            </h2>
            <span className="jobs-summary" data-testid="summary">
              {jobs.length} arquivo{jobs.length === 1 ? '' : 's'}
              {counts.ready > 0 ? ` · ${counts.ready} para otimizar` : ''}
              {counts.unchanged > 0 ? ` · ${counts.unchanged} já cabe${counts.unchanged === 1 ? '' : 'm'}` : ''}
              {counts.blocked > 0 ? ` · ${counts.blocked} com aviso` : ''}
              {counts.done > 0 ? ` · ${counts.done} pronto${counts.done === 1 ? '' : 's'}` : ''}
              {counts.error > 0 ? ` · ${counts.error} com erro` : ''}
              {processedDone.length > 0 && totalIn > 0 ? ` (${formatBytes(totalIn)} → ${formatBytes(totalOut)})` : ''}
            </span>
            <span className="spacer" />
            {phase === 'review' && (
              <button className="btn" onClick={() => start()} disabled={counts.ready === 0 || engine.state === 'loading'} data-testid="start">
                Preparar {counts.ready} arquivo{counts.ready === 1 ? '' : 's'}
              </button>
            )}
            {phase === 'processing' && counts.busy > 0 && (
              <button className="btn danger" onClick={cancel} data-testid="cancel">
                Cancelar processamento
              </button>
            )}
            {phase === 'result' && zipCount > 0 && (
              <button className="btn" onClick={collectZip} disabled={zipping} data-testid="download-all">
                {zipping ? 'Montando o ZIP…' : 'Baixar tudo (.zip)'}
              </button>
            )}
            {counts.busy === 0 && (
              <button className="btn secondary" onClick={clear} data-testid="clear">
                {phase === 'result' ? 'Novo lote' : 'Limpar lista'}
              </button>
            )}
          </div>

          {phase === 'processing' && (
            <div className="overall">
              <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={jobs.length} aria-valuenow={counts.done + counts.error}>
                <div style={{ width: `${Math.max(2, ((counts.done + counts.error) / Math.max(1, jobs.length)) * 100)}%` }} />
              </div>
              <div className="stage">
                {counts.analyzing > 0 ? 'Analisando os arquivos…' : `${counts.done + counts.error} de ${jobs.length} concluídos`}
              </div>
            </div>
          )}

          {capacity && phase !== 'result' && <div className="note warn" role="status">{capacity}</div>}
          {phase === 'review' && counts.ready > 0 && (
            <p className="hint">
              Ao clicar em <strong>Preparar</strong>, os arquivos marcados "será otimizado" são comprimidos (e divididos, se preciso). Os demais ficam como estão.
            </p>
          )}
          {phase === 'result' && (
            <p className="hint">
              Confira cada PDF antes de protocolar. O ZIP inclui os arquivos preparados e os que já cabiam, na ordem do lote.
              {staleCount > 0 ? ` ${staleCount} arquivo${staleCount === 1 ? ' foi preparado' : 's foram preparados'} para outra meta e ${staleCount === 1 ? 'fica' : 'ficam'} fora do ZIP até ser${staleCount === 1 ? '' : 'em'} reprocessado${staleCount === 1 ? '' : 's'}.` : ''}
            </p>
          )}

          <BatchList jobs={jobs} targetBytes={process.targetBytes} onRemove={remove} onRetry={retry} onAllowSigned={allowSigned} />
        </section>
      )}
    </div>
  )
}
