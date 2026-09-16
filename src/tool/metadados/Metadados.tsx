import { useCallback, useEffect, useRef, useState } from 'react'
import { DropZone, type OrigemArquivos } from '../components/DropZone'
import { track, sizeBucket } from '../lib/analytics'
import { formatBytes } from '../lib/format'
import type { Metadados as Dados } from '../lib/metadados'
import '../tool.css'
import './metadados.css'

/*
 * "O que este PDF conta" — leitor de metadados.
 *
 * Ilha separada e MUITO mais leve que o verificador de assinaturas: aqui não entra ASN.1 nenhum,
 * só leitura de texto. O cruzamento com a assinatura é aritmética sobre o /ByteRange, então esta
 * ferramenta responde sem baixar os 400 KB do outro pedaço.
 *
 * A ferramenta aponta nos dois sentidos, e isso é decisão de produto, não enfeite: o mesmo dado que
 * revela o autor do PDF que você recebeu revela o SEU quando você protocola. A metade que avisa
 * sobre o próprio arquivo é a mais útil, e a única honesta de destacar.
 */

type Item = { arquivo: string; tamanho: number; dados?: Dados; erro?: string }

const ehPdf = (f: File) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name)

/** Data ISO -> "15 de setembro de 2026, 12:00". Sem inventar precisão que a data não tem. */
function quando(iso?: string): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const temHora = !/T00:00:00(?:Z|[+-]00:00)$/.test(iso)
  return d.toLocaleDateString('pt-BR', {
    day: 'numeric', month: 'long', year: 'numeric',
    ...(temHora ? { hour: '2-digit', minute: '2-digit' } : {}),
  })
}

function Icone({ tipo }: { tipo: 'relogio' | 'pessoa' | 'app' | 'camadas' | 'selo' }) {
  const c = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }
  if (tipo === 'relogio') return <svg {...c}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
  if (tipo === 'pessoa') return <svg {...c}><circle cx="12" cy="8" r="4" /><path d="M5 20a7 7 0 0 1 14 0" /></svg>
  if (tipo === 'app') return <svg {...c}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18" /></svg>
  if (tipo === 'camadas') return <svg {...c}><path d="M12 3 3 8l9 5 9-5z" /><path d="m3 14 9 5 9-5" /></svg>
  return <svg {...c}><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
}

export default function Metadados() {
  const [itens, setItens] = useState<Item[]>([])
  const [ocupado, setOcupado] = useState(false)
  const [naoPdf, setNaoPdf] = useState(0)
  const vivo = useRef(true)
  useEffect(() => () => { vivo.current = false }, [])

  const receber = useCallback(async (arquivos: File[], origem: OrigemArquivos) => {
    const pdfs = arquivos.filter(ehPdf)
    setNaoPdf(arquivos.length - pdfs.length)
    if (pdfs.length === 0) return
    setOcupado(true)
    track('arquivo_adicionado', { origem, quantidade: pdfs.length, categoria: 'metadados' })

    let ler: (b: Uint8Array) => Dados
    try {
      ler = (await import('../lib/metadados')).lerMetadados
    } catch {
      if (!vivo.current) return
      setItens(pdfs.map((f) => ({ arquivo: f.name, tamanho: f.size, erro: 'Não foi possível carregar o leitor. Verifique a conexão e tente de novo.' })))
      setOcupado(false)
      return
    }

    const saida: Item[] = []
    for (const f of pdfs) {
      try {
        const dados = ler(new Uint8Array(await f.arrayBuffer()))
        saida.push({ arquivo: f.name, tamanho: f.size, dados })
        track('metadados_lidos', {
          faixa: sizeBucket(f.size),
          situacao: dados.vazio ? 'sem_metadados' : 'com_metadados',
          quantidade: dados.revisoes.length,
          tipo: dados.temAssinatura ? 'assinado' : 'simples',
        })
      } catch {
        saida.push({ arquivo: f.name, tamanho: f.size, erro: 'Não foi possível ler este arquivo. Ele pode estar corrompido ou não ser um PDF.' })
        track('erro', { categoria: 'metadados', situacao: 'leitura' })
      }
      if (!vivo.current) return
      setItens([...saida])
    }
    setOcupado(false)
  }, [])

  return (
    <div className="metadados">
      {itens.length === 0 ? (
        <>
          <DropZone onFiles={receber} disabled={ocupado} title="Selecionar PDF" big="ou arraste o PDF aqui" small="Pode soltar vários de uma vez." />
          {ocupado && <p className="md-dica" role="status">Lendo…</p>}
          {naoPdf > 0 && <p className="md-erro-linha" role="status">{naoPdf === 1 ? 'Um arquivo foi ignorado por não ser PDF.' : `${naoPdf} arquivos foram ignorados por não serem PDF.`}</p>}
        </>
      ) : (
        <>
          <div className="md-topo">
            <h2>{itens.length === 1 ? 'O que este arquivo conta' : `O que estes ${itens.length} arquivos contam`}</h2>
            <button type="button" className="conf-limpar" onClick={() => { setItens([]); setNaoPdf(0) }}>Ler outro</button>
          </div>
          <ul className="md-lista">{itens.map((it, i) => <li key={`${it.arquivo}-${i}`}><Cartao item={it} /></li>)}</ul>
          {ocupado && <p className="md-dica" role="status">Lendo os demais…</p>}
          <DropZone onFiles={receber} disabled={ocupado} variant="compact" big="Ler outro documento" />
        </>
      )}
    </div>
  )
}

function Cartao({ item }: { item: Item }) {
  if (item.erro) {
    return (
      <article className="md-cartao">
        <header><h3>Não deu para ler este arquivo</h3><p className="md-arquivo">{item.arquivo} · {formatBytes(item.tamanho)}</p></header>
        <p className="conf-motivo">{item.erro}</p>
      </article>
    )
  }
  const d = item.dados!
  const alterado = quando(d.alteradoEm) ?? quando(d.xmpAlteradoEm)
  const criado = quando(d.criadoEm) ?? quando(d.xmpCriadoEm)

  return (
    <article className="md-cartao">
      <header>
        <h3>{item.arquivo}</h3>
        <p className="md-arquivo">{formatBytes(item.tamanho)}{d.versaoPdf && ` · PDF ${d.versaoPdf}`}{d.temAssinatura && ' · assinado'}</p>
      </header>

      {d.vazio ? (
        /*
         * Arquivo limpo é boa notícia para quem ENVIA, e a tela precisa dizer isso — senão o
         * usuário lê "nada encontrado" como falha da ferramenta.
         */
        <p className="md-vazio">
          <strong>Este PDF não guarda nenhum dado de identificação.</strong> Sem autor, sem datas, sem nome de programa. Para quem envia um
          documento, é exatamente o estado desejável.
        </p>
      ) : (
        <dl className="md-fatos">
          <div className={alterado ? 'destaque' : ''}>
            <dt><Icone tipo="relogio" />Última alteração</dt>
            <dd>{alterado ?? <span className="md-ausente">não declarada no arquivo</span>}</dd>
          </div>
          <div>
            <dt><Icone tipo="relogio" />Criado em</dt>
            <dd>{criado ?? <span className="md-ausente">não declarada no arquivo</span>}</dd>
          </div>
          <div className={d.autor ? 'destaque' : ''}>
            <dt><Icone tipo="pessoa" />Autor declarado</dt>
            <dd>{d.autor ?? <span className="md-ausente">nenhum</span>}</dd>
          </div>
          <div>
            <dt><Icone tipo="app" />Programas</dt>
            <dd>
              {d.criadoPor || d.gravadoPor ? (
                <>
                  {d.criadoPor && <span>Criado com <strong>{d.criadoPor}</strong></span>}
                  {d.gravadoPor && <span>Gravado por <strong>{d.gravadoPor}</strong></span>}
                </>
              ) : <span className="md-ausente">nenhum declarado</span>}
            </dd>
          </div>
          {d.titulo && <div><dt><Icone tipo="app" />Título interno</dt><dd>{d.titulo}</dd></div>}
          {d.assunto && <div><dt><Icone tipo="app" />Assunto</dt><dd>{d.assunto}</dd></div>}
        </dl>
      )}

      {/*
        O cruzamento com a assinatura é o único dado aqui que não é declaração. Merece destaque
        próprio e linguagem diferente do resto: "prova", e não "consta".
      */}
      {d.temAssinatura && d.revisoesDepoisDaAssinatura > 0 && (
        <p className="md-prova">
          <Icone tipo="selo" />
          <span>
            <strong>Escreveram neste arquivo depois de ele ser assinado.</strong>{' '}
            {d.revisoesDepoisDaAssinatura === 1
              ? 'Há uma gravação posterior'
              : `São ${d.revisoesDepoisDaAssinatura} gravações posteriores`}{' '}
            ao trecho que a assinatura protege. Isto não depende de nenhuma data escrita no arquivo: é o alcance da própria assinatura.{' '}
            <a href="/conferir-assinatura/">Verifique a assinatura</a> para saber se ela ainda confere.
          </span>
        </p>
      )}

      {d.revisoes.length > 1 && (
        <div className="md-revisoes">
          <h4><Icone tipo="camadas" />Este arquivo foi salvo {d.revisoes.length} vezes</h4>
          <p className="md-nota">
            PDF permite gravar acrescentando ao fim, sem apagar o que já estava lá. Cada marca abaixo é uma dessas gravações.
          </p>
          <ol className="md-trilha">
            {d.revisoes.map((r) => (
              <li key={r.numero} className={r.depoisDaAssinatura ? 'depois' : ''}>
                <span className="md-rev-n">{r.numero}</span>
                <span>
                  {r.numero === 1 ? 'Versão original' : 'Gravação posterior'} · {formatBytes(r.bytes)}
                  {r.depoisDaAssinatura && <em> — depois da assinatura</em>}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {d.historico.length > 0 && (
        <div className="md-revisoes">
          <h4><Icone tipo="camadas" />Histórico de edição declarado</h4>
          <ol className="md-trilha">
            {d.historico.map((e, i) => (
              <li key={i}>
                <span className="md-rev-n">{i + 1}</span>
                <span>
                  <strong>{e.acao}</strong>
                  {e.quando && ` · ${quando(e.quando) ?? e.quando}`}
                  {e.programa && <span className="conf-meta">{e.programa}</span>}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <details className="conf-limite">
        <summary>O que estes dados valem, e o que não valem</summary>
        <p>
          Quase tudo acima é <strong>declaração</strong>, não prova. A data de alteração é o que o programa gravou, e qualquer editor muda.
          O autor é o que estava configurado na máquina de quem salvou — às vezes o nome de usuário do sistema, às vezes o nome de outra pessoa
          que abriu o arquivo por último. São pistas boas, e não fatos verificáveis.
        </p>
        <p>
          A única exceção é o aviso de gravação posterior à assinatura: ele não depende de nenhuma data escrita no arquivo, e sim de até onde a
          assinatura alcança.
        </p>
      </details>

      {!d.vazio && (
        <p className="conf-saida">
          <strong>Vale nos dois sentidos:</strong> tudo isto é o que o <em>seu</em> PDF conta a qualquer pessoa que o receba — incluindo a parte
          contrária. <a href="/guias/metadados-do-pdf-o-que-voce-esta-entregando-sem-saber/">Veja como limpar antes de protocolar</a>.
        </p>
      )}
    </article>
  )
}
