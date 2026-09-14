import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import sitemap from '@astrojs/sitemap'
import { SITE } from './src/config/site.mjs'

// Medição do Google (GA4 / Tag Manager): só entra na CSP quando o build recebe um identificador.
// Sem eles o site não fala com nenhum domínio de fora — ver src/scripts/ga.ts.
const USA_GOOGLE = Boolean((process.env.PUBLIC_GA4_ID ?? '').trim() || (process.env.PUBLIC_GTM_ID ?? '').trim())
const GOOGLE_TAG = 'https://www.googletagmanager.com'
const GOOGLE_CONNECT = USA_GOOGLE ? ` ${GOOGLE_TAG} https://*.google-analytics.com https://*.analytics.google.com` : ''
const GOOGLE_IMG = USA_GOOGLE ? ` ${GOOGLE_TAG} https://*.google-analytics.com` : ''

export default defineConfig({
  site: SITE.url,
  // O painel interno é noindex e fica fora do sitemap.
  integrations: [react(), sitemap({ filter: (page) => !page.includes('/painel') })],
  build: {
    inlineStylesheets: 'auto',
  },
  // CSP gerada pelo Astro (meta http-equiv) com hashes dos scripts/estilos inline que ele mesmo emite.
  // Sem 'unsafe-eval' (o glue do Ghostscript é empacotado como módulo do worker); WASM exige 'wasm-unsafe-eval'.
  // frame-ancestors não funciona em meta: fica no X-Frame-Options dos cabeçalhos (public/_headers, vercel.json).
  security: {
    csp: {
      algorithm: 'SHA-256',
      directives: [
        "default-src 'self'",
        "worker-src 'self'",
        `connect-src 'self'${GOOGLE_CONNECT}`,
        `img-src 'self' data:${GOOGLE_IMG}`,
        "font-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        'upgrade-insecure-requests',
      ],
      scriptDirective: { resources: ["'self'", "'wasm-unsafe-eval'", ...(USA_GOOGLE ? [GOOGLE_TAG] : [])] },
      styleDirective: { resources: ["'self'"] },
    },
  },
  vite: {
    worker: { format: 'es' },
    build: { chunkSizeWarningLimit: 1500 },
  },
})
