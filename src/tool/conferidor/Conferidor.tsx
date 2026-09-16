import { useCallback, useEffect, useRef, useState } from 'react'
import { DropZone, type OrigemArquivos } from '../components/DropZone'
import { track, sizeBucket } from '../lib/analytics'
import { formatBytes } from '../lib/format'
import type { Conferencia, EstadoAssinatura } from '../lib/assinatura'
// A área de upload é o mesmo componente da bancada, e as regras dele moram no tool.css.
import '../tool.css'
import './conferidor.css'

/*
 * Conferidor de assinaturas: arrasta o PDF, descobre se a assinatura ainda confere.
 *
 * Ilha separada da bancada de compressão de propósito. Duas razões, e as duas importam:
 *
 * 1. É outra interação. A bancada é uma fila com configuração, progresso e download; aqui o
 *    usuário faz UMA pergunta e quer UMA resposta. Enfiar isto na fila existente transformaria
 *    uma resposta de meio segundo num fluxo de quatro etapas.
 * 2. É outro custo. O leitor de assinatura pesa 81 KB comprimido, e quem só quer comprimir um
 *    PDF não deveria pagar por ele. Por isso o módulo entra por import() dinâmico, quando o
 *    primeiro arquivo chega — não no carregamento da página.
 */

type Situacao = { arquivo: string; tamanho: number; resultado?: Conferencia; erro?: string; ms?: number }

/** Aparência de cada estado. A cor tem função: só três desfechos exigem ação diferente. */
const APARENCIA: Record<EstadoAssinatura, { rotulo: string; classe: string; icone: 'ok' | 'x' | '?' | '-' }> = {
  conferida: { rotulo: 'A assinatura confere', classe: 'ok', icone: 'ok' },
  quebrada: { rotulo: 'O documento foi alterado depois de assinado', classe: 'ruim', icone: 'x' },
  sem_assinatura: { rotulo: 'Nenhuma assinatura eletrônica no arquivo', classe: 'neutro', icone: '-' },
  indeterminada: { rotulo: 'Não foi possível concluir a conferência', classe: 'atencao', icone: '?' },
  nao_suportada: { rotulo: 'Formato de assinatura que ainda não lemos', classe: 'atencao', icone: '?' },
}

function Marca({ tipo }: { tipo: 'ok' | 'x' | '?' | '-' }) {
  const comum = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }
  if (tipo === 'ok') return <svg {...comum}><path d="m20 6-11 11-5-5" /></svg>
  if (tipo === 'x') return <svg {...comum}><path d="M18 6 6 18M6 6l12 12" /></svg>
  if (tipo === '?') return <svg {...comum}><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></svg>
  return <svg {...comum}><path d="M5 12h14" /></svg>
}

/** Só PDFs: outro formato não tem ByteRange e a resposta seria enganosa. */
const ehPdf = (f: File) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name)

export default function Conferidor() {
  const [itens, setItens] = useState<Situacao[]>([])
  const [ocupado, setOcupado] = useState(false)
  const [naoPdf, setNaoPdf] = useState(0)
  const vivo = useRef(true)
  useEffect(() => () => { vivo.current = false }, [])

  const receber = useCallback(async (arquivos: File[], origem: OrigemArquivos) => {
    const pdfs = arquivos.filter(ehPdf)
    setNaoPdf(arquivos.length - pdfs.length)
    if (pdfs.length === 0) return

    setOcupado(true)
    track('arquivo_adicionado', { origem, quantidade: pdfs.length, categoria: 'conferidor' })

    /*
     * A carga do leitor acontece aqui, e não no topo do arquivo: quem abre a página e não confere
     * nada nunca baixa os 81 KB. Se falhar (rede caiu no meio), o erro é de carga, não de
     * documento — e a mensagem precisa dizer isso, senão vira um falso "documento com problema".
     */
    let conferir: (b: Uint8Array) => Promise<Conferencia>
    try {
      conferir = (await import('../lib/assinatura')).conferirAssinatura
    } catch {
      if (!vivo.current) return
      setItens(pdfs.map((f) => ({ arquivo: f.name, tamanho: f.size, erro: 'Não foi possível carregar o leitor de assinaturas. Verifique a conexão e tente de novo.' })))
      setOcupado(false)
      track('erro', { categoria: 'conferidor', situacao: 'carga' })
      return
    }

    const saida: Situacao[] = []
    for (const f of pdfs) {
      const t0 = performance.now()
      try {
        const resultado = await conferir(new Uint8Array(await f.arrayBuffer()))
        const ms = Math.round(performance.now() - t0)
        saida.push({ arquivo: f.name, tamanho: f.size, resultado, ms })
        track('assinatura_conferida', {
          situacao: resultado.estado,
          faixa: sizeBucket(f.size),
          tipo: resultado.politica?.sigla ?? 'sem',
          quantidade: resultado.quantidade ?? 0,
          segundos: Math.round(ms / 1000),
        })
      } catch {
        saida.push({ arquivo: f.name, tamanho: f.size, erro: 'Não foi possível ler este arquivo. Ele pode estar corrompido ou não ser um PDF.' })
        track('erro', { categoria: 'conferidor', situacao: 'leitura' })
      }
      if (!vivo.current) return
      setItens([...saida])
    }
    setOcupado(false)
  }, [])

  const limpar = useCallback(() => { setItens([]); setNaoPdf(0) }, [])

  return (
    <div className="conferidor">
      {itens.length === 0 ? (
        <>
          <DropZone
            onFiles={receber}
            disabled={ocupado}
            title="Selecionar PDF assinado"
            big="ou arraste o PDF aqui"
            small="Pode soltar vários de uma vez."
          />
          {/* Sem linha de "nada é enviado" aqui: o selo de sigilo logo abaixo já diz isso, e repetir
              a mesma promessa duas vezes na mesma dobra a enfraquece. */}
          {ocupado && <p className="conf-dica" role="status">Conferindo…</p>}
          {naoPdf > 0 && (
            <p className="conf-erro-linha" role="status">
              {naoPdf === 1 ? 'Um arquivo foi ignorado por não ser PDF.' : `${naoPdf} arquivos foram ignorados por não serem PDF.`}
            </p>
          )}
        </>
      ) : (
        <>
          <div className="conf-topo">
            <h2>{itens.length === 1 ? 'Resultado da conferência' : `Resultado de ${itens.length} documentos`}</h2>
            <button type="button" className="conf-limpar" onClick={limpar}>Conferir outro</button>
          </div>
          <ul className="conf-lista">
            {itens.map((it, i) => <li key={`${it.arquivo}-${i}`}><Cartao item={it} /></li>)}
          </ul>
          {ocupado && <p className="conf-dica" role="status">Conferindo os demais…</p>}
          <DropZone onFiles={receber} disabled={ocupado} variant="compact" big="Conferir outro documento" />
        </>
      )}
    </div>
  )
}

function Cartao({ item }: { item: Situacao }) {
  if (item.erro) {
    return (
      <article className="conf-cartao atencao">
        <header><span className="conf-marca" aria-hidden="true"><Marca tipo="?" /></span>
          <div><h3>Não deu para conferir este arquivo</h3><p className="conf-arquivo">{item.arquivo} · {formatBytes(item.tamanho)}</p></div>
        </header>
        <p className="conf-motivo">{item.erro}</p>
      </article>
    )
  }
  const r = item.resultado!
  const ap = APARENCIA[r.estado]

  return (
    <article className={`conf-cartao ${ap.classe}`} data-estado={r.estado}>
      <header>
        <span className="conf-marca" aria-hidden="true"><Marca tipo={ap.icone} /></span>
        <div>
          <h3>{ap.rotulo}</h3>
          <p className="conf-arquivo">{item.arquivo} · {formatBytes(item.tamanho)}{item.ms !== undefined && ` · conferido em ${item.ms} ms`}</p>
        </div>
      </header>

      <p className="conf-acao">{r.orientacao}</p>
      {r.motivo && <p className="conf-motivo">{r.motivo}</p>}

      {/*
        Bytes escritos depois do trecho assinado. A assinatura pode continuar conferindo — ela
        cobre o que cobria — e ainda assim o documento não ser mais só aquilo que foi assinado.
        Silenciar isso seria dar um "confere" que esconde uma página anexada depois.
      */}
      {!!r.acrescentadoDepois && (
        <p className="conf-alerta">
          <strong>Há {formatBytes(r.acrescentadoDepois)} escritos depois do trecho assinado.</strong> A assinatura cobre o que cobria, mas alguma
          coisa foi acrescentada ao arquivo em seguida — página, anotação ou carimbo. Confira se é o que você espera.
        </p>
      )}

      {/*
        Certificado autoassinado é o caso em que "a integridade confere" mais engana: o arquivo está
        intacto, e mesmo assim ninguém emitiu aquele certificado. Acontece com assinador caseiro e
        com documento forjado. Precisa aparecer no mesmo bloco do veredito, não escondido nos
        detalhes — e precisa aparecer mesmo quando o desfecho é positivo.
      */}
      {r.signatarios.some((s) => s.autoassinado) && (
        <p className="conf-alerta">
          <strong>Este certificado assina a si mesmo.</strong> Nenhuma autoridade certificadora o emitiu, então ele não é um certificado
          ICP-Brasil — qualquer pessoa consegue gerar um assim. A integridade do arquivo é uma coisa; quem assinou é outra.
        </p>
      )}

      {r.signatarios.length > 0 && (
        <div className="conf-detalhes">
          <h4>{r.signatarios.length === 1 ? 'Certificado da assinatura' : 'Certificados na assinatura'}</h4>
          <ul className="conf-signatarios">
            {r.signatarios.map((s, i) => (
              <li key={i}>
                <span className="conf-nome">{s.nome}</span>
                <span className="conf-meta">
                  {s.autoassinado ? 'assina a si mesmo' : `emitido por ${s.emissor}`} · vale de {s.validoDe} a {s.validoAte}
                </span>
              </li>
            ))}
          </ul>
          <dl className="conf-fatos">
            {r.quantidade !== undefined && r.quantidade > 1 && (
              <div><dt>Assinaturas no arquivo</dt><dd>{r.quantidade} (a conferência acima é da mais recente)</dd></div>
            )}
            {r.politica ? (
              <div>
                <dt>Política declarada</dt>
                <dd>
                  <strong>{r.politica.sigla}</strong> — {r.politica.nome}
                  {!r.politica.aprovada && <span className="conf-aviso-inline"> (não consta na lista da ICP-Brasil)</span>}
                  <span className="conf-meta">{r.politica.exige}</span>
                </dd>
              </div>
            ) : (
              <div><dt>Política declarada</dt><dd>Nenhuma<span className="conf-meta">Comum, e não é defeito: nem toda assinatura declara política.</span></dd></div>
            )}
          </dl>
        </div>
      )}

      {/*
        O limite da ferramenta fica junto do resultado, não escondido num rodapé. Quem acabou de
        ler "a assinatura confere" é exatamente quem precisa saber o que essa frase não abrange.
      */}
      <details className="conf-limite">
        <summary>O que esta conferência {r.estado === 'conferida' ? 'não' : 'ainda não'} verifica</summary>
        <p>
          Conferimos a <strong>integridade</strong>: se o conteúdo assinado mudou. Não verificamos a cadeia do certificado até as raízes da
          ICP-Brasil, nem revogação, nem carimbo do tempo. Para um parecer completo, use o{' '}
          <a href="https://validar.iti.gov.br/" rel="noreferrer noopener nofollow" target="_blank">validador oficial do ITI</a>.
        </p>
        <p>
          Nunca dizemos “assinatura válida”: validade jurídica é decisão do juízo, não de uma ferramenta. Dizemos o que dá para medir.
        </p>
      </details>

      {r.estado === 'quebrada' && (
        <p className="conf-saida">
          A causa mais comum é ter comprimido, dividido ou juntado o arquivo depois de assinar.{' '}
          <a href="/guias/por-que-comprimir-antes-de-assinar-digitalmente/">Entenda a ordem certa</a> para não repetir.
        </p>
      )}
      {r.estado === 'conferida' && (
        <p className="conf-saida">
          Este arquivo não pode ser comprimido nem dividido sem perder a assinatura. Se ele não couber no limite do tribunal,{' '}
          <a href="/guias/por-que-comprimir-antes-de-assinar-digitalmente/">prepare o PDF antes de assinar</a>.
        </p>
      )}
      {r.estado === 'sem_assinatura' && (
        <p className="conf-saida">
          Se o documento deveria estar assinado, o original é que vale — impressão e digitalização apagam a assinatura.{' '}
          <a href="/guias/assinatura-eletronica-e-assinatura-digital-a-diferenca/">Diferença entre assinatura eletrônica e digital</a>.
        </p>
      )}
    </article>
  )
}
