# Aderência à especificação V1

Estado em 11/09/2026. "Onde" aponta o código ou o teste que comprova.

| Requisito | Situação | Onde |
|---|---|---|
| RF01 Selecionar vários PDFs no mesmo lote | Feito | `DropZone` (múltiplos, pastas); e2e "processa vários arquivos" |
| RF02 Escolher tribunal e sistema (limite, fonte, verificação) | Feito | `RuleSelector`, `src/data/regras.json` (35 regras) |
| RF03 Limite personalizado | Feito | `RuleSelector` (campo MB), `resolveSettings` |
| RF04 Meta segura (95 %) | Feito | `metaBytes`, `targetForLimit`; teste `regras.test.ts` |
| RF05 Análise preliminar (assinado, protegido, inválido) antes de alterar | Feito | `analyze.ts`, `deriveKind`; e2e "PDF assinado", "arquivo corrompido" |
| RF06 Processamento local, sem bytes/nomes na rede | Feito | Workers + WASM; e2e "nenhuma requisição de rede transporta os documentos" |
| RF07 Otimizar só quando necessário | Feito | `processPdf` devolve `unchanged`; e2e "já dentro da meta são mantidos" |
| RF08 Dividir por páginas respeitando a meta e a ordem | Feito | `split.ts`, `pipeline.ts`; e2e "divide em partes" |
| RF09 Preservar texto existente; senão, dividir | Feito | Ghostscript pdfwrite preserva texto; sem rasterização; divisão do original quando a compressão não ajuda |
| RF10 Resultado por arquivo (antes, depois, partes, situação) | Feito | `JobRow` |
| RF11 ZIP local só com resultados aprovados e nomes únicos | Feito | `download.ts`, `uniqueNames`; ZIP inclui os que já cabiam |
| RF12 Cancelamento com liberação de memória | Feito | `cancel()` aborta e encerra o worker; e2e "cancelar interrompe o lote" |
| RF13 Reprocessar um item | Feito | botão "Tentar de novo" (`retry`) |
| RF14 Responsivo + aviso de capacidade | Feito | CSS mobile; `deviceCapacityWarning` |
| RF15 Regras versionadas validadas no build | Feito | `scripts/validate-rules.mjs` em `npm run build` |
| RF16 Medição sem dados de documentos | Feito (sem provedor ativo) | `analytics.ts` bloqueia chaves de nome/conteúdo |
| §6.1 Páginas públicas (início, diretório, página por regra, guias, metodologia, privacidade, termos, contato) | Feito | `src/pages/**`, 8 guias em `src/content/guias` |
| §8.2 Nomes `_otimizado` / `_parte_01` | Feito | `naming.ts` |
| §8.3 Assinados excluídos por padrão; com senha recusados | Feito | `deriveKind`; sem tentativa de remover proteção |
| §8.4 Prova técnica do motor e licença | Feito | `docs/decisoes-tecnicas.md` |
| §9.1 Monitor semanal das fontes | Feito | `scripts/check-sources.mjs`, `.github/workflows/rules-monitor.yml` |
| §12 CSP, sem scripts de terceiros, dependências fixadas | Feito | `astro.config.mjs` (`security.csp`), `public/_headers`, `package-lock.json` |
| §13.2 Espaço reservado para anúncios sem deslocar layout | Feito (vazio) | `.ad-slot` em `index.astro` |
| §15.1 Navegadores: Chrome/Edge/Firefox/Safari | Parcial | Testado só em Chromium headless; Firefox/Safari pendentes de teste manual |
| §15.3 Piloto com profissionais | Pendente | Depende de pessoas reais |
| §19 Nome público, domínio, e-mail de contato, ferramenta de analytics | Pendente (decisão do dono) | `src/config/site.mjs` |
