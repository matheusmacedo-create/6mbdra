/// <reference types="astro/client" />

interface ImportMetaEnv {
  /** Google Analytics 4 (G-XXXXXXXXXX). Vazio = nenhuma tag do Google é carregada. */
  readonly PUBLIC_GA4_ID?: string
  /** Google Tag Manager (GTM-XXXXXXX). Quando definido, manda no lugar do GA4 direto. */
  readonly PUBLIC_GTM_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
