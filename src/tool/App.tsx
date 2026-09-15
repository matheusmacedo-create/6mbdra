import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_SETTINGS, deriveKind, isBusy, isStale as isStaleJob, podeJuntar, type Settings, type OutputFile, type Job } from './lib/types'
import { useJobQueue, type EngineStatus } from './hooks/useJobQueue'
import { DropZone, type OrigemArquivos } from './components/DropZone'
import { Options } from './components/Options'
import { RuleSelector } from './components/RuleSelector'
import { BatchList } from './components/BatchList'
import { Stepper, type Phase } from './components/Stepper'
import { formatBytes, mbToBytes } from './lib/format'
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

/** A URL pede a ferramenta? (?view=tool, ou link de página de tribunal/tamanho com ?regra= ou ?limiteMb=) */
function initialView(): View {
  try {
    return /[?&](view=tool|regra=|limiteMb=)/.test(window.location.search) ? 'tool' : 'home'
  } catch {
    return 'home'
  }
}

/**
 * Quem chega de uma página de tribunal (/tribunais/x/ → ?regra=…) já escolheu o destino ali.
 * A primeira tela não pede tribunal, mas precisa confirmar o que foi herdado da URL — senão a
 * promessa feita na página do tribunal some sem explicação.
 */
let regraVeioDaUrl = false
/** O mesmo, para quem chega de uma página de tamanho-alvo (/comprimir-pdf-para-1mb/ → ?limiteMb=1). */
let limiteVeioDaUrl = false

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
      regraVeioDaUrl = true
      track('regra_selecionada', { tribunal: tribunal ?? r.tribunal_sigla, sistema: r.sistema, origem: 'pagina' })
    } else {
      // ?limiteMb=<decimal> vindo das páginas de tamanho-alvo (/comprimir-pdf-para-1mb/, etc.)
      const lm = Number((params.get('limiteMb') ?? '').replace(',', '.'))
      if (Number.isFinite(lm) && lm > 0 && lm <= 1000) {
        s = { ...s, ruleId: null, customMb: lm }
        limiteVeioDaUrl = true
        track('regra_selecionada', { origem: 'pagina_tamanho', limiteMb: lm })
      }
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
  unknown: 'nao foi possivel analisar; tente preparar na ferramenta',
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
  const openTool = useCallback((origem: string = 'botao') => {
    setView('tool')
    track('abriu_ferramenta', { origem })
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
    track('voltou_inicio')
    try {
      const url = new URL(window.location.href)
      url.searchParams.delete('view')
      history.replaceState(null, '', url)
    } catch {
      // sem history
    }
    window.scrollTo({ top: 0 })
  }, [])
  /** Quantos arquivos existem agora — lido pelo CTA do cabeçalho, que roda fora do React. */
  const jobsCountRef = useRef(0)
  /** Sem arquivos, "Preparar PDFs" não troca de tela: leva o foco para a área de upload. */
  const focarUpload = useCallback(() => {
    requestAnimationFrame(() => {
      const zona = document.querySelector<HTMLElement>('.dropzone.zone-hero')
      if (!zona) return
      zona.scrollIntoView({ behavior: 'smooth', block: 'center' })
      zona.focus({ preventScroll: true })
    })
  }, [])
  // Links "Preparar PDFs" do cabeçalho e dos cards da página inicial abrem a ferramenta sem recarregar.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) return
      const target = e.target as Element | null
      const abrir = target?.closest?.('a[data-open-tool]') as HTMLAnchorElement | null
      if (abrir) {
        e.preventDefault()
        // O atributo diz qual link foi clicado (cabeçalho, card de ferramenta…); sem valor, é só "link".
        const origem = abrir.dataset.openTool || 'link'
        // Só o CTA do cabeçalho muda de comportamento: sem arquivo nenhum, ele desce até o upload
        // em vez de trocar de tela (não haveria nada de novo para mostrar). Os demais links abrem a
        // bancada como sempre, inclusive vindos de outras páginas.
        if (origem === 'cabecalho' && jobsCountRef.current === 0) focarUpload()
        else openTool(origem)
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
  }, [openTool, goHome, focarUpload])
  const { jobs, batchCount, juntando, addFiles, remove, clear, start, cancel, retry, allow, juntar, mover } = useJobQueue(process, setEngine)
  jobsCountRef.current = jobs.length

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
    (files: File[], origem: OrigemArquivos) => {
      const pdfs = files.filter((f) => /\.pdf$/i.test(f.name) || f.type === 'application/pdf')
      const ignored = files.length - pdfs.length
      addFiles(pdfs, origem)
      if (pdfs.length > 0) openTool(origem === 'arrastar' ? 'arrastou_arquivo' : 'escolheu_arquivo')
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
      track('zip_gerado', { quantidade: plan.fileCount, partes: docs.length, situacao: excluded.length ? 'com_excluidos' : 'completo' })
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
  /** Documentos que podem virar um só. Assinados nunca entram — ver podeJuntar(). */
  const juntaveis = jobs.filter(podeJuntar).length
  /** Ficam de fora da junção (assinado, com senha, ilegível): a pessoa precisa saber antes. */
  const foraDaJuncao = jobs.length - juntaveis
  const assinadosForaDaJuncao = jobs.filter((j) => j.analysis?.signed).length
  const vaiJuntar = settings.merge && juntaveis > 1

  /**
   * O botão principal é um só. Com a opção marcada ele primeiro junta e só depois prepara — assim
   * o arquivo juntado passa pela compressão e pela divisão como qualquer outro, o que resolve
   * sozinho o caso de a soma dos documentos estourar o limite do tribunal.
   */
  const preparar = async () => {
    try {
      if (vaiJuntar) await juntar()
    } catch (e) {
      setNotice(`Não foi possível juntar os documentos: ${e instanceof Error ? e.message : 'erro desconhecido'}`)
      return
    }
    start()
  }
  const batchDone = Math.max(0, Math.min(batchCount, batchCount - counts.busy))

  /*
   * Estado do motor. Na primeira tela ele fica escondido — status técnico não ajuda quem só quer
   * mandar o PDF —, com uma exceção: se o compactador não carregou, isso muda o que a pessoa pode
   * esperar e precisa aparecer. Não é região aria-live: quem anuncia é o liveRegion, um só.
   */
  const engineStatus = (discreto = false) => (
    <div className={`engine-status${discreto && engine.state !== 'error' ? ' sr-only' : ''}`} data-testid="engine-status" data-state={engine.state}>
      <span className={`dot${engine.state === 'ready' ? ' ready' : engine.state === 'error' ? ' err' : ''}`} aria-hidden="true" />
      {engine.state === 'loading' && (
        <span>
          <strong>Carregando o compactador…</strong> só na primeira visita, cerca de 11 MB.
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
  const check = (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m20 6-11 11-5-5" />
    </svg>
  )
  /** Linha de confiança: texto simples embaixo do upload, sem virar cards. */
  const trustLine = (
    <ul className="trust-line">
      <li>{check}Processamento local</li>
      <li>{check}Texto preservado</li>
      <li>{check}Sem cadastro</li>
    </ul>
  )
  /** Confirmação do destino herdado da URL — só texto, nenhum ajuste, e só quando veio de link. */
  const regraAtual = settings.ruleId ? regraPorId(settings.ruleId) : undefined
  const destinoHerdado =
    regraVeioDaUrl && regraAtual ? (
      <p className="destino-herdado">
        Destino já escolhido: <strong>{settings.tribunal ?? regraAtual.tribunal_sigla} · {rotuloSistema(regraAtual)}</strong> — limite{' '}
        {formatLimite(regraAtual)}. Dá para trocar depois de escolher os arquivos.
      </p>
    ) : limiteVeioDaUrl ? (
      <p className="destino-herdado">
        Destino já escolhido: <strong>limite de {formatBytes(mbToBytes(settings.customMb))} por arquivo</strong>. Dá para trocar depois de escolher os
        arquivos.
      </p>
    ) : null

  /** Tela 1, igual na página inicial e em /?view=tool: só a área de upload. */
  const areaDeUpload = (
    <>
      <DropZone onFiles={onFiles} variant="hero" title="Selecionar arquivos PDF" />
      {destinoHerdado}
      {notice && <div className="note warn spaced">{notice}</div>}
      {jobs.length > 0 && (
        <p className="hint resume">
          Você tem {jobs.length} arquivo{jobs.length === 1 ? '' : 's'} no lote.{' '}
          <a href="/?view=tool" data-open-tool="retomar">
            Voltar ao lote
          </a>
        </p>
      )}
      {trustLine}
      <Stepper phase={phase} compact />
      {engineStatus(true)}
    </>
  )

  if (view === 'home') {
    return (
      <div className="tool landing" data-phase={phase}>
        {liveRegion}
        {areaDeUpload}
      </div>
    )
  }

  const TITULO: Record<Phase, string> = {
    config: 'Selecione os PDFs para protocolo',
    review: 'Agora escolha o destino do protocolo',
    processing: 'Preparando seus arquivos',
    result: 'Tudo pronto para baixar',
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
        <h1>{TITULO[phase]}</h1>
      </div>

      {jobs.length === 0 ? (
        <div className="tool-vazia">{areaDeUpload}</div>
      ) : (
        <>
          <Stepper phase={phase} />
          <section className="card main" aria-labelledby="h-batch">
              <div className="jobs-header">
                <h2 id="h-batch">{phase === 'result' ? 'Resultado' : phase === 'processing' ? 'Preparando…' : 'Arquivos selecionados'}</h2>
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
              {phase === 'result' && (
                <p className="hint">
                  Confira cada PDF antes de protocolar. O ZIP vem com os arquivos numerados na ordem do lote (01_, 02_…), sem acentos nem espaços,
                  documentos divididos em pasta própria{process.totalPetitionBytes !== undefined ? ', pastas por petição quando a soma passa do permitido' : ''} e um
                  LEIA-ME.txt com o resumo
                  {zipExcluded > 0 ? `; ${zipExcluded === 1 ? 'fica de fora o arquivo' : `ficam de fora os ${zipExcluded} arquivos`} com erro, com aviso ou fora da meta atual (listados no LEIA-ME)` : ''}.
                </p>
              )}

              <BatchList jobs={jobs} process={process} onRemove={remove} onRetry={retry} onAllow={allow} onMove={phase === 'review' && jobs.length > 1 ? mover : undefined} />
              <DropZone onFiles={onFiles} variant="compact" />
          </section>

          {/*
            * Etapa 2: o destino só aparece depois de existir arquivo. Durante o processamento ele sai
            * de cena (não há o que ajustar); no resultado volta, para trocar de tribunal e reprocessar.
            */}
          {phase !== 'processing' && (
            <section className="card destino" aria-labelledby="h-destino">
              <h2 id="h-destino">Destino do protocolo</h2>
              <RuleSelector settings={settings} onChange={setSettings} onValidity={setLimitValid} compact label="Tribunal e sistema" />

              {phase === 'review' && juntaveis > 1 && (
                <div className="juntar">
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={settings.merge}
                      data-testid="juntar"
                      onChange={(e) => {
                        track('opcao_alterada', { tipo: 'juntar', situacao: e.target.checked ? 'ligado' : 'desligado' })
                        setSettings({ ...settings, merge: e.target.checked })
                      }}
                    />
                    <span>
                      <span className="t-label">Juntar tudo em um único PDF</span>
                      <br />
                      <span className="t-hint">
                        {juntaveis} documentos viram um arquivo só, na ordem da lista. Útil quando o sistema limita a quantidade de anexos.
                      </span>
                    </span>
                  </label>
                  {settings.merge && (
                    <p className="hint aviso-juntar" data-testid="aviso-juntar">
                      A <strong>ordem da lista acima</strong> é a ordem do arquivo final — use as setas para ajustar.
                      {foraDaJuncao > 0 && (
                        <>
                          {' '}
                          {foraDaJuncao === 1 ? '1 documento fica' : `${foraDaJuncao} documentos ficam`} de fora e {foraDaJuncao === 1 ? 'continua' : 'continuam'} separado
                          {foraDaJuncao === 1 ? '' : 's'}
                          {assinadosForaDaJuncao > 0
                            ? ': juntar copia as páginas para um arquivo novo, e a assinatura digital não sobrevive a isso.'
                            : ' (documento com senha ou ilegível).'}
                        </>
                      )}
                    </p>
                  )}
                </div>
              )}

              <details className="avancadas">
                <summary>Opções avançadas</summary>
                <div className="avancadas-corpo">
                  <Options settings={settings} onChange={setSettings} />
                  {engineStatus()}
                </div>
              </details>

              {phase === 'review' && (
                <div className="destino-cta">
                  {counts.analyzing > 0 ? (
                    <button className="btn block" disabled data-testid="start">
                      Analisando…
                    </button>
                  ) : toPrepare > 0 || vaiJuntar ? (
                    <button
                      className="btn block"
                      onClick={() => void preparar()}
                      disabled={!limitValid || juntando}
                      title={limitValid ? undefined : 'Corrija o limite informado'}
                      data-testid="start"
                    >
                      {juntando ? 'Juntando…' : 'Preparar PDFs'}
                    </button>
                  ) : (
                    <>
                      {/*
                        * Nada a comprimir não é beco sem saída: os arquivos que já cabem seguem
                        * valendo como lote, com os nomes padronizados e o LEIA-ME. Sem isto a pessoa
                        * escolhia os arquivos e ficava sem nenhuma ação possível nesta tela.
                        */}
                      {zipCount > 0 && (
                        <button className="btn block" onClick={collectZip} disabled={zipping} data-testid="download-all">
                          {zipping ? 'Montando o pacote…' : `Baixar lote em ZIP (${zipCount})`}
                        </button>
                      )}
                      <span className="hint" data-testid="nothing-to-prepare">
                        {counts.blocked > 0
                          ? `Nada a comprimir: veja os avisos acima.${zipCount > 0 ? ' Os demais já estão prontos para baixar.' : ''}`
                          : 'Todos os arquivos já cabem na meta — nada a comprimir. Baixe o lote pronto acima.'}
                      </span>
                    </>
                  )}
                  {counts.analyzing === 0 && toPrepare > 0 && (
                    <p className="hint">
                      {toPrepare} arquivo{toPrepare === 1 ? '' : 's'} {toPrepare === 1 ? 'entra' : 'entram'} no lote
                      {counts.stale > 0 ? ' (inclusive os que foram preparados para outra meta)' : ''}. Os que já cabem ficam como estão.
                    </p>
                  )}
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  )
}
