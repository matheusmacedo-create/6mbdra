# 6MB — Preparador de PDFs para peticionamento eletrônico

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
   `contrato_otimizado.pdf`, `laudo_parte_01.pdf`.

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
repetir o comentário se os achados forem os mesmos, e fechando a issue quando tudo volta ao normal.
Para rodar localmente atrás de proxy: `NODE_USE_ENV_PROXY=1 node scripts/check-sources.mjs`.

## Deploy

Node 22 ou mais novo (`.node-version` e `engines` no `package.json`; na Cloudflare Pages use o
sistema de build v3 ou a variável `NODE_VERSION=22`). Defina `SITE_URL` no ambiente de build com o
domínio final (sem ela o site usa a URL de preview da hospedagem para canonical e sitemap).

Site 100 % estático (`dist/`). Recomendado: **Cloudflare Pages** (plano gratuito compatível com uso
comercial; o `gs.wasm` de 16 MB fica abaixo do teto de 25 MiB por arquivo). `public/_headers` define
cache e cabeçalhos de segurança; a Content-Security-Policy é gerada pelo próprio Astro como
`<meta http-equiv>` com os hashes dos scripts inline que ele emite (`security.csp` em
`astro.config.mjs`), sem `unsafe-eval`. Vercel funciona (`vercel.json` equivalente), mas o plano Hobby
não permite uso comercial. Ajuste `src/config/site.mjs` (nome, URL, e-mail) antes de publicar.

Conferência local do build com os cabeçalhos: `node scripts/serve-dist.mjs 4329`.

Analytics: nenhum provedor vem ativo. `src/tool/lib/analytics.ts` expõe `track()` com eventos
agregados (sem nome/conteúdo de arquivo); para ligar um provedor, defina `window.__analytics`.

## Navegadores suportados

O build usa o alvo padrão do Vite ("baseline widely available": Chrome/Edge 107+, Firefox 104+, Safari 16+,
todos de 2022 em diante). Requisitos de execução: WebAssembly, Web Workers em módulo e `File.arrayBuffer()`.
Sem WebAssembly a página avisa e a divisão em partes continua funcionando. Testado automaticamente só em
Chromium; Firefox e Safari precisam de conferência manual antes do lançamento (spec §15.1).

## Licença

AGPL-3.0 (veja `LICENSE`). O motor é o Ghostscript (AGPL-3.0, Artifex Software), executado no
navegador do usuário via `@jspawn/ghostscript-wasm`. Demais dependências: pdf-lib (MIT), fflate
(MIT), React (MIT), Astro (MIT).
