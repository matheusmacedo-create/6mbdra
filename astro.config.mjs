import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import sitemap from '@astrojs/sitemap'
import { SITE } from './src/config/site.mjs'

export default defineConfig({
  site: SITE.url,
  integrations: [react(), sitemap()],
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
        "connect-src 'self'",
        "img-src 'self' data:",
        "font-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        'upgrade-insecure-requests',
      ],
      scriptDirective: { resources: ["'self'", "'wasm-unsafe-eval'"] },
      styleDirective: { resources: ["'self'"] },
    },
  },
  vite: {
    worker: { format: 'es' },
    build: { chunkSizeWarningLimit: 1500 },
  },
})
