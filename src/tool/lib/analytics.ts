/**
 * Medição de uso SEM dados de documentos (spec RF16 / §14).
 * Nunca envie nome de arquivo, conteúdo, número de processo ou texto extraído.
 * Por padrão não há provedor: os eventos só aparecem no console em desenvolvimento.
 * Para ativar um provedor, defina window.__analytics = (evento, props) => {...}
 * em um script próprio (ex.: Cloudflare Web Analytics não precisa de eventos).
 */
export type EventName =
  | 'lote_iniciado'
  | 'lote_concluido'
  | 'arquivo_resultado'
  | 'download'
  | 'regra_selecionada'
  | 'erro'

export type EventProps = Record<string, string | number | boolean>

declare global {
  interface Window {
    __analytics?: (event: EventName, props?: EventProps) => void
  }
}

const FORBIDDEN_KEYS = /nome|name|arquivo|file|processo|texto|text|conteudo|content/i

export function track(event: EventName, props: EventProps = {}) {
  // Defesa em profundidade: nenhuma chave que sugira dado de documento passa.
  const safe: EventProps = {}
  for (const [k, v] of Object.entries(props)) {
    if (FORBIDDEN_KEYS.test(k)) continue
    if (typeof v === 'string' && v.length > 40) continue
    safe[k] = v
  }
  try {
    if (typeof window !== 'undefined' && typeof window.__analytics === 'function') window.__analytics(event, safe)
    else if (import.meta.env.DEV) console.debug('[analytics]', event, safe)
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
