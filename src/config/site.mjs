// Configuração pública do site. Sem segredos aqui: este arquivo vai para o bundle.
export const SITE = {
  /** Nome público. Troque aqui e em toda a interface muda. */
  name: 'brpdf',
  tagline: 'Prepare seus PDFs para o protocolo eletrônico',
  /**
   * URL canônica usada no sitemap e nos metadados. Defina SITE_URL no ambiente de build para
   * publicar em outro endereço (um preview, por exemplo); sem ela, usa a URL da hospedagem
   * (Cloudflare Pages / Vercel) ou, por último, o domínio próprio.
   */
  url:
    process.env.SITE_URL ??
    (process.env.CF_PAGES_URL ? new URL(process.env.CF_PAGES_URL).origin : undefined) ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ??
    'https://brpdf.com',
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
  /**
   * Verificação de propriedade do site. O código do Search Console não é segredo (fica no HTML),
   * mas também não é fixo: cada propriedade tem o seu. Defina PUBLIC_GOOGLE_SITE_VERIFICATION no
   * build, ou verifique por registro TXT no DNS — que vale para o domínio inteiro e não depende
   * do HTML continuar no ar.
   */
  verificacao: {
    google: process.env.PUBLIC_GOOGLE_SITE_VERIFICATION ?? '',
  },
  analytics: {
    ga4: process.env.PUBLIC_GA4_ID ?? 'G-4TLWSQ2CRM',
    gtm: process.env.PUBLIC_GTM_ID ?? '',
  },
}
