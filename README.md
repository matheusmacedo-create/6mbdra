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

### Domínio próprio (brpdf.com)

O domínio está registrado na Hostinger e hoje aponta para os nameservers de parking dela
(`aster.dns-parking.com` / `helios.dns-parking.com`). Um Worker só aceita domínio próprio se a zona
estiver na Cloudflare, então o caminho é mover o DNS. Ordem, sem pular etapa:

1. **Cloudflare → Add a site → `brpdf.com`** (plano Free). Ela devolve dois nameservers
   `*.ns.cloudflare.com`.
2. **Hostinger → Domínios → brpdf.com → Nameservers → alterar** para os dois da Cloudflare. A
   propagação leva de minutos a algumas horas; a Cloudflare avisa por e-mail quando a zona fica
   *Active*. O site em `workers.dev` continua no ar esse tempo todo.
3. Com a zona ativa, ligar o Worker ao domínio — em `wrangler.jsonc`:

   ```jsonc
   "routes": [
     { "pattern": "brpdf.com", "custom_domain": true },
     { "pattern": "www.brpdf.com", "custom_domain": true }
   ]
   ```

   A Cloudflare cria sozinha os registros DNS e o certificado. (Equivale a **Worker → Settings →
   Domains & Routes → Add → Custom domain**.) Só faça isso **depois** do passo 2: com a zona fora da
   Cloudflare, o `wrangler deploy` falha.
4. Publicar apontando os metadados para o domínio novo:

   ```bash
   SITE_URL=https://brpdf.com npm run deploy
   ```

   Sem isso, canonical, sitemap e Open Graph continuam apontando para o endereço `workers.dev`.
   Vale trocar também o último valor de `url` em `src/config/site.mjs`, que é o padrão de quando
   `SITE_URL` não vem definida, e a variável `SITE_URL` no Workers Builds.
5. **`www` → raiz**: em Rules → Redirect Rules, redirecionar `www.brpdf.com/*` para
   `https://brpdf.com/$1` (301), para existir um endereço canônico só.
6. Conferir: `curl -sI https://brpdf.com/` (200 e os cabeçalhos de `_headers`),
   `curl -s https://brpdf.com/robots.txt` (o `Sitemap:` precisa citar o domínio novo) e
   `curl -s https://brpdf.com/ | grep canonical`.

O token de API usado no deploy manual precisa de *Workers Scripts: Edit*; para criar a zona pelo
terminal, também de *Account → Zone: Create* e *Zone → Zone: Edit*.

## Navegadores suportados

O build usa o alvo padrão do Vite ("baseline widely available": Chrome/Edge 107+, Firefox 104+, Safari 16+,
todos de 2022 em diante). Requisitos de execução: WebAssembly, Web Workers em módulo e `File.arrayBuffer()`.
Sem WebAssembly a página avisa e a divisão em partes continua funcionando. Testado automaticamente só em
Chromium; Firefox e Safari precisam de conferência manual antes do lançamento (spec §15.1).

## Licença

AGPL-3.0 (veja `LICENSE`). O motor é o Ghostscript (AGPL-3.0, Artifex Software), executado no
navegador do usuário via `@jspawn/ghostscript-wasm`. Demais dependências: pdf-lib (MIT), fflate
(MIT), React (MIT), Astro (MIT).
