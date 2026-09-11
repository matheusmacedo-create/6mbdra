# Decisões técnicas (prova técnica da V1)

Registro das decisões tomadas na fase 0 da especificação (prova técnica do motor de PDF), com os
números medidos. Fixtures sintéticas geradas localmente; datas de 10/09/2026.

## 1. Motor de compressão: Ghostscript 9.56 em WebAssembly (`@jspawn/ghostscript-wasm` 0.0.2)

**Alternativas avaliadas no navegador (Chromium 141 headless) e em Node 22:**

| Motor | Licença | Bundle | Preserva texto/OCR | Observações |
|---|---|---|---|---|
| Ghostscript 9.56 WASM (`@jspawn/ghostscript-wasm`) | AGPL-3.0 | 16 MB (11 MB gzip) | Sim (reescreve o documento inteiro) | **Escolhido.** Mantém CCITT G4 de digitalizações 1 bit; robusto com PDFs estranhos; menor pico de memória (~300 MB na fixture de 137 MB). Devolve rc=0 com PDF vazio para arquivos corrompidos ou com senha: exige verificação da saída. Build de 2022, com asserts. |
| Ghostscript 10.06 WASM (`@okathira/ghostpdl-wasm`, `@bentopdf/gs-wasm`) | AGPL-3.0 | 15,5 MB | Sim | Mais novo e tipado, **mas os builds publicados não incluem o codificador CCITT**: digitalizações preto e branco (o tipo mais comum em autos) saem em Flate 1 bit e **dobram de tamanho** (330 KB → 598 KB). Rejeitado até existir build com drivers completos. |
| MuPDF 1.28 WASM (`mupdf`) | AGPL-3.0 | 3,6 MB brotli | Sim (só troca imagens) | Compressão igual ou melhor, mais leve. Porém a reescrita de imagens é código próprio (~50 linhas + casos: SMask, máscaras, bilevel — que ele infla 4×), e devolve PDF vazio sem erro para arquivos truncados. Candidato forte para V2. |
| `@pdfmergy/pdf-compress-wasm` (PDFium + qpdf) | MIT | 2,3 MB gzip | Sim | Mais rápido, mas ignora silenciosamente imagens com cadeias de filtro incomuns (0/20 processadas numa fixture) e é projeto jovem de um mantenedor. |
| pdf.js + canvas (rasterizar páginas) | Apache-2.0 | 1,3 MB | **Não** (texto vira imagem) | Viola RF09 (preservar texto). Descartado como motor; poderia ser modo de emergência opt-in em V2. |
| qpdf / pdfcpu WASM | Apache/ISC | pequeno | Sim | Sem reamostragem de imagens: não reduzem digitalizações. |

**Licença.** Ghostscript e MuPDF são AGPL-3.0: ao servir o WASM ao navegador, o projeto precisa
disponibilizar o código-fonte correspondente. Por isso o repositório inteiro é AGPL-3.0. Isso é
compatível com um site financiado por anúncios (AGPL não proíbe uso comercial), mas impede
fechar o código sem licença comercial da Artifex.

**Flags que importam (medido):**

- `-dJPEGQ` é ignorado pelo `pdfwrite`; a qualidade JPEG vem de `/QFactor` via
  `-c "<< /ColorImageDict << /QFactor x ... >> >> setdistillerparams" -f in.pdf`.
- Imagens 1 bit: `-dDownsampleMonoImages=false -dEncodeMonoImages=true -dMonoImageFilter=/CCITTFaxEncode`.
  Subamostrar bilevel só funciona com fator inteiro (`/Subsample`) e `/Bicubic` converte em cinza 8 bits
  (infla o arquivo). Decisão: nunca reamostrar bilevel; se não couber, dividir.
- `-dPassThroughJPEGImages=false` nos níveis com reamostragem (senão JPEGs existentes ficam intactos).
- Sem `-dQUIET`: as linhas `Page N` do stdout viram progresso por página.
- Nunca usar `-dPDFSETTINGS=/screen` (72 dpi com filtro médio deixa dígitos de 8 pt ilegíveis).

**Escada de níveis** e razão medida numa digitalização real de texto a 300 dpi (JPEG q85, 1,17 MB/página):

| Nível | Configuração | Razão medida |
|---|---|---|
| 1 Estrutural | sem reamostrar, JPEG intacto, dedupe, fontes subset | 1,00 |
| 2 Mínima | 300 dpi, QFactor 0,4 | 0,77 |
| 3 Leve | 200 dpi, QFactor 0,5 | 0,40 |
| 4 Média | 150 dpi, QFactor 0,76 | 0,24 |
| 5 Forte | 120 dpi, QFactor 1,0 | 0,19 |
| 6 Máxima | 100 dpi, QFactor 1,3 | 0,11 |

Um scan colorido de 20 páginas (45,7 MB) leva ~6 s por passe no Chromium desktop; a fixture de 137 MB, ~20 s.
Pico de memória do processo do navegador: ~600 MB para 45 MB de entrada. Celulares e iOS
ficam sob risco acima de algumas dezenas de MB (aviso de capacidade na interface).

**Detecção de falhas.** O Ghostscript 9.56 retorna código 0 e um PDF de ~2 KB com uma página em
branco para entradas corrompidas, truncadas ou com senha. O app trata como falha quando: o log
contém marcadores fatais (`requires a password`, `Couldn't initialise file`, `Catalog dictionary not
located`…), nenhuma linha `Page N` foi impressa, ou a saída tem menos páginas que a entrada
(contagem com pdf-lib). A análise prévia (pdf-lib) recusa antes: PDFs cifrados e não-PDFs.

## 2. Divisão em partes: pdf-lib

`copyPages` para intervalos sequenciais, medindo o tamanho real de cada parte (recursos
compartilhados fazem o tamanho não ser proporcional). Quando a compressão não reduz (bilevel,
JBIG2, arquivos já otimizados) ou o motor falha, divide-se o **original**, sem tocar no conteúdo.

## 3. Assinaturas e senhas

Detecção de assinatura por campo `/FT /Sig` no AcroForm ou pelos bytes `/ByteRange` + `/Sig`.
Assinados ficam fora por padrão (o usuário pode liberar). Cifrados são recusados (sem remoção
de proteção), inclusive os que abrem sem senha mas têm restrições, para não "quebrar proteção"
silenciosamente.

## 4. Arquitetura

Astro 7 (páginas estáticas para SEO) + ilha React (`src/tool`) + Web Workers (Ghostscript e
pdf-lib) + regras em JSON versionado validado no build + monitor semanal das fontes (GitHub
Actions). Sem servidor, banco ou autenticação. CSP sem `unsafe-eval`: o glue do Ghostscript é
empacotado pelo Vite como módulo do worker (nada é avaliado dinamicamente); WASM exige
`'wasm-unsafe-eval'`.

## 5. O que fica para depois

- MuPDF como motor alternativo (bundle 4× menor) quando o tratamento de bilevel/SMask estiver
  resolvido e testado.
- Build próprio do Ghostscript 10.x com codificador CCITT (scripts de build do `@bentopdf/gs-wasm`
  servem de base).
- Modo de emergência (rasterização) opt-in para PDFs que o Ghostscript não abre.
