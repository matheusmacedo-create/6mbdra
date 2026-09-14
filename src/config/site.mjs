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
}
