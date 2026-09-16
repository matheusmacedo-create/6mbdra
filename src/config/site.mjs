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
   * Repositório público.
   *
   * Não é enfeite de rodapé: o site afirma em cinco páginas que o código é aberto e que dá para
   * conferir o que roda no navegador. Durante um bom tempo essa afirmação não vinha com endereço
   * nenhum — quem quisesse verificar não tinha por onde começar, e uma garantia que não dá para
   * checar é indistinguível de uma promessa vazia. A AGPL-3.0 também exige oferecer a fonte a quem
   * usa o serviço, então isto é obrigação, não cortesia.
   */
  repo: 'https://github.com/matheusmacedo-create/6mbdra',
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
    /*
     * Bing Webmaster Tools, pela meta tag msvalidate.01. Vale o mesmo raciocínio do GA4: o código
     * aparece no HTML de qualquer site que o use, então não é segredo, e fica versionado para o
     * build de produção não depender de ninguém lembrar da variável. A alternativa sem código
     * nenhum é "Importar do Google Search Console" dentro do próprio Bing Webmaster Tools.
     */
    bing: process.env.PUBLIC_BING_SITE_VERIFICATION ?? '79D3BEEB92703DDB18530EC32902EB72',
  },
  /*
   * IndexNow (Bing, Yandex, Naver, Seznam): a cada deploy, scripts/indexnow.mjs avisa os
   * buscadores quais URLs mudaram, em vez de esperar o rastreador voltar. A chave é publicada em
   * /<chave>.txt (src/pages/[chave].txt.ts) — o protocolo exige isso, e ela só autoriza URLs deste
   * host, então não é segredo. Para trocar: gere 32 hex novos e publique.
   */
  indexNow: {
    chave: process.env.PUBLIC_INDEXNOW_KEY ?? '9dab8b52677fe83efe516378690919f1',
  },
  analytics: {
    ga4: process.env.PUBLIC_GA4_ID ?? 'G-4TLWSQ2CRM',
    gtm: process.env.PUBLIC_GTM_ID ?? '',
  },
}
