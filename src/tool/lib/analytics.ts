/**
 * Medição de uso SEM dados de documentos (spec RF16 / §14).
 * Nunca envie nome de arquivo, conteúdo, número de processo ou texto extraído.
 *
 * O provedor é injetado em window.__analytics (ver src/scripts/metricas.ts, que envia os eventos
 * para /api/e). Enquanto ele não carrega, os eventos ficam numa fila curta em window.__filaMetricas
 * e são drenados assim que o provedor aparece — assim nada se perde entre o primeiro render da
 * ilha React e o carregamento do script de medição.
 */
/**
 * Funil completo, do primeiro acesso ao download. A ordem abaixo é a ordem em que os eventos
 * costumam acontecer — mantenha-a assim para o painel e o GA4 lerem o funil na mesma sequência.
 */
export type EventName =
  // 1. chegada
  | 'acesso' // abriu uma página
  | 'tempo_pagina' // saiu da página (com quantos segundos de uso)
  | 'link_externo' // clicou num link para fora (página oficial de tribunal, por exemplo)
  | 'faq_aberto' // abriu uma pergunta frequente
  // 2. entrou na ferramenta
  | 'abriu_ferramenta'
  | 'voltou_inicio'
  | 'motor' // estado do Ghostscript em WebAssembly (carregando / pronto / falhou)
  | 'regra_selecionada' // escolheu tribunal e sistema (ou um limite manual)
  | 'opcao_alterada' // ligou/desligou tons de cinza, divisão automática…
  // 3. trouxe arquivos
  | 'arquivo_adicionado'
  | 'arquivo_analisado'
  | 'arquivo_removido'
  | 'liberar_arquivo' // liberou um PDF assinado ou com restrições
  // 4. processou
  | 'lote_iniciado'
  | 'lote_cancelado'
  | 'lote_concluido'
  | 'arquivo_resultado'
  | 'tentar_novamente'
  | 'erro'
  // 5. levou embora
  | 'zip_gerado'
  | 'download'

export type EventProps = Record<string, string | number | boolean>

declare global {
  interface Window {
    __analytics?: (event: EventName, props?: EventProps) => void
    __filaMetricas?: Array<[EventName, EventProps]>
  }
}

/** Fila de espera: curta de propósito, para não segurar memória se o provedor nunca chegar. */
const FILA_MAX = 30

// Chaves que sugerem dado de documento. Contagens ('quantidade', 'partes') passam.
const FORBIDDEN_KEYS = /nome|name|filename|file$|files$|path|processo|texto|text|conteudo|content|hash/i

export function track(event: EventName, props: EventProps = {}) {
  // Defesa em profundidade: nenhuma chave que sugira dado de documento passa.
  const safe: EventProps = {}
  for (const [k, v] of Object.entries(props)) {
    if (FORBIDDEN_KEYS.test(k)) continue
    if (typeof v === 'string' && v.length > 40) continue
    safe[k] = v
  }
  try {
    if (typeof window === 'undefined') return
    if (typeof window.__analytics === 'function') {
      window.__analytics(event, safe)
      return
    }
    const fila = (window.__filaMetricas ??= [])
    if (fila.length < FILA_MAX) fila.push([event, safe])
    if (import.meta.env.DEV) console.debug('[analytics]', event, safe)
  } catch {
    // medição nunca pode quebrar a ferramenta
  }
}

/** Faixa de tamanho para métricas agregadas (sem revelar o tamanho exato). */
export function sizeBucket(bytes: number): string {
  const mb = bytes / 1_000_000
  if (mb < 5) return '<5MB'
  if (mb < 20) return '5-20MB'
  if (mb < 50) return '20-50MB'
  if (mb < 150) return '50-150MB'
  return '>150MB'
}
