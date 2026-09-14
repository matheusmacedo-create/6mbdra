/**
 * Envio das métricas de uso para /api/e (Worker + D1).
 *
 * O que sai daqui: nome do evento, caminho da página, origem do acesso e contagens/categorias já
 * agregadas pela ferramenta. O que NUNCA sai: nome de arquivo, conteúdo, número de processo, IP
 * (quem vê o IP é a borda da Cloudflare, que o transforma num hash diário e o descarta) e cookies.
 *
 * Respeita Do Not Track e Global Privacy Control: com qualquer um ligado, nada é enviado.
 */
import type { EventName, EventProps } from '../tool/lib/analytics'
import { enviarParaGoogle, iniciarGoogle } from './ga'

interface Evento {
  nome: EventName
  props: EventProps
}

const ENDERECO = '/api/e'
/** O Worker aceita no máximo 20 eventos por requisição. */
const LOTE_MAX = 20
/** Espera antes de mandar, para agrupar a rajada de eventos de um lote de arquivos. */
const ESPERA_MS = 4000

function medicaoRecusada(): boolean {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean; msDoNotTrack?: string }
  if (nav.doNotTrack === '1' || nav.globalPrivacyControl === true) return true
  // O painel interno não se mede.
  return location.pathname.startsWith('/painel')
}

/** De onde veio a visita: a campanha declarada na URL ou o domínio que apontou para cá. */
function origemDoAcesso(): string | undefined {
  const utm = new URLSearchParams(location.search).get('utm_source')
  if (utm) return utm.slice(0, 80)
  if (!document.referrer) return undefined
  try {
    const host = new URL(document.referrer).hostname
    return host && host !== location.hostname ? host : undefined
  } catch {
    return undefined
  }
}

/** Caminho sem query nem hash: é a página, não o que a pessoa digitou nela. */
function caminhoDaPagina(): string {
  return location.pathname.slice(0, 120) || '/'
}

const fila: Evento[] = []
let timer: ReturnType<typeof setTimeout> | undefined

function enviar() {
  if (timer !== undefined) {
    clearTimeout(timer)
    timer = undefined
  }
  while (fila.length) {
    const lote = fila.splice(0, LOTE_MAX)
    const corpo = JSON.stringify({ eventos: lote })
    try {
      const enviado = navigator.sendBeacon?.(ENDERECO, new Blob([corpo], { type: 'text/plain;charset=UTF-8' }))
      if (enviado) continue
    } catch {
      // cai no fetch abaixo
    }
    // keepalive para o envio sobreviver à navegação que fechou a página.
    void fetch(ENDERECO, { method: 'POST', body: corpo, keepalive: true, headers: { 'content-type': 'application/json' } }).catch(() => {})
  }
}

function registrar(nome: EventName, props: EventProps = {}) {
  // O mesmo evento vai para os dois lugares: o painel próprio e (se configurado) o GA4/GTM.
  enviarParaGoogle(nome, props)
  fila.push({ nome, props })
  // Fila cheia vai na hora; o resto espera para viajar junto.
  if (fila.length >= LOTE_MAX) enviar()
  else if (timer === undefined) timer = setTimeout(enviar, ESPERA_MS)
}

/** Cliques em links que levam para fora do site (páginas oficiais de tribunais, Ghostscript…). */
function ligarLinksExternos() {
  document.addEventListener(
    'click',
    (e) => {
      if (e.defaultPrevented || (e as MouseEvent).button !== 0) return
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!a) return
      let destino: URL
      try {
        destino = new URL(a.href, location.href)
      } catch {
        return
      }
      if (!/^https?:$/.test(destino.protocol) || destino.hostname === location.hostname) return
      registrar('link_externo', { origem: destino.hostname.slice(0, 80), caminho: caminhoDaPagina() })
    },
    // Fase de captura: o evento é contado mesmo se alguém chamar stopPropagation depois.
    true,
  )
}

/** Abertura de cada pergunta frequente — mostra qual dúvida aparece mais. */
function ligarPerguntas() {
  for (const d of document.querySelectorAll<HTMLDetailsElement>('details[data-faq]')) {
    d.addEventListener('toggle', () => {
      if (d.open) registrar('faq_aberto', { quantidade: Number(d.dataset.faq) || 0, caminho: caminhoDaPagina() })
    })
  }
}

/** Quanto tempo a página ficou aberta. Só conta uma vez, mesmo com idas e vindas ao bfcache. */
function ligarTempoDePagina() {
  let contado = false
  const contar = () => {
    if (contado) return
    contado = true
    registrar('tempo_pagina', { caminho: caminhoDaPagina(), segundos: Math.round(performance.now() / 1000) })
  }
  addEventListener('pagehide', contar)
  addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') contar()
  })
}

if (!medicaoRecusada()) {
  iniciarGoogle()
  window.__analytics = registrar
  // Eventos disparados antes deste script carregar (ilha React) estavam guardados na fila da lib.
  for (const [nome, props] of window.__filaMetricas ?? []) registrar(nome, props)
  window.__filaMetricas = []

  const origem = origemDoAcesso()
  registrar('acesso', { caminho: caminhoDaPagina(), ...(origem ? { origem } : {}) })

  ligarLinksExternos()
  ligarPerguntas()
  ligarTempoDePagina()

  // pagehide cobre o fechamento e o bfcache; visibilitychange cobre trocar de aba no celular.
  addEventListener('pagehide', enviar)
  addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') enviar()
  })
}
