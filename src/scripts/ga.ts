/**
 * Google Analytics 4 / Google Tag Manager — opcional e desligado por padrão.
 *
 * Só entra em cena quando SITE.analytics traz identificador (src/config/site.mjs, com
 * PUBLIC_GA4_ID / PUBLIC_GTM_ID podendo sobrescrever no build):
 *   ga4: 'G-XXXXXXXXXX'  → carrega o gtag.js e envia os eventos direto para o GA4
 *   gtm: 'GTM-XXXXXXX'   → carrega o contêiner do Tag Manager e empurra tudo para o dataLayer
 * (com os dois definidos, o Tag Manager manda: configure o GA4 dentro do contêiner)
 *
 * Sem nenhum dos dois, nada do Google é baixado, nenhum cookie é criado e a CSP continua fechada —
 * o painel próprio em /painel/ segue funcionando sozinho.
 *
 * Como o Google usa cookies, tudo começa negado (Modo de Consentimento v2) E a tag só é baixada
 * depois que a pessoa aceita. Quem recusa — ou simplesmente ignora a faixa — não tem nenhum contato
 * com o Google: nem cookie, nem requisição. Isso custa os "pings sem cookie" do consent mode, mas
 * mantém de pé a promessa do site de não falar com ninguém de fora; a contagem completa de acessos
 * continua vindo do painel próprio, que não usa cookie e não depende de consentimento.
 *
 * Os eventos disparados antes do "aceitar" ficam na dataLayer: quando a tag carrega, ela processa
 * a fila e nada da sessão se perde.
 */
import type { EventName, EventProps } from '../tool/lib/analytics'
import { SITE } from '../config/site.mjs'

const GA4 = (SITE.analytics.ga4 ?? '').trim()
const GTM = (SITE.analytics.gtm ?? '').trim()

/** true quando o build recebeu algum identificador do Google. */
export const googleConfigurado = Boolean(GA4 || GTM)

declare global {
  interface Window {
    dataLayer?: unknown[]
  }
}

const CHAVE = 'brpdf.consentimento'
type Escolha = 'aceito' | 'recusado'

function lerEscolha(): Escolha | null {
  try {
    const v = localStorage.getItem(CHAVE)
    return v === 'aceito' || v === 'recusado' ? v : null
  } catch {
    return null
  }
}

function gravarEscolha(v: Escolha) {
  try {
    localStorage.setItem(CHAVE, v)
  } catch {
    // sem armazenamento: a faixa aparece de novo na próxima visita
  }
}

/** gtag.js lê o objeto `arguments`; um array comum não serve. */
function empurrarArgumentos(): void {
  ;(window.dataLayer ??= []).push(arguments)
}
const gtag = empurrarArgumentos as (...args: unknown[]) => void

const CONSENTIMENTOS = ['ad_storage', 'ad_user_data', 'ad_personalization', 'analytics_storage'] as const
const estado = (v: 'granted' | 'denied') => Object.fromEntries(CONSENTIMENTOS.map((k) => [k, v]))

function carregarScript(src: string) {
  const s = document.createElement('script')
  s.async = true
  s.src = src
  document.head.append(s)
}

/** Faixa de consentimento. Só existe quando há tag do Google: sem ela o site não usa cookie nenhum. */
function mostrarFaixa() {
  const faixa = document.createElement('div')
  faixa.className = 'consentimento'
  faixa.setAttribute('role', 'dialog')
  faixa.setAttribute('aria-label', 'Uso de cookies de medição')

  const texto = document.createElement('p')
  texto.textContent =
    'Usamos cookies de medição do Google para entender como a ferramenta é usada. Seus PDFs continuam no seu computador de qualquer forma — eles nunca são enviados para lugar nenhum.'

  const botoes = document.createElement('div')
  botoes.className = 'acoes'
  const recusar = document.createElement('button')
  recusar.type = 'button'
  recusar.className = 'btn small secondary'
  recusar.textContent = 'Recusar'
  const aceitar = document.createElement('button')
  aceitar.type = 'button'
  aceitar.className = 'btn small'
  aceitar.textContent = 'Aceitar'

  const decidir = (escolha: Escolha) => {
    gravarEscolha(escolha)
    gtag('consent', 'update', estado(escolha === 'aceito' ? 'granted' : 'denied'))
    // A tag só desce agora, e só com o sim. Ela processa a fila já acumulada na dataLayer.
    if (escolha === 'aceito') carregarTag()
    faixa.remove()
  }
  recusar.addEventListener('click', () => decidir('recusado'))
  aceitar.addEventListener('click', () => decidir('aceito'))

  const saibaMais = document.createElement('a')
  saibaMais.href = '/privacidade/'
  saibaMais.textContent = 'Saiba mais'

  botoes.append(saibaMais, recusar, aceitar)
  faixa.append(texto, botoes)
  document.body.append(faixa)
}

let pronto = false
let tagCarregada = false

/** Baixa a tag do Google. Só é chamada depois de um "aceitar" — nunca antes. */
function carregarTag() {
  if (tagCarregada) return
  tagCarregada = true
  if (GTM) {
    window.dataLayer?.push({ 'gtm.start': Date.now(), event: 'gtm.js' })
    carregarScript(`https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(GTM)}`)
  } else {
    carregarScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA4)}`)
    gtag('js', new Date())
    // O caminho já basta: nunca mandamos a query, que pode trazer ?regra=.
    gtag('config', GA4, { page_path: location.pathname, anonymize_ip: true })
  }
}

/** Prepara a dataLayer e mostra a faixa de consentimento na primeira visita. */
export function iniciarGoogle() {
  if (!googleConfigurado || pronto) return
  pronto = true

  // Só empurra objetos para a dataLayer: nenhuma rede acontece aqui.
  gtag('consent', 'default', { ...estado('denied'), wait_for_update: 500 })

  const escolha = lerEscolha()
  if (escolha === 'aceito') {
    gtag('consent', 'update', estado('granted'))
    carregarTag()
  } else if (!escolha) {
    mostrarFaixa()
  }
}

/**
 * Espelha um evento do brpdf no Google. O "acesso" fica de fora porque o próprio gtag/GTM já conta
 * a visualização de página — mandá-lo de novo contaria a mesma visita duas vezes.
 */
/** Teto da fila: se a pessoa nunca aceitar, a dataLayer não pode crescer para sempre. */
const FILA_MAX = 200

export function enviarParaGoogle(nome: EventName, props: EventProps) {
  if (!googleConfigurado || nome === 'acesso') return
  if (!tagCarregada && (window.dataLayer?.length ?? 0) >= FILA_MAX) return
  if (GTM) window.dataLayer?.push({ event: nome, ...props })
  else gtag('event', nome, props)
}
