# brpdf — Preparador de PDFs para peticionamento eletrônico

Site estático + ferramenta no navegador para advogadas, advogados e equipes que precisam deixar
vários PDFs dentro do limite de tamanho por arquivo dos sistemas de peticionamento (PJe, eproc,
e-SAJ, Projudi…). Escolha o tribunal (ou informe o limite), arraste os PDFs e baixe os arquivos
prontos — comprimidos ou divididos em partes — sem que nenhum documento saia do computador.

Implementa a V1 descrita em `Especificação do Aplicativo de Preparação de PDFs Jurídicos`
(gratuito, sem cadastro, processamento local, regras versionadas com fonte oficial, sem servidor).

## Como funciona

1. **Configurar** — tribunal/sistema (com limite declarado, meta segura de 95 %, fonte e data de
   conferência) ou limite manual em MB.
2. **Revisar o lote** — cada PDF é analisado antes de qualquer alteração: tamanho, páginas, senha,
   assinatura digital e integridade. Já cabe? Fica intacto. Assinado? Fica de fora por padrão.
   Com senha ou corrompido? É apontado, sem travar os demais.
3. **Preparar** — Ghostscript (WebAssembly, num Web Worker) tenta primeiro a otimização
   estrutural e depois reduz as imagens em seis níveis (300 → 100 dpi), parando no primeiro que
   cabe e voltando a um mais leve se sobrar folga. Texto, fontes e OCR são preservados; imagens
   1 bit ficam em CCITT G4. A saída é verificada (PDF válido, mesmo número de páginas). Se nem o
   nível máximo couber — ou a compressão não ajudar —, o arquivo é dividido por páginas inteiras.
4. **Baixar** — um a um ou tudo em ZIP (inclui os que já cabiam), com nomes previsíveis:
   `contrato_otimizado.pdf`, `laudo_parte_01_de_03.pdf`. O ZIP do lote (`zipPlan.ts`) vem com pasta raiz, arquivos
   numerados na ordem (`01_`, `02_`…), sem acentos, partes em pasta própria, pastas `peticao_NN` quando o sistema
   limita a soma dos anexos por petição, e `LEIA-ME.txt`.

Detalhes e números da prova técnica: [`docs/decisoes-tecnicas.md`](docs/decisoes-tecnicas.md).

## Desenvolvimento

```bash
npm install          # .npmrc já define legacy-peer-deps (bug do npm com peers opcionais do vitest)
npm run dev          # http://localhost:4321
npm run build        # valida as regras + build estático em dist/
npm run preview
npm run check        # astro check (TypeScript nas páginas e na ferramenta)
npm test             # unitários (vitest): pipeline com motor falso, análise, nomes, regras
npm run test:e2e     # Playwright em Chromium: fluxo completo com PDFs gerados na hora, teste de rede
```

## Estrutura

```
src/
  pages/                 rotas Astro: início (ferramenta), tribunais/, guias/, metodologia, privacidade, termos, contato
  layouts/Base.astro     cabeçalho, rodapé, metadados
  content/guias/*.md     guias (coleção de conteúdo)
  data/regras.json       base de regras dos tribunais (validada no build)
  data/fontes.lock.json  hashes das fontes para o monitor semanal
  config/site.mjs        nome público, URL, e-mail de contato, margem de segurança
  tool/                  ilha React da ferramenta
    App.tsx              quatro estados: configurar → revisar → preparar → baixar
    hooks/useJobQueue.ts análise prévia, fila sequencial, cancelamento, reprocessar item
    lib/engine/          níveis, argumentos do Ghostscript, pipeline, motor (worker)
    lib/analyze.ts       validade, páginas, senha, assinatura (pdf-lib + busca de bytes)
    lib/split.ts         divisão por páginas com medição real
    lib/regras.ts        tipos e helpers da base de regras
    workers/             gs.worker.ts (Ghostscript WASM) e pdf.worker.ts (pdf-lib)
scripts/
  validate-rules.mjs     falha o build se uma regra estiver incompleta ou sem fonte oficial
  check-sources.mjs      monitor das fontes (hash do texto visível) — roda semanalmente no Actions
tests/unit, tests/e2e
docs/decisoes-tecnicas.md
```

## Regras dos tribunais

Só entram regras confirmadas em fonte oficial (`*.jus.br`, `*.gov.br`), com trecho literal, URL,
data da fonte e data da conferência. O arquivo é `src/data/regras.json`; o build roda
`scripts/validate-rules.mjs` (enumerações de instância, tipo e sistema; campos opcionais para limite
por página, por petição, condicional por páginas, exigência de PDF/A e motivo de revisão).

Toda segunda-feira `rules-monitor.yml` confere as fontes (`scripts/check-sources.mjs`): compara o
trecho citado, normalizado, e um hash da vizinhança dele; grava contadores e hashes em
`src/data/fontes.lock.json` (comitado pelo próprio workflow) e abre ou atualiza uma issue com o
label `regras` quando algo muda ou uma fonte fica fora do ar por duas rodadas seguidas — sem
repetir o comentário se os achados forem os mesmos, e registrando (uma vez) quando as fontes estabilizam. Fechar a issue é decisão de quem revisa, depois de atualizar `verificado_em`.
Para rodar localmente atrás de proxy: `NODE_USE_ENV_PROXY=1 node scripts/check-sources.mjs`.

## Deploy

No ar em **https://6mb.6mb-app.workers.dev** (Worker `6mb`, publicado com `npm run deploy`).
O endereço e o nome do Worker ainda usam o nome antigo do projeto; trocar exige criar um Worker novo
(ou apontar um domínio próprio, como `brpdf.com.br`, em Settings → Domains & Routes).

Site 100 % estático (`dist/`), publicado como **Cloudflare Worker com arquivos estáticos**
(`wrangler.jsonc`; plano gratuito compatível com uso comercial; o `gs.wasm` de 16 MB fica abaixo do
teto de 25 MiB por arquivo). `public/_headers` define cache e cabeçalhos de segurança; a
Content-Security-Policy é gerada pelo próprio Astro como `<meta http-equiv>` com os hashes dos
scripts inline que ele emite (`security.csp` em `astro.config.mjs`), sem `unsafe-eval`.

### Colocar no ar (Workers Builds, sem token)

1. No painel da Cloudflare: **Workers & Pages → Create → Import a repository** e escolha
   `matheusmacedo-create/6mbdra`.
2. Nome do projeto: **`6mb`** (precisa ser igual ao `name` do `wrangler.jsonc`, senão o build falha).
3. Build command: `npm run build`. Deploy command: `npx wrangler deploy` (o padrão).
   Branch de produção: a branch com o código (hoje `claude/jolly-einstein-q6ps8f`).
4. Variável de build `SITE_URL` = URL pública do site (por exemplo `https://6mb.SEU-SUBDOMINIO.workers.dev`
   ou o domínio próprio). Sem ela, canonical e sitemap apontam para o domínio previsto em
   `src/config/site.mjs`.
5. **Deploy**. A partir daí cada push na branch de produção publica de novo; outras branches geram
   URLs de preview se "non-production branch builds" estiver ligado.

Node 22 vem de `.node-version` (o Workers Builds respeita o arquivo). Domínio próprio: **Settings →
Domains & Routes** no Worker.

### Deploy manual

`npm run deploy` (build + `wrangler deploy`). Exige `npx wrangler login` ou as variáveis
`CLOUDFLARE_API_TOKEN` (token com permissão *Workers Scripts: Edit*) e `CLOUDFLARE_ACCOUNT_ID`.
Conferência local do site como ele vai rodar na Cloudflare, com `_headers`, redirecionamentos e 404:
`npm run preview:cf` (porta 8788). Só os cabeçalhos: `node scripts/serve-dist.mjs 4329`.

Alternativas: Cloudflare Pages (importe o repositório como Pages; build `npm run build`, saída
`dist`; mesmo `_headers`) e Vercel (`vercel.json` equivalente, mas o plano Hobby não permite uso
comercial). Ajuste `src/config/site.mjs` (nome, URL, e-mail) antes de publicar.

Medição de uso: eventos agregados (sem nome nem conteúdo de arquivo) vão para o painel próprio em
`/painel/`; GA4 e Tag Manager são opcionais e ficam desligados até o build receber `PUBLIC_GA4_ID`
ou `PUBLIC_GTM_ID`. Detalhes em [README-metricas.md](README-metricas.md).

### Juntar documentos

Opção da etapa 2, visível só quando há mais de um documento aproveitável: os PDFs viram um arquivo
só (`documentos_juntados.pdf`) na ordem da lista, e esse arquivo entra na compressão e na divisão
como qualquer outro — é o que resolve o caso de a soma estourar o limite do tribunal.

**Documento assinado digitalmente nunca entra na junção** (`podeJuntar()` em
`src/tool/lib/types.ts`). Juntar copia as páginas para um arquivo novo e a assinatura não sobrevive
a isso; o que restaria é a imagem de uma assinatura, sem validade. Nem o "Processar mesmo assim",
que autoriza a compressão, vale aqui. Documento com senha e análise que não terminou também ficam
de fora — sem saber se há assinatura, juntar seria apostar no documento de outra pessoa.

A ordem de entrada vem de `src/tool/lib/ordenar.ts`, que lê **só o nome do arquivo**: prefixo
numérico (`01 - peticao`) manda em tudo; sem ele, vale a ordem convencional de uma petição (peça,
procuração, atos constitutivos, documentos pessoais, provas, guias); e no empate, ordem natural do
nome. Ler o conteúdo exigiria camada de texto, que digitalização não tem — justamente o caso que
esta ferramenta existe para resolver. A ordem é sugestão: a lista tem setas para ajustar, e ela
vale tanto para o arquivo juntado quanto para a numeração do ZIP.

### Domínio próprio (brpdf.com)

No ar em **https://brpdf.com**. O registro fica na Hostinger e o DNS na Cloudflare
(`brynne.ns.cloudflare.com` / `fred.ns.cloudflare.com`); o Worker `6mb` está amarrado aos dois
hosts como *custom domain*, o que faz a Cloudflare manter sozinha o DNS e o certificado.

`www.brpdf.com` responde 301 para a raiz. O redirecionamento vive no próprio Worker
(`semWww()` em `src/worker/index.ts`, coberto por `tests/unit/worker.test.ts`) em vez de uma
Redirect Rule no painel, para ficar versionado e testável. Isso exige `assets.run_worker_first:
true` no `wrangler.jsonc`: o campo só aceita padrões de caminho, não de host, então restringi-lo a
`/api/*` faria a camada de arquivos estáticos responder antes e o redirecionamento nunca rodaria.
O preço é uma invocação de Worker por requisição — ela só compara o host e repassa para
`env.ASSETS`, e os cabeçalhos de `_headers` continuam valendo. Se um dia o volume justificar,
trocar por uma Redirect Rule (`Rules → Redirect Rules`) devolve os arquivos estáticos ao caminho
direto; aí `run_worker_first` volta a ser `["/api/*"]` e `semWww()` sai.

Para mover para outro domínio: trocar os dois `pattern` em `wrangler.jsonc`, o padrão de `url` em
`src/config/site.mjs`, o host em `semWww()` (nada a trocar — a regra é genérica) e publicar.

**A Cloudflare injeta conteúdo no `robots.txt`.** Zonas novas vêm com o *managed robots.txt*
ligado, que acrescenta bloqueios a rastreadores de IA (GPTBot, ClaudeBot, Google-Extended,
Bytespider…) antes das nossas regras. Buscadores comuns seguem liberados e o `Sitemap:` continua
correto. Para desligar: **Cloudflare → brpdf.com → Security → Settings → AI Scrapers and
Crawlers**.

### Buscadores: Search Console, Bing Webmaster Tools e IndexNow

**Google.** A propriedade de domínio está verificada por registro TXT no DNS (vale para `www` e
raiz, http e https, e não depende do HTML). O sitemap é `https://brpdf.com/sitemap-index.xml`,
anunciado também no `robots.txt`. Nada disso vive no código.

**Bing.** Verificado pela meta tag `msvalidate.01`, que o `Base.astro` emite a partir de
`SITE.verificacao.bing` (`src/config/site.mjs`; `PUBLIC_BING_SITE_VERIFICATION` no ambiente tem
precedência). O código não é segredo — aparece no HTML de qualquer site que o use — e fica
versionado pelo mesmo motivo do identificador do GA4: o build de produção não pode depender de
alguém lembrar de uma variável. Alternativa sem código: no Bing Webmaster Tools, *Importar do
Google Search Console*.

**IndexNow** (Bing, Yandex, Naver, Seznam). A cada `npm run deploy`, `scripts/indexnow.mjs`
avisa os buscadores quais URLs mudaram, em vez de esperar o rastreador voltar:

1. `plan`, antes do `wrangler deploy`: compara o `dist/` recém-construído com o site no ar e
   grava em `.cache/indexnow.json` as URLs novas, alteradas e removidas. "Mudou" é o texto da
   página (título, descrição e `<main>`), não o HTML — o hash dos assets muda em todo build e
   não interessa ao buscador. Sem rede, marca tudo como desconhecido e nunca derruba o deploy.
2. `submit`, depois: confere que `/<chave>.txt` está no ar e envia a lista a
   `api.indexnow.org`. Preview (`*.pages.dev`, `*.workers.dev`, local) nunca é enviado.

`npm run indexnow -- all` envia todas as URLs do sitemap (primeira vez ou reindexação);
`--dry-run` mostra sem enviar. A chave vem de `SITE.indexNow.chave` e é publicada por
`src/pages/[chave].txt.ts` — o protocolo exige o arquivo público, e a chave só autoriza URLs
deste host, então não é segredo. Para trocar: gerar 32 hex novos e publicar.
`tests/unit/indexnow.test.ts` trava a chave, a meta tag, a ordem do deploy e a definição de
"mudou".

## Navegadores suportados

O build usa o alvo padrão do Vite ("baseline widely available": Chrome/Edge 107+, Firefox 104+, Safari 16+,
todos de 2022 em diante). Requisitos de execução: WebAssembly, Web Workers em módulo e `File.arrayBuffer()`.
Sem WebAssembly a página avisa e a divisão em partes continua funcionando.

A suíte de ponta a ponta roda em quatro projetos (`playwright.config.ts`): Chromium com tudo; WebKit — o
motor de todo navegador no iOS, inclusive o Chrome — com os testes de motor (`@navegadores`: WebAssembly,
Workers, WebCrypto, download de Blob, layout no celular); e dois aparelhos emulados, **iPhone 14 (WebKit)**
e **Pixel 7 (Chromium)**, com os testes de motor mais os específicos de celular (`@celular`). Firefox roda
com `npm run test:e2e:navegadores`.

### Celular (iOS e Android)

O que o celular tem de diferente, e como o site lida com cada coisa:

- **A tela apaga no meio do lote.** O iOS suspende a aba e o Android estrangula o JavaScript; o
  Ghostscript para. `src/tool/lib/telaAcesa.ts` pede um *wake lock* enquanto a fase é "processando" e
  pede de novo quando a pessoa volta para a aba. Sem suporte, nada muda.
- **O passo seguinte é mandar o PDF para alguém.** `src/tool/lib/compartilhar.ts` abre a folha do
  sistema (WhatsApp, e-mail…) com os PDFs como arquivos — botão "Compartilhar" por documento e para o
  lote. Só aparece onde `navigator.canShare({ files })` é verdadeiro (Safari iOS 15+, Chrome Android);
  a lista de arquivos é montada sem nenhum `await`, porque o Safari só abre a folha dentro do toque.
- **Tela inicial.** `apple-touch-icon.png` (o iOS ignora SVG e, sem ele, usa uma captura da página) e
  `manifest.webmanifest` com ícones 192/512, gerados de `favicon.svg` por `scripts/gera-icones.mjs`.
  `display: minimal-ui`, não `standalone`: no modo app do iOS o download de Blob é instável.
- **Barra de gestos do iPhone.** `viewport-fit=cover` e `env(safe-area-inset-bottom)` na faixa de
  consentimento, que é o único elemento fixo no rodapé.
- **Memória.** `deviceCapacityWarning()` (`src/tool/lib/limits.ts`) avisa acima de 50 MB por arquivo
  em celular/tablet, sem bloquear. O motor pesa 11 MB comprimidos na primeira visita (a interface diz
  isso), fica em cache por um ano e compila em streaming.
- Campos de texto têm 16 px: abaixo disso o iOS dá zoom ao focar. Não há `100vh` nem `:hover` que
  esconda conteúdo.

**Servidor de teste em HTTPS.** `scripts/serve-dist.mjs` serve o `dist/` com certificado autoassinado
(gerado com openssl em `.cache/`). Motivo: a CSP tem `upgrade-insecure-requests`, e o WebKit aplica isso
até em `localhost` — trocava `http://localhost/_astro/…` por `https://` e falhava o handshake, o que
fazia a suíte inteira do Safari falhar antes de carregar o CSS. Chromium e Firefox isentam localhost, e
por isso ninguém tinha visto. `--http` mantém o modo antigo para conferência manual.

## Licença

AGPL-3.0 (veja `LICENSE`). O motor é o Ghostscript (AGPL-3.0, Artifex Software), executado no
navegador do usuário via `@jspawn/ghostscript-wasm`. Demais dependências: pdf-lib (MIT), fflate
(MIT), React (MIT), Astro (MIT).
