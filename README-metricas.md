# Medição de uso do brpdf

Duas camadas independentes. A primeira sempre funciona; a segunda só existe se você quiser.

## 1. Painel próprio (já no ar)

- **Endereço:** `/painel/` — `noindex`, bloqueado no `robots.txt` e fora do sitemap.
- **Senha:** guardada como segredo do Worker (`PAINEL_TOKEN`). Para trocar:
  `npx wrangler secret put PAINEL_TOKEN`
- **Onde ficam os dados:** banco D1 `brpdf-metricas`, tabela `eventos`
  (`migrations/0001_eventos.sql`).
- **Como chegam lá:** o navegador junta os eventos e manda em lote para
  `POST /api/e` (`src/scripts/metricas.ts`); o Worker valida e grava
  (`src/worker/index.ts`).

O que o painel mostra: acessos e visitantes por dia, funil do acesso ao download,
o estado em que os PDFs chegam, tamanho dos originais, resultado do processamento,
motivos de erro, tribunais escolhidos, páginas, origens, dispositivo e os últimos
eventos.

### Privacidade

- Nenhum PDF passa pelo servidor. O processamento continua inteiro no navegador.
- Não guardamos IP nem cookie. O "visitante" é `SHA-256(sal + dia + IP + navegador)`
  cortado em 12 caracteres: serve para não contar a mesma pessoa duas vezes no
  mesmo dia e muda à meia-noite. O sal é o segredo `SAL_VISITANTE`.
- O Worker só aceita os nomes de evento e os campos da lista em `src/worker/index.ts`;
  qualquer outra coisa é descartada na entrada.
- `Do Not Track` e `Global Privacy Control` desligam o envio por completo.

## 2. Google Analytics 4 / Tag Manager (opcional, desligado)

Nada do Google é baixado enquanto o build não receber um identificador:

```bash
PUBLIC_GA4_ID=G-XXXXXXXXXX npm run deploy   # GA4 direto
PUBLIC_GTM_ID=GTM-XXXXXXX npm run deploy    # Tag Manager (configure o GA4 dentro dele)
```

Com um deles definido, e só então:

- a CSP passa a permitir `googletagmanager.com` e os domínios do Analytics
  (`astro.config.mjs` monta isso sozinho);
- entra o Modo de Consentimento v2 com tudo negado por padrão e aparece a faixa
  de consentimento (LGPD), porque o Google usa cookies;
- a página `/privacidade/` troca o texto de cookies automaticamente;
- os mesmos eventos do painel são espelhados no GA4/GTM — menos `acesso`, que o
  próprio gtag já conta como `page_view`.

**Limite conhecido:** a CSP não libera `unsafe-inline`, então *tags de HTML
personalizado* dentro do GTM não executam. Tags nativas (GA4, conversões, pixels
por imagem nos domínios liberados) funcionam.

## Eventos

A lista completa está em `EventName` (`src/tool/lib/analytics.ts`), na ordem do
funil, e é espelhada em `EVENTOS` no Worker. `tests/unit/eventos.test.ts` quebra
o build se as duas listas se separarem ou se algum campo aceito não existir na
tabela.

| Etapa | Eventos |
| --- | --- |
| Chegada | `acesso`, `tempo_pagina`, `link_externo`, `faq_aberto` |
| Entrou na ferramenta | `abriu_ferramenta`, `voltou_inicio`, `motor`, `regra_selecionada`, `opcao_alterada` |
| Trouxe arquivos | `arquivo_adicionado`, `arquivo_analisado`, `arquivo_removido`, `liberar_arquivo` |
| Processou | `lote_iniciado`, `lote_cancelado`, `lote_concluido`, `arquivo_resultado`, `tentar_novamente`, `erro` |
| Levou embora | `zip_gerado`, `download` |

Nenhum evento carrega nome de arquivo, conteúdo, número de processo ou texto
extraído: `track()` bloqueia essas chaves na origem e o Worker bloqueia de novo
na entrada.

## Rodar localmente

```bash
printf 'PAINEL_TOKEN=local123\nSAL_VISITANTE=qualquer\n' > .dev.vars   # fora do git
npx wrangler d1 execute brpdf-metricas --local --file=migrations/0001_eventos.sql
npm run build && npx wrangler dev --port 8788 --local
```
