import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_SETTINGS, deriveKind, isBusy, isStale as isStaleJob, type Settings, type OutputFile, type Job } from './lib/types'
import { useJobQueue, type EngineStatus } from './hooks/useJobQueue'
import { DropZone } from './components/DropZone'
import { Options } from './components/Options'
import { RuleSelector } from './components/RuleSelector'
import { BatchList } from './components/BatchList'
import { Stepper, type Phase } from './components/Stepper'
import { formatBytes } from './lib/format'
import { deviceCapacityWarning, resolveSettings } from './lib/limits'
import { formatLimite, regraPorId, rotuloSistema, tribunalPorSigla } from './lib/regras'
import { downloadZipEntries } from './lib/download'
import { safeFileName } from './lib/naming'
import { planZip, type ZipDoc, type ZipExcluded } from './lib/zipPlan'
import { LEVELS } from './lib/engine/levels'
import { SITE } from '../config/site.mjs'
import { track } from './lib/analytics'
import './tool.css'

const STORAGE_KEY = 'brpdf:settings:v1'
/** Chave usada antes do nome atual: lida uma vez para ninguém perder as preferências. */
const LEGACY_STORAGE_KEY = '6mb:settings:v2'

type View = 'home' | 'tool'

/** A URL pede a ferramenta? (?view=tool, ou link de página de tribunal com ?regra=) */
function initialView(): View {
  try {
    return /[?&](view=tool|regra=)/.test(window.location.search) ? 'tool' : 'home'
  } catch {
    return 'home'
  }
}

function loadSettings(): Settings {
  let s = DEFAULT_SETTINGS
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY)
    if (raw) s = { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) }
  } catch {
    // armazenamento indisponível: usa o padrão
  }
  // ?regra=<id>[&tribunal=<sigla>] vindo das páginas de tribunal (tribunal: quando a regra é nacional)
  try {
    const params = new URLSearchParams(window.location.search)
    const q = params.get('regra')
    const r = q ? regraPorId(q) : undefined
    if (r) {
      const t = params.get('tribunal')
      const tribunal = t && t !== r.tribunal_sigla && r.abrange?.includes(t) && tribunalPorSigla(t) ? t : null
      s = { ...s, ruleId: r.id, tribunal }
      track('regra_selecionada', { tribunal: tribunal ?? r.tribunal_sigla, sistema: r.sistema, origem: 'pagina' })
    }
  } catch {
    // sem window (SSR) ou URL inválida
  }
  if (s.ruleId && !regraPorId(s.ruleId)) s = { ...s, ruleId: null, tribunal: null }
  if (s.tribunal && !(s.ruleId && regraPorId(s.ruleId)?.abrange?.includes(s.tribunal))) s = { ...s, tribunal: null }
  return s
}

const plural = (n: number, um: string, varios: string) => (n === 1 ? um : varios)

/** Por que um arquivo ficou fora do pacote (texto do LEIA-ME). */
const EXCLUDED_REASON: Partial<Record<ReturnType<typeof deriveKind>, string>> = {
  signed: 'assinado digitalmente: nao processado (prepare antes de assinar, ou libere na ferramenta)',
  restricted: 'com restricoes de edicao: nao processado (libere na ferramenta se nao houver problema)',
  protected: 'exige senha para abrir: salve uma copia sem senha no programa de origem',
  invalid: 'nao e um PDF legivel',
  error: 'nao deu certo (veja o aviso na ferramenta)',
  ready: 'ainda nao processado',
  queued: 'ainda nao processado',
  processing: 'ainda nao processado',
  analyzing: 'ainda nao processado',
}

export default function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings)
  const process = useMemo(() => resolveSettings(settings), [settings])
  const [engine, setEngine] = useState<EngineStatus>({ state: 'idle' })
  const [notice, setNotice] = useState<string | null>(null)
  const [limitValid, setLimitValid] = useState(true)
  /** Única região aria-live da ferramenta: só marcos (análise concluída, lote concluído…). */
  const [announce, setAnnounce] = useState('')
  const [view, setView] = useState<View>(initialView)
  useEffect(() => {
    document.documentElement.dataset.view = view
    return () => {
      delete document.documentElement.dataset.view
    }
  }, [view])
  const openTool = useCallback(() => {
    setView('tool')
    try {
      const url = new URL(window.location.href)
      url.searchParams.set('view', 'tool')
      history.replaceState(null, '', url)
    } catch {
      // sem history
    }
    window.scrollTo({ top: 0 })
  }, [])
  const goHome = useCallback(() => {
    setView('home')
    try {
      const url = new URL(window.location.href)
      url.searchParams.delete('view')
      history.replaceState(null, '', url)
    } catch {
      // sem history
    }
    window.scrollTo({ top: 0 })
  }, [])
  // Links "Preparar PDFs" do cabeçalho e dos cards da página inicial abrem a ferramenta sem recarregar.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) return
      const target = e.target as Element | null
      if (target?.closest?.('a[data-open-tool]')) {
        e.preventDefault()
        openTool()
      } else {
        // Links de seção do cabeçalho: voltam à página inicial sem recarregar (o lote continua na memória).
        const home = target?.closest?.('a[data-go-home]') as HTMLAnchorElement | null
        if (!home) return
        e.preventDefault()
        goHome()
        const id = home.hash.slice(1)
        requestAnimationFrame(() => {
          const alvo = id ? document.getElementById(id) : null
          if (alvo) alvo.scrollIntoView({ block: 'start' })
        })
      }
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [openTool, goHome])
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
      if (pdfs.length > 0) openTool()
      const msg = ignored > 0 ? `${ignored} arquivo${ignored === 1 ? ' foi ignorado porque não é' : 's foram ignorados porque não são'} PDF.` : null
      setNotice(msg)
      if (msg) setAnnounce(msg)
    },
    [addFiles, openTool],
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
  /**
   * Pacote completo do lote: um ZIP com pasta raiz, arquivos numerados na ordem do lote,
   * partes em pasta própria, pastas por petição quando o sistema limita a soma, e LEIA-ME.txt.
   */
  const collectZip = async () => {
    if (zipping) return
    setZipping(true)
    try {
      const docs: ZipDoc[] = []
      const excluded: ZipExcluded[] = []
      for (const j of jobs) {
        const k = deriveKind(j, process)
        if (isStale(j)) {
          excluded.push({ name: j.name, reason: 'preparado para outra meta; reprocesse com a meta atual' })
          continue
        }
        if (k === 'done' && j.outputs.length > 0) {
          const level = j.level ? LEVELS.find((l) => l.id === j.level) : undefined
          docs.push({
            name: j.name,
            originalSize: j.originalSize,
            status: j.outputs.length > 1 ? 'split' : 'compressed',
            files: j.outputs,
            detail: j.contentUntouched ? 'paginas copiadas sem recompressao' : level ? `compressao ${level.label.toLowerCase()}${level.dpi ? ` (${level.dpi} dpi)` : ''}` : undefined,
            warnings: j.warnings,
          })
        } else if (k === 'unchanged' || (k === 'done' && j.outputs.length === 0)) {
          const bytes = new Uint8Array(await j.file.arrayBuffer())
          const file: OutputFile = { name: safeFileName(j.name), bytes, size: j.originalSize, kind: 'original' }
          docs.push({ name: j.name, originalSize: j.originalSize, status: 'kept', files: [file] })
        } else {
          excluded.push({ name: j.name, reason: EXCLUDED_REASON[k] ?? j.error ?? 'nao processado' })
        }
      }
      if (docs.length === 0) return
      const regra = settings.ruleId ? regraPorId(settings.ruleId) : undefined
      const plan = planZip({
        docs,
        excluded,
        when: new Date(),
        tribunal: regra ? { sigla: settings.tribunal ?? regra.tribunal_sigla, sistema: rotuloSistema(regra), limite: formatLimite(regra) } : undefined,
        limitBytes: process.limitBytes,
        targetBytes: process.targetBytes,
        petitionBytes: process.totalPetitionBytes,
        siteUrl: SITE.url,
      })
      downloadZipEntries(plan.entries, plan.zipName, plan.fileCount)
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

  const engineStatus = (
    <div className="engine-status" data-testid="engine-status" data-state={engine.state}>
      <span className={`dot${engine.state === 'ready' ? ' ready' : engine.state === 'error' ? ' err' : ''}`} aria-hidden="true" />
      {engine.state === 'loading' && (
        <span>
          <strong>Carregando o compactador…</strong> só na primeira visita, cerca de 11 MB. Você já pode escolher o tribunal e adicionar os arquivos.
        </span>
      )}
      {engine.state === 'ready' && (
        <span>
          <strong>Tudo pronto.</strong> Cada arquivo será preparado para até {formatBytes(process.targetBytes)}.
        </span>
      )}
      {engine.state === 'error' && (
        <span>
          <strong>O compactador não carregou.</strong> {engine.message ?? 'Recarregue a página para tentar de novo.'} A divisão em partes continua
          funcionando.
        </span>
      )}
      {engine.state === 'idle' && 'Iniciando…'}
    </div>
  )
  const liveRegion = (
    <div className="sr-only" role="status" aria-live="polite" data-testid="announce">
      {announce}
    </div>
  )

  if (view === 'home') {
    return (
      <div className="tool landing" data-phase={phase}>
        {liveRegion}
        <div className="hero-card">
          <h2>Prepare seu lote agora</h2>
          <RuleSelector settings={settings} onChange={setSettings} onValidity={setLimitValid} compact label="Tribunal e sistema" />
          <DropZone onFiles={onFiles} variant="hero" title="Arraste seus PDFs aqui" />
          {notice && <div className="note warn">{notice}</div>}
          {jobs.length > 0 && (
            <p className="hint resume">
              Você tem {jobs.length} arquivo{jobs.length === 1 ? '' : 's'} no lote.{' '}
              <a href="/?view=tool" data-open-tool>
                Voltar ao lote
              </a>
            </p>
          )}
          <div className="local-badge">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="4" y="10" width="16" height="11" rx="2" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            </svg>
            Processamento local
          </div>
          {engineStatus}
        </div>
      </div>
    )
  }

  return (
    <div className="tool tool-page" data-phase={phase}>
      {liveRegion}
      <div className="tool-head">
        <a
          className="btn small secondary"
          href="/"
          onClick={(e) => {
            e.preventDefault()
            goHome()
          }}
        >
          ← Voltar às ferramentas
        </a>
        <h1>Preparar PDFs para protocolo</h1>
        <span className="local-badge">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="4" y="10" width="16" height="11" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          </svg>
          Seus arquivos permanecem neste dispositivo
        </span>
      </div>
      <Stepper phase={phase} />

      <div className="tool-grid">
        <aside className="aside">
          <section className="card" aria-labelledby="h-config">
            <h2 id="h-config">Destino do protocolo</h2>
            <RuleSelector settings={settings} onChange={setSettings} onValidity={setLimitValid} />
          </section>
          <section className="card" aria-labelledby="h-opts">
            <h2 id="h-opts">Como preparar</h2>
            <Options settings={settings} onChange={setSettings} />
            {engineStatus}
          </section>
        </aside>

        <section className="card main" aria-labelledby="h-batch">
          {jobs.length === 0 ? (
            <>
              <h2 id="h-batch">Adicione os documentos</h2>
              <DropZone onFiles={onFiles} variant="hero" title="Arraste seus PDFs para começar" />
              {notice && (
                <div className="note warn spaced">
                  {notice}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="jobs-header">
                <h2 id="h-batch">{phase === 'result' ? 'Resultado' : phase === 'processing' ? 'Preparando…' : 'Revise o lote'}</h2>
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
                <div className="jobs-actions">
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
                    {zipping ? 'Montando o pacote…' : `Baixar lote em ZIP (${zipCount})`}
                  </button>
                )}
                {counts.busy === 0 && (
                  <button className="btn secondary" onClick={clear} data-testid="clear">
                    {phase === 'result' ? 'Novo lote' : 'Limpar lista'}
                  </button>
                )}
                </div>
              </div>

              {phase === 'processing' && batchCount > 0 && (
                <div className="overall">
                  <div className="progress" role="progressbar" aria-label="Progresso do lote" aria-valuemin={0} aria-valuemax={batchCount} aria-valuenow={batchDone}>
                    <div style={{ width: `${Math.max(2, (batchDone / batchCount) * 100)}%` }} />
                  </div>
                  <div className="stage">{`${batchDone} de ${batchCount} concluído${batchDone === 1 ? '' : 's'}`}</div>
                </div>
              )}

              {notice && <div className="note warn">{notice}</div>}
              {capacity && phase !== 'result' && <div className="note warn">{capacity}</div>}
              {overPetition && (
                <div className="note warn">
                  Este sistema limita a soma dos anexos de uma petição a {formatBytes(process.totalPetitionBytes!)} (já com a margem). O lote tem{' '}
                  {formatBytes(batchBytes)}: será preciso protocolar em mais de uma petição. O ZIP já separa os arquivos por petição.
                </div>
              )}
              {process.exigePdfa && (
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
                  Confira cada PDF antes de protocolar. O ZIP vem com os arquivos numerados na ordem do lote (01_, 02_…), sem acentos nem espaços,
                  documentos divididos em pasta própria{process.totalPetitionBytes !== undefined ? ', pastas por petição quando a soma passa do permitido' : ''} e um
                  LEIA-ME.txt com o resumo
                  {zipExcluded > 0 ? `; ${zipExcluded === 1 ? 'fica de fora o arquivo' : `ficam de fora os ${zipExcluded} arquivos`} com erro, com aviso ou fora da meta atual (listados no LEIA-ME)` : ''}.
                </p>
              )}

              <BatchList jobs={jobs} process={process} onRemove={remove} onRetry={retry} onAllow={allow} />
              <DropZone onFiles={onFiles} variant="compact" />
            </>
          )}
        </section>
      </div>
    </div>
  )
}
