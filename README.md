# 6MB — Compactador de PDF para o tribunal

Ferramenta web, em português, para advogadas e advogados que precisam protocolar PDFs em sistemas
com limite de tamanho por arquivo (PJe, e-SAJ, Projudi, eproc…). Você arrasta vários PDFs, escolhe o
limite (6 MB por padrão) e baixa cada um já dentro do limite — ou dividido em partes numeradas quando
nem a compressão máxima resolve.

**Tudo roda no navegador.** Nenhum arquivo é enviado para servidor algum: o motor de compressão
(Ghostscript) é executado em WebAssembly, dentro de um Web Worker, na máquina do usuário.

## Como funciona

1. **Análise**: o arquivo é lido e as páginas contadas. Se já cabe no limite, nada é feito.
2. **Compressão em níveis**: o Ghostscript (`pdfwrite`) reamostra e recomprime as imagens do PDF
   preservando texto, fontes, marcadores e a camada de OCR. Há 4 níveis (200 → 150 → 110 → 80 dpi);
   o app começa pelo nível mais leve que provavelmente cabe e só aperta mais se precisar. Se sobrar
   folga, tenta um nível mais leve para entregar mais nitidez.
3. **Verificação**: a saída é conferida (é um PDF válido? tem o mesmo número de páginas?). Ghostscript
   devolve "sucesso" com um PDF vazio para arquivos corrompidos ou com senha — a verificação pega isso.
4. **Divisão** (opcional, ligada por padrão): se nem o nível máximo coube, o resultado é dividido em
   partes sequenciais ("parte 1 de 3"), cada uma abaixo do limite, sem cortar páginas.
5. **Modo de emergência** (opcional): se o Ghostscript falhar num arquivo, as páginas são renderizadas
   como imagens JPEG (pdf.js + pdf-lib). Funciona com quase tudo, mas o texto deixa de ser pesquisável.

O limite é aplicado com margem de segurança de 3 % (alguns sistemas contam 1 MB = 1.000.000 bytes).

## Rodando localmente

```bash
npm install
npm run dev        # http://localhost:5173
```

Outros comandos:

```bash
npm run build      # typecheck + build de produção em dist/
npm run preview    # serve o build em http://localhost:4173
npm test           # testes unitários (vitest)
npm run test:e2e   # testes end-to-end em Chromium (playwright) — gera PDFs de teste sozinho
```

Os scripts `predev`/`prebuild` copiam `gs.js` e `gs.wasm` de `node_modules/@jspawn/ghostscript-wasm`
para `public/gs/` (ignorado pelo git; ~16 MB). O worker carrega esses arquivos em tempo de execução.

## Deploy

É um site estático: publique a pasta `dist/` em qualquer hospedagem (Vercel, Netlify, Cloudflare Pages,
GitHub Pages, um bucket S3…). Não precisa de backend, banco ou variáveis de ambiente.

- Vercel: importe o repositório; o `vercel.json` já configura cache longo para o motor WASM.
- O site precisa ser servido por HTTPS (ou `localhost`) para Web Workers e WebAssembly funcionarem.
- Sirva `gs.wasm` com `Content-Type: application/wasm` (padrão na maioria das hospedagens) para o
  navegador compilar em streaming; sem isso ainda funciona, só um pouco mais devagar.

## Estrutura

```
src/
  App.tsx                 layout e estado geral
  components/             DropZone, SettingsPanel, JobList, JobRow, Faq
  hooks/useJobQueue.ts    fila de processamento (um arquivo por vez), cancelamento, retry
  lib/
    engine/pipeline.ts    estratégia: níveis → verificação → refinamento → divisão
    engine/levels.ts      os 4 níveis (dpi, qualidade JPEG) e a heurística de nível inicial
    engine/gsArgs.ts      linha de comando do Ghostscript por nível
    engine/ghostscript.ts motor principal (fala com o worker)
    engine/raster.ts      motor de emergência (pdf.js + pdf-lib)
    split.ts              divisão em partes com pdf-lib (mede o tamanho real de cada parte)
    rpc.ts                RPC mínimo sobre postMessage, com progresso e cancelamento
  workers/
    gs.worker.ts          carrega o Ghostscript WASM e executa cada compressão
    pdf.worker.ts         contagem de páginas e divisão (pdf-lib) fora da thread principal
tests/
  unit/                   pipeline com motor falso, nomes, formatação
  e2e/                    fluxo completo no Chromium com PDFs gerados na hora
```

## Limites conhecidos

- Navegadores muito antigos (sem WebAssembly ou Web Workers) não são suportados.
- Arquivos gigantes (centenas de MB) podem esbarrar na memória do navegador, principalmente em celulares.
- PDFs que exigem senha para abrir precisam ser destravados antes; PDFs com restrição apenas de
  edição/impressão são processados normalmente (a restrição é removida no resultado).
- O motor WASM usa Ghostscript 9.56. Os arquivos de saída são PDF 1.5.

## Licença

O código deste projeto é distribuído sob a licença **AGPL-3.0** (veja `LICENSE`), a mesma do
Ghostscript, que é executado no navegador do usuário via `@jspawn/ghostscript-wasm`.
Demais dependências: pdf-lib (MIT), pdf.js (Apache-2.0), fflate (MIT), React (MIT).
