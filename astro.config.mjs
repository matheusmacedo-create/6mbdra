import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import sitemap from '@astrojs/sitemap'
import { SITE } from './src/config/site.mjs'
import regras from './src/data/regras.json' with { type: 'json' }
import { readdirSync, readFileSync } from 'node:fs'

/** id da regra -> data da última conferência, para o lastmod do sitemap. */
const VERIFICADO_EM = new Map(regras.regras.filter((r) => r.verificado_em).map((r) => [r.id, r.verificado_em]))

/** slug do guia -> data da última revisão (o `updated` do frontmatter), para o lastmod do sitemap. */
const GUIAS_ATUALIZADOS = new Map(
  readdirSync('./src/content/guias')
    .filter((f) => f.endsWith('.md'))
    .map((f) => [f.replace(/\.md$/, ''), /^updated:\s*(\d{4}-\d{2}-\d{2})/m.exec(readFileSync(`./src/content/guias/${f}`, 'utf8'))?.[1]]),
)

// Medição do Google (GA4 / Tag Manager): só entra na CSP quando o build recebe um identificador.
// Sem eles o site não fala com nenhum domínio de fora — ver src/scripts/ga.ts.
const USA_GOOGLE = Boolean((SITE.analytics.ga4 ?? '').trim() || (SITE.analytics.gtm ?? '').trim())
const GOOGLE_TAG = 'https://www.googletagmanager.com'
const GOOGLE_CONNECT = USA_GOOGLE ? ` ${GOOGLE_TAG} https://*.google-analytics.com https://*.analytics.google.com` : ''
const GOOGLE_IMG = USA_GOOGLE ? ` ${GOOGLE_TAG} https://*.google-analytics.com` : ''

export default defineConfig({
  site: SITE.url,
  // Páginas noindex ficam fora do sitemap: o painel interno e o destino do link de
  // cancelamento do aviso, que só chega por e-mail e não é conteúdo.
  integrations: [
    react(),
    sitemap({
      filter: (page) => !page.includes('/painel') && !page.includes('/cancelar-aviso'),
      /*
       * lastmod honesto: a data em que a regra daquele tribunal foi conferida pela última vez. É o
       * sinal que o buscador usa para decidir quando revisitar — e aqui ele corresponde a uma
       * mudança de verdade no conteúdo, não à data do último deploy.
       */
      serialize: (item) => {
        const m = /\/tribunais\/([^/]+)\/$/.exec(item.url)
        const g = /\/guias\/([^/]+)\/$/.exec(item.url)
        const data = m ? VERIFICADO_EM.get(m[1]) : g ? GUIAS_ATUALIZADOS.get(g[1]) : undefined
        return data ? { ...item, lastmod: new Date(`${data}T00:00:00Z`).toISOString() } : item
      },
    }),
  ],
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
