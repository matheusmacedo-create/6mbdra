# Aderência à especificação V1

Estado em 16/09/2026. "Onde" aponta o código ou o teste que comprova. Linhas marcadas como parciais dizem
exatamente o que falta — um checklist que arredonda para "feito" deixa de servir para alguma coisa.

| Requisito | Situação | Onde |
|---|---|---|
| RF01 Selecionar vários PDFs no mesmo lote | Feito | `DropZone` (múltiplos, pastas); e2e "processa vários arquivos" |
| RF02 Escolher tribunal e sistema (limite, fonte, verificação) | Feito | `RuleSelector` agrupado por ramo; `src/data/regras.json` (limites por página/petição, condicionais, PDF/A, regras nacionais com `abrange`); `src/data/tribunais.json` com os 92 tribunais; 53 regras cobrindo 85 deles |
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
| RF16 Medição sem dados de documentos | Feito (medição ativa: D1 própria + GA4 após consentimento) | `analytics.ts` bloqueia chaves de nome/conteúdo/hash e mantém contagens; eventos: lote, resultado, download (todos os botões), regra (inclusive via ?regra=), erro |
| §6.1 Páginas públicas (início, diretório, página por regra, guias, metodologia, privacidade, termos, contato) | Feito | `src/pages/**`, 26 guias em `src/content/guias`, seção `/seguranca/` (4 páginas) e 158 rotas no total |
| §8.2 Nomes `_otimizado` / `_parte_01` | Feito | `naming.ts` (`_parte_01_de_03`; nomes sem acento/espaço; numeração `NN_` no ZIP) |
| §8.3 Assinados excluídos por padrão; com senha recusados | Feito | `deriveKind`: senha de abertura recusada; só restrições de edição (abre sem senha) fica fora por padrão e o usuário pode liberar, avisado de que o resultado sai sem as restrições; nunca tentamos senha alguma |
| §8.4 Prova técnica do motor e licença | Feito | `docs/decisoes-tecnicas.md` |
| §9.1 Monitor semanal das fontes | Feito | `scripts/check-sources.mjs` (trecho normalizado + hash de vizinhança, paralelo, assinatura) e `rules-monitor.yml` (comita o lock, issue com label, sem repetição, registra quando estabiliza; fechamento é humano) |
| §12 CSP, sem scripts de terceiros, dependências fixadas | Feito | CSP com hashes (meta) + cabeçalho para os scripts dos workers; sem `unsafe-inline`/`unsafe-eval`; HSTS, COOP; nomes sanitizados no ZIP; log do motor só em dev; `package-lock.json` |
| §13.2 Espaço reservado para anúncios sem deslocar layout | Feito (vazio) | `.ad-slot` abaixo de "Como funciona", longe dos botões |
| §15.1 Navegadores: Chrome/Edge/Firefox/Safari | Parcial | **Chromium**: suíte completa (32 e2e). **Firefox**: 10/10 dos testes `@navegadores` (WASM, workers, WebCrypto, download, celular), verificado em 16/09/2026. **WebKit/Safari**: projeto configurado e navegador instalável (`npm run test:e2e:navegadores`), mas a suíte ainda não foi executada nele — é o que falta para fechar este item |
| §15.3 Piloto com profissionais | Pendente | Depende de pessoas reais |
| §19 Nome público (brpdf), domínio, e-mail de contato, ferramenta de analytics | Feito | `brpdf.com` no ar (Cloudflare Workers, `wrangler.jsonc`), contato `brpdf@proton.me`, medição própria em D1 + GA4 |
| Conferidor de assinaturas (integridade PAdES no navegador) | Feito | `src/tool/lib/assinatura.ts`, `politicas-icp.ts`, ilha em `src/tool/conferidor/`, página `/conferir-assinatura/`; 13 unitários + 10 e2e; Etapa 0 documentada em `docs/conferidor-etapa-0.md` |
| Código aberto verificável: a promessa vem com endereço | Feito | `SITE.repo` no rodapé de todas as páginas, nas 5 páginas que afirmam código aberto e em `SoftwareSourceCode`; `tests/unit/codigoAberto.test.ts` quebra se a afirmação ficar sem link |

## Tribunais ainda sem regra (7 de 92)

Pesquisa em 13/09/2026, com verificação independente de cada fonte. Ficam fora da base até uma
conferência humana (a ferramenta cobre esses tribunais pelo limite manual):

- **TJRS · eproc** — indícios de 11 MB (padrão do eproc, FAQ oficial arquivada em 2023). Todos os
  hosts `*.tjrs.jus.br` aplicam bloqueio geográfico a acessos de fora do Brasil.
- **TJRN · PJe** — hosts `*.tjrn.jus.br` respondem "Acesso Bloqueado" a acessos estrangeiros.
- **TJPB · PJe** — indícios de 2 MB (Cartilha PJe 2.0, 2018) e 1,2 MB (2022); domínio atrás de
  desafio JavaScript da Cloudflare.
- **TJPI · PJe** — portal responde com bloqueio de WAF; indícios só do sistema legado ThemisWeb.
- **TJAP · Tucujuris** — sistema próprio, domínio atrás da Cloudflare; nenhum valor oficial.
- **STM · e-Proc da Justiça Militar da União** — nenhuma fonte oficial do limite por PDF no sistema
  judicial. O único valor publicado (30 MB / 100 MB) é do SEI-JMU, que é **administrativo**: o
  próprio manual manda usar o e-Proc para processos judiciais.
- **TJM-SP** — a FAQ do PJe do tribunal (3 MB) estava em `ww2.tjmsp.jus.br`, host que hoje não
  existe mais no DNS; só há cópia arquivada.

Também ficaram de fora, por não serem peticionamento judicial: o SEI do STJ (30/100 MB), o SEI-JMU
do STM e o portal de atendimento (CPA) do TJCE. Para conferir qualquer um deles é preciso um
navegador com IP no Brasil.
