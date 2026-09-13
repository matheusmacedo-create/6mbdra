# Aderência à especificação V1

Estado em 11/09/2026, após revisão adversarial (corretude, privacidade, regras, especificação, build/deploy, UX/acessibilidade). "Onde" aponta o código ou o teste que comprova.

| Requisito | Situação | Onde |
|---|---|---|
| RF01 Selecionar vários PDFs no mesmo lote | Feito | `DropZone` (múltiplos, pastas); e2e "processa vários arquivos" |
| RF02 Escolher tribunal e sistema (limite, fonte, verificação) | Feito | `RuleSelector` agrupado por ramo; `src/data/regras.json` (limites por página/petição, condicionais, PDF/A, regras nacionais com `abrange`); `src/data/tribunais.json` com os 92 tribunais e contador de cobertura |
| RF03 Limite personalizado | Feito | `RuleSelector` (campo MB), `resolveSettings` |
| RF04 Meta segura (95 %) | Feito | `metaBytes`, `targetForLimit`, `targetFor` (por arquivo, considerando páginas); único percentual no arquivo de regras |
| RF05 Análise preliminar (assinado, protegido, inválido) antes de alterar | Feito | `analyze.ts` + `pdfCrypt.ts` (distingue senha de abertura de restrições de edição com senha de usuário vazia), `deriveKind`; e2e "PDF assinado", "arquivo corrompido", "PDF só com restrições" |
| RF06 Processamento local, sem bytes/nomes na rede | Feito | Workers + WASM; e2e "nenhuma requisição de rede transporta os documentos" |
| RF07 Otimizar só quando necessário | Feito | `processPdf` devolve `unchanged`; e2e "já dentro da meta são mantidos" |
| RF08 Dividir por páginas respeitando a meta e a ordem | Feito | `split.ts` (orçamento por parte segue limite por página e condicional), `pipeline.ts`; e2e "divide em partes"; unit `split.test.ts` |
| RF09 Preservar texto existente; senão, dividir | Feito | Ghostscript pdfwrite preserva texto; sem rasterização; divisão do original quando a compressão não ajuda ou não preserva páginas; aviso quando marcadores/formulários não acompanham as partes |
| RF10 Resultado por arquivo (antes, depois, partes, situação) | Feito | `JobRow`; progresso por passe (páginas) e do lote (arquivos enfileirados); região de status única para leitores de tela |
| RF11 ZIP local só com resultados aprovados e nomes únicos | Feito | `zipPlan.ts`: pasta raiz, numeração na ordem do lote, partes em pasta, pastas por petição, LEIA-ME; unit `zipPlan.test.ts`, e2e |
| RF12 Cancelamento com liberação de memória | Feito | `cancel()` aborta e encerra os workers (Ghostscript e pdf-lib); watchdog de inatividade; e2e "cancelar interrompe o lote" |
| RF13 Reprocessar um item | Feito | botão "Tentar de novo" (`retry`) |
| RF14 Responsivo + aviso de capacidade | Feito | CSS mobile (e2e em 390 px sem rolagem horizontal); `deviceCapacityWarning` (deviceMemory, celular/tablet por UA e toque); contraste revisado no modo escuro |
| RF15 Regras versionadas validadas no build | Feito | `scripts/validate-rules.mjs` em `npm run build` |
| RF16 Medição sem dados de documentos | Feito (sem provedor ativo) | `analytics.ts` bloqueia chaves de nome/conteúdo/hash e mantém contagens; eventos: lote, resultado, download (todos os botões), regra (inclusive via ?regra=), erro |
| §6.1 Páginas públicas (início, diretório, página por regra, guias, metodologia, privacidade, termos, contato) | Feito | `src/pages/**`, 8 guias em `src/content/guias` |
| §8.2 Nomes `_otimizado` / `_parte_01` | Feito | `naming.ts` (`_parte_01_de_03`; nomes sem acento/espaço; numeração `NN_` no ZIP) |
| §8.3 Assinados excluídos por padrão; com senha recusados | Feito | `deriveKind`: senha de abertura recusada; só restrições de edição (abre sem senha) fica fora por padrão e o usuário pode liberar, avisado de que o resultado sai sem as restrições; nunca tentamos senha alguma |
| §8.4 Prova técnica do motor e licença | Feito | `docs/decisoes-tecnicas.md` |
| §9.1 Monitor semanal das fontes | Feito | `scripts/check-sources.mjs` (trecho normalizado + hash de vizinhança, paralelo, assinatura) e `rules-monitor.yml` (comita o lock, issue com label, sem repetição, registra quando estabiliza; fechamento é humano) |
| §12 CSP, sem scripts de terceiros, dependências fixadas | Feito | CSP com hashes (meta) + cabeçalho para os scripts dos workers; sem `unsafe-inline`/`unsafe-eval`; HSTS, COOP; nomes sanitizados no ZIP; log do motor só em dev; `package-lock.json` |
| §13.2 Espaço reservado para anúncios sem deslocar layout | Feito (vazio) | `.ad-slot` abaixo de "Como funciona", longe dos botões |
| §15.1 Navegadores: Chrome/Edge/Firefox/Safari | Parcial | Testado só em Chromium headless; Firefox/Safari pendentes de teste manual |
| §15.3 Piloto com profissionais | Pendente | Depende de pessoas reais |
| §19 Nome público, domínio, e-mail de contato, ferramenta de analytics | Pendente (decisão do dono) | `src/config/site.mjs`; hospedagem pronta em `wrangler.jsonc` (Cloudflare Workers, ver README "Colocar no ar") |

## Regras pesquisadas mas não cadastradas (fonte oficial inacessível ou não confirmada)

Pesquisa feita em 10/09/2026 com verificação independente. Ficam fora da base até uma conferência humana:

- **TJRJ · PJe** — indícios de 5 MB por PDF (dicas de sistema do PJe-RJ, 2022); os PDFs do portal não puderam ser baixados (TLS).
- **TJRS · eproc** — indícios de 11 MB (padrão do eproc); site recusou conexão.
- **TJRN · PJe** — indícios de 5 MB (Portaria Conjunta 33/2020, feitos criminais); hosts com HTTP 403.
- **TRF3 · PJe / PEPWEB (JEFs)** — indícios de 10 MB por arquivo e ~250 KB por página; hosts com HTTP 503.
- **TJMS · e-SAJ** — indícios de 30 MB por arquivo, 300 KB por página, 90 MB por petição; só fonte da OAB/MS.
- **STJ · e-STJ** — indícios de 30 MB (documento principal) e 100 MB (anexos), total 500 MB; folder oficial devolveu 403.
- **TSE/TREs · PJe** — Portaria TSE 886/2017 define limites; site bloqueia acesso automatizado.
- **TRT1 · PJe-JT** — 10 MB (Ato Conjunto 48/2021), coberto pela regra nacional "CSJT"; página própria com HTTP 403.
