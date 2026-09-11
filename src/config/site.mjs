// Configuração pública do site. Sem segredos aqui: este arquivo vai para o bundle.
export const SITE = {
  /** Nome público (decisão pendente: ver spec §19). Troque aqui e em toda a interface muda. */
  name: '6MB',
  tagline: 'Prepare seus PDFs para o protocolo eletrônico',
  /**
   * URL canônica usada no sitemap e nos metadados. Defina SITE_URL no ambiente de build ao publicar;
   * sem ela, usa a URL de preview da hospedagem (Cloudflare Pages / Vercel) ou o domínio previsto.
   */
  url:
    process.env.SITE_URL ??
    (process.env.CF_PAGES_URL ? new URL(process.env.CF_PAGES_URL).origin : undefined) ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ??
    'https://6mb.app.br',
  /** E-mail de contato exibido na página /contato. Ajuste ao publicar. */
  contactEmail: 'contato@6mb.app.br',
}
