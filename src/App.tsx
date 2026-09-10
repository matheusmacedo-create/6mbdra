import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_SETTINGS, type Settings } from './lib/types'
import { useJobQueue, type EngineStatus } from './hooks/useJobQueue'
import { DropZone } from './components/DropZone'
import { SettingsPanel } from './components/SettingsPanel'
import { JobList } from './components/JobList'
import { Faq } from './components/Faq'
import { formatBytes } from './lib/format'

const STORAGE_KEY = '6mb:settings'

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<Settings>
    return { ...DEFAULT_SETTINGS, ...parsed }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings)
  const [engine, setEngine] = useState<EngineStatus>({ state: 'idle' })
  const [notice, setNotice] = useState<string | null>(null)
  const { jobs, addFiles, remove, retry, clearFinished } = useJobQueue(settings, setEngine)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    } catch {
      // armazenamento indisponível (modo privado etc.): ignora
    }
  }, [settings])

  const onFiles = useCallback(
    (files: File[]) => {
      const pdfs = files.filter((f) => /\.pdf$/i.test(f.name) || f.type === 'application/pdf')
      const ignored = files.length - pdfs.length
      const added = addFiles(pdfs)
      if (ignored > 0) setNotice(`${ignored} arquivo${ignored === 1 ? ' foi ignorado porque não é' : 's foram ignorados porque não são'} PDF.`)
      else if (added > 0) setNotice(null)
    },
    [addFiles],
  )

  // Aviso ao fechar a aba enquanto há trabalho em andamento.
  useEffect(() => {
    const busy = jobs.some((j) => j.status === 'analyzing' || j.status === 'compressing' || j.status === 'splitting' || j.status === 'queued')
    if (!busy) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [jobs])

  return (
    <main className="page">
      <header className="header">
        <div className="logo" aria-hidden="true">6MB</div>
        <div className="title">
          <h1>Compactador de PDF para o tribunal</h1>
          <p>Deixe cada PDF dentro do limite exigido pelo sistema do tribunal, em poucos cliques.</p>
        </div>
        <span className="privacy-pill" title="Nenhum arquivo é enviado para a internet">
          <span aria-hidden="true">🔒</span> Seus arquivos não saem do seu computador
        </span>
      </header>

      <section className="card">
        <h2>
          <span className="step">1</span>Escolha o limite do tribunal
        </h2>
        <SettingsPanel settings={settings} onChange={setSettings} />
      </section>

      <section className="card">
        <h2>
          <span className="step">2</span>Adicione os PDFs
        </h2>
        <DropZone onFiles={onFiles} />
        {notice && (
          <div className="note warn" style={{ marginTop: 12 }} role="status">
            {notice}
          </div>
        )}
        <div className="engine-status" style={{ marginTop: 12 }} data-testid="engine-status" data-state={engine.state}>
          <span className={`dot${engine.state === 'ready' ? ' ready' : engine.state === 'error' ? ' err' : ''}`} aria-hidden="true" />
          {engine.state === 'loading' && 'Preparando o motor de compressão (só na primeira vez, ~16 MB)…'}
          {engine.state === 'ready' && `Pronto para compactar até ${formatBytes(settings.limitBytes)} por arquivo.`}
          {engine.state === 'error' && `${engine.message ?? 'O motor principal não carregou.'} O modo de emergência continua disponível.`}
          {engine.state === 'idle' && 'Iniciando…'}
        </div>
      </section>

      <JobList jobs={jobs} limitBytes={settings.limitBytes} onRemove={remove} onRetry={retry} onClear={clearFinished} />

      <Faq />

      <footer className="footer">
        <p>
          Feito para advogadas e advogados que precisam protocolar sem dor de cabeça. Software livre: o motor de compressão é o{' '}
          <a href="https://www.ghostscript.com/" target="_blank" rel="noreferrer">Ghostscript</a> (licença AGPL), rodando em WebAssembly no seu navegador.
        </p>
        <p>Esta ferramenta não substitui a conferência do documento antes do protocolo. Abra o PDF gerado e verifique a legibilidade.</p>
      </footer>
    </main>
  )
}
