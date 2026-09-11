import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_SETTINGS, deriveKind, isBusy, isStale as isStaleJob, type Settings, type OutputFile, type Job } from './lib/types'
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
    const r = q ? regraPorId(q) : undefined
    if (r) {
      s = { ...s, ruleId: r.id }
      track('regra_selecionada', { tribunal: r.tribunal_sigla, sistema: r.sistema, origem: 'pagina' })
    }
  } catch {
    // sem window (SSR) ou URL inválida
  }
  if (s.ruleId && !regraPorId(s.ruleId)) s = { ...s, ruleId: null }
  return s
}

const plural = (n: number, um: string, varios: string) => (n === 1 ? um : varios)

export default function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings)
  const process = useMemo(() => resolveSettings(settings), [settings])
  const [engine, setEngine] = useState<EngineStatus>({ state: 'idle' })
  const [notice, setNotice] = useState<string | null>(null)
  const [limitValid, setLimitValid] = useState(true)
  /** Única região aria-live da ferramenta: só marcos (análise concluída, lote concluído…). */
  const [announce, setAnnounce] = useState('')
  const { jobs, batchCount, addFiles, remove, clear, start, cancel, retry, allow } = useJobQueue(process, setEngine)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    } catch {
      // modo privado etc.
    }
  }, [settings])

  const kinds = jobs.map((j) => deriveKind(j, process))
  const counts = {
    ready: kinds.filter((k) => k === 'ready').length,
    unchanged: kinds.filter((k) => k === 'unchanged').length,
    blocked: kinds.filter((k) => k === 'signed' || k === 'restricted' || k === 'protected' || k === 'invalid').length,
    busy: jobs.filter(isBusy).length,
    analyzing: kinds.filter((k) => k === 'analyzing').length,
    done: kinds.filter((k) => k === 'done').length,
    error: kinds.filter((k) => k === 'error').length,
    stale: jobs.filter((j) => isStaleJob(j, process)).length,
  }
  // A análise prévia faz parte da revisão do lote (§5 etapa 3); "processing" é só o processamento de fato.
  const phase: Phase =
    jobs.length === 0 ? 'config' : counts.busy > 0 ? 'processing' : counts.analyzing === 0 && counts.ready === 0 && counts.done + counts.error > 0 ? 'result' : 'review'

  const onFiles = useCallback(
    (files: File[]) => {
      const pdfs = files.filter((f) => /\.pdf$/i.test(f.name) || f.type === 'application/pdf')
      const ignored = files.length - pdfs.length
      addFiles(pdfs)
      const msg = ignored > 0 ? `${ignored} arquivo${ignored === 1 ? ' foi ignorado porque não é' : 's foram ignorados porque não são'} PDF.` : null
      setNotice(msg)
      if (msg) setAnnounce(msg)
    },
    [addFiles],
  )

  // Marcos anunciados a leitores de tela (uma região só; a lista em si não é aria-live).
  const prevAnalyzing = useRef(0)
  useEffect(() => {
    if (prevAnalyzing.current > 0 && counts.analyzing === 0 && jobs.length > 0) {
      const parts = [
        `${counts.ready} para otimizar`,
        counts.unchanged > 0 ? `${counts.unchanged} já ${plural(counts.unchanged, 'cabe', 'cabem')}` : '',
        counts.blocked > 0 ? `${counts.blocked} com aviso` : '',
      ].filter(Boolean)
      setAnnounce(`Análise concluída: ${parts.join(', ')}.`)
    }
    prevAnalyzing.current = counts.analyzing
  }, [counts.analyzing, counts.ready, counts.unchanged, counts.blocked, jobs.length])
  const prevPhase = useRef<Phase>(phase)
  useEffect(() => {
    const from = prevPhase.current
    prevPhase.current = phase
    if (from === 'processing' && phase !== 'processing') {
      setAnnounce(
        phase === 'result'
          ? `Processamento concluído: ${counts.done} ${plural(counts.done, 'pronto', 'prontos')}${counts.error > 0 ? `, ${counts.error} com erro` : ''}.`
          : 'Processamento cancelado.',
      )
    }
  }, [phase, counts.done, counts.error])

  // Aviso ao fechar a aba com trabalho em andamento.
  useEffect(() => {
    if (counts.busy === 0) return
    const handler = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [counts.busy])

  const capacity = deviceCapacityWarning(jobs.map((j) => ({ size: j.originalSize })))

  /** Resultado preparado para outra meta e que não cabe na atual: fica fora do ZIP até reprocessar. */
  const isStale = (j: Job) => isStaleJob(j, process)
  const [zipping, setZipping] = useState(false)
  /** Tudo que vai no ZIP: resultados prontos + originais mantidos, na ordem do lote. */
  const collectZip = async () => {
    if (zipping) return
    setZipping(true)
    try {
      const files: OutputFile[] = []
      for (const j of jobs) {
        const k = deriveKind(j, process)
        if (isStale(j)) continue
        if (k === 'done' && j.outputs.length > 0) files.push(...j.outputs)
        else if (k === 'unchanged' || (k === 'done' && j.outputs.length === 0)) {
          files.push({ name: safeFileName(j.name), bytes: new Uint8Array(await j.file.arrayBuffer()), size: j.originalSize, kind: 'original' })
        }
      }
      if (files.length) downloadZip(files) // o evento 'download' é emitido por downloadZip
    } finally {
      setZipping(false)
    }
  }
  const zipCount = jobs.filter((j) => {
    const k = deriveKind(j, process)
    return (k === 'done' || k === 'unchanged') && !isStale(j)
  }).length
  const zipExcluded = jobs.length - zipCount

  // Limite da soma dos arquivos de uma petição (e-SAJ): a ferramenta não divide petições, só avisa.
  const batchBytes = jobs.reduce((a, j) => {
    if (j.status === 'done' && j.outputs.length) return a + j.outputs.reduce((x, o) => x + o.size, 0)
    return a + j.originalSize
  }, 0)
  const overPetition = process.totalPetitionBytes !== undefined && batchBytes > process.totalPetitionBytes

  const processedDone = jobs.filter((j) => j.status === 'done')
  const totalIn = processedDone.reduce((a, j) => a + j.originalSize, 0)
  const totalOut = processedDone.reduce((a, j) => a + (j.outputs.length ? j.outputs.reduce((x, o) => x + o.size, 0) : j.originalSize), 0)

  // Quantos entram ao clicar em Preparar: prontos + resultados preparados para outra meta.
  const toPrepare = counts.ready + counts.stale
  const batchDone = Math.max(0, Math.min(batchCount, batchCount - counts.busy))

  return (
    <div className="tool" data-phase={phase}>
      <Stepper phase={phase} />
      <div className="sr-only" role="status" aria-live="polite" data-testid="announce">
        {announce}
      </div>

      <section className="card" aria-labelledby="h-config">
        <h2 id="h-config">Escolha o tribunal ou o limite</h2>
        <RuleSelector settings={settings} onChange={setSettings} onValidity={setLimitValid} />
      </section>

      <section className="card" aria-labelledby="h-files">
        <h2 id="h-files">Adicione os PDFs</h2>
        <DropZone onFiles={onFiles} compact={jobs.length > 0} />
        {notice && (
          <div className="note warn" style={{ marginTop: 12 }}>
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
              {phase === 'result' ? 'Resultado' : phase === 'processing' ? 'Preparando…' : 'Revise o lote'}
            </h2>
            <span className="jobs-summary" data-testid="summary">
              {jobs.length} arquivo{jobs.length === 1 ? '' : 's'}
              {counts.ready > 0 ? ` · ${counts.ready} para otimizar` : ''}
              {counts.stale > 0 ? ` · ${counts.stale} fora da meta atual` : ''}
              {counts.unchanged > 0 ? ` · ${counts.unchanged} já ${plural(counts.unchanged, 'cabe', 'cabem')}` : ''}
              {counts.blocked > 0 ? ` · ${counts.blocked} com aviso` : ''}
              {counts.done - counts.stale > 0 ? ` · ${counts.done - counts.stale} ${plural(counts.done - counts.stale, 'pronto', 'prontos')}` : ''}
              {counts.error > 0 ? ` · ${counts.error} com erro` : ''}
              {processedDone.length > 0 && totalIn > 0 ? ` (${formatBytes(totalIn)} → ${formatBytes(totalOut)})` : ''}
            </span>
            <span className="spacer" />
            {phase === 'review' && counts.analyzing > 0 && (
              <button className="btn" disabled data-testid="start">
                Analisando…
              </button>
            )}
            {phase === 'review' && counts.analyzing === 0 && toPrepare > 0 && (
              <button className="btn" onClick={() => start()} disabled={!limitValid} title={limitValid ? undefined : 'Corrija o limite informado'} data-testid="start">
                {counts.ready > 0 ? `Preparar ${toPrepare} arquivo${toPrepare === 1 ? '' : 's'}` : `Reprocessar ${toPrepare} arquivo${toPrepare === 1 ? '' : 's'}`}
              </button>
            )}
            {phase === 'review' && counts.analyzing === 0 && toPrepare === 0 && (
              <span className="hint" data-testid="nothing-to-prepare">
                {counts.blocked > 0 ? 'Nada a preparar: veja os avisos abaixo.' : 'Todos os arquivos já cabem na meta. Nada a preparar.'}
              </span>
            )}
            {phase === 'processing' && counts.busy > 0 && (
              <button className="btn danger" onClick={cancel} data-testid="cancel">
                Cancelar processamento
              </button>
            )}
            {phase === 'result' && counts.stale > 0 && (
              <button className="btn" onClick={() => start()} disabled={!limitValid} data-testid="start">
                Reprocessar {counts.stale} arquivo{counts.stale === 1 ? '' : 's'}
              </button>
            )}
            {phase === 'result' && zipCount > 0 && (
              <button className={`btn${counts.stale > 0 ? ' secondary' : ''}`} onClick={collectZip} disabled={zipping} data-testid="download-all">
                {zipping ? 'Montando o ZIP…' : `Baixar ${zipCount} arquivo${zipCount === 1 ? '' : 's'} (.zip)`}
              </button>
            )}
            {counts.busy === 0 && (
              <button className="btn secondary" onClick={clear} data-testid="clear">
                {phase === 'result' ? 'Novo lote' : 'Limpar lista'}
              </button>
            )}
          </div>

          {phase === 'processing' && batchCount > 0 && (
            <div className="overall">
              <div className="progress" role="progressbar" aria-label="Progresso do lote" aria-valuemin={0} aria-valuemax={batchCount} aria-valuenow={batchDone}>
                <div style={{ width: `${Math.max(2, (batchDone / batchCount) * 100)}%` }} />
              </div>
              <div className="stage">{`${batchDone} de ${batchCount} concluído${batchDone === 1 ? '' : 's'}`}</div>
            </div>
          )}

          {capacity && phase !== 'result' && <div className="note warn">{capacity}</div>}
          {overPetition && (
            <div className="note warn">
              Este sistema também limita a soma dos arquivos de uma petição a {formatBytes(process.totalPetitionBytes!)} (já com a margem). O lote tem{' '}
              {formatBytes(batchBytes)}: será preciso protocolar em mais de uma petição.
            </div>
          )}
          {process.exigePdfa && phase !== 'config' && (
            <div className="note info">
              Este sistema exige PDF/A na petição inicial. Os arquivos preparados aqui saem em PDF comum: converta para PDF/A depois de compactar e antes de assinar.
            </div>
          )}
          {phase === 'review' && toPrepare > 0 && (
            <p className="hint">
              Ao clicar em <strong>Preparar</strong>, os arquivos marcados "será otimizado" são comprimidos (e divididos, se preciso)
              {counts.stale > 0 ? ' e os marcados "fora da meta atual" são reprocessados' : ''}. Os demais ficam como estão.
            </p>
          )}
          {phase === 'result' && (
            <p className="hint">
              Confira cada PDF antes de protocolar. O ZIP inclui os arquivos preparados e os que já cabiam, na ordem do lote
              {zipExcluded > 0 ? `; ${zipExcluded === 1 ? 'fica de fora o arquivo' : `ficam de fora os ${zipExcluded} arquivos`} com erro, com aviso ou fora da meta atual` : ''}.
            </p>
          )}

          <BatchList jobs={jobs} process={process} onRemove={remove} onRetry={retry} onAllow={allow} />
        </section>
      )}
    </div>
  )
}
