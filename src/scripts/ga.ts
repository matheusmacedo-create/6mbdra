/**
 * Google Analytics 4 / Google Tag Manager — opcional e desligado por padrão.
 *
 * Só entra em cena quando o build recebe os identificadores:
 *   PUBLIC_GA4_ID=G-XXXXXXXXXX   → carrega o gtag.js e envia os eventos direto para o GA4
 *   PUBLIC_GTM_ID=GTM-XXXXXXX    → carrega o contêiner do Tag Manager e empurra tudo para o dataLayer
 * (com os dois definidos, o Tag Manager manda: configure o GA4 dentro do contêiner)
 *
 * Sem nenhum dos dois, nada do Google é baixado, nenhum cookie é criado e a CSP continua fechada —
 * o painel próprio em /painel/ segue funcionando sozinho.
 *
 * Como o Google usa cookies, aqui vale o Modo de Consentimento v2: tudo começa negado e só é
 * liberado se a pessoa aceitar na faixa de consentimento. Antes disso o GA4 recebe apenas pings
 * sem cookie. Quem recusa não recebe nenhum.
 */
import type { EventName, EventProps } from '../tool/lib/analytics'

const GA4 = (import.meta.env.PUBLIC_GA4_ID ?? '').trim()
const GTM = (import.meta.env.PUBLIC_GTM_ID ?? '').trim()

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

/** Carrega a tag do Google (se houver) e mostra a faixa de consentimento na primeira visita. */
export function iniciarGoogle() {
  if (!googleConfigurado || pronto) return
  pronto = true

  const escolha = lerEscolha()
  // Modo de Consentimento v2: nada é liberado antes de a pessoa dizer sim.
  gtag('consent', 'default', { ...estado('denied'), wait_for_update: 500 })
  if (escolha === 'aceito') gtag('consent', 'update', estado('granted'))

  if (GTM) {
    window.dataLayer?.push({ 'gtm.start': Date.now(), event: 'gtm.js' })
    carregarScript(`https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(GTM)}`)
  } else {
    carregarScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA4)}`)
    gtag('js', new Date())
    // O caminho já basta: nunca mandamos a query, que pode trazer ?regra=.
    gtag('config', GA4, { page_path: location.pathname, anonymize_ip: true })
  }

  if (!escolha) mostrarFaixa()
}

/**
 * Espelha um evento do brpdf no Google. O "acesso" fica de fora porque o próprio gtag/GTM já conta
 * a visualização de página — mandá-lo de novo contaria a mesma visita duas vezes.
 */
export function enviarParaGoogle(nome: EventName, props: EventProps) {
  if (!googleConfigurado || nome === 'acesso') return
  if (GTM) window.dataLayer?.push({ event: nome, ...props })
  else gtag('event', nome, props)
}
