// Configuração pública do site. Sem segredos aqui: este arquivo vai para o bundle.
export const SITE = {
  /** Nome público. Troque aqui e em toda a interface muda. */
  name: 'brpdf',
  tagline: 'Prepare seus PDFs para o protocolo eletrônico',
  /**
   * URL canônica usada no sitemap e nos metadados. Defina SITE_URL no ambiente de build ao publicar;
   * sem ela, usa a URL de preview da hospedagem (Cloudflare Pages / Vercel) ou, por último, o endereço
   * atual do v0 na Cloudflare. Troque o último valor quando o domínio próprio existir.
   */
  url:
    process.env.SITE_URL ??
    (process.env.CF_PAGES_URL ? new URL(process.env.CF_PAGES_URL).origin : undefined) ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ??
    'https://6mb.6mb-app.workers.dev',
  /** E-mail de contato exibido na página /contato. */
  contactEmail: 'brpdf@proton.me',
  /**
   * Medição externa. O identificador do GA4 não é segredo: ele aparece no HTML de qualquer site que
   * o use. Fica versionado aqui para o build de produção não depender de ninguém lembrar da
   * variável; PUBLIC_GA4_ID / PUBLIC_GTM_ID no ambiente têm precedência (inclusive com valor vazio,
   * para gerar um build sem medição alguma).
   *
   * Com algum dos dois preenchido, a CSP passa a permitir os domínios do Google (astro.config.mjs),
   * entra o Modo de Consentimento v2 e aparece a faixa de consentimento (src/scripts/ga.ts).
   */
  analytics: {
    ga4: process.env.PUBLIC_GA4_ID ?? 'G-4TLWSQ2CRM',
    gtm: process.env.PUBLIC_GTM_ID ?? '',
  },
}
