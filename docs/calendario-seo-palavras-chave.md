# Calendário de conteúdo de SEO — mapa de palavras-chave

Fonte: mapa de 145 palavras-chave (planilha enviada em 15/09/2026, abas "Resumo" e "Base"),
copiado para [`docs/seo/palavras-chave-base.csv`](seo/palavras-chave-base.csv) para ficar
disponível em qualquer sessão futura, sem depender do upload original.

**Aviso da própria planilha, que vale reforçar:** os volumes são estimativas de modelagem, não
leitura de API (Keyword Planner/Semrush). Servem para priorizar, não para prometer número. A
fonte real de validação é o Search Console (ver `README-seo.md`).

Este documento existe para que cada rodada (a rotina roda diariamente) saiba o que já foi feito e
o que vem a seguir, sem repetir trabalho nem duplicar conteúdo. Regra que não muda: uma intenção
por página, nada de página fina — os mesmos critérios do `README-seo.md`.

## Dia 1 (15/09/2026) — feito

**7 páginas novas `/comprimir-pdf-para-<tamanho>/`** (cluster B, "Tamanho-alvo", prioridade 5 na
maioria dos termos): 100kb, 300kb, 500kb, 1mb, 2mb, 5mb, 10mb. Cada uma cita uma regra real da
base (`src/data/regras.json`) em vez de número solto — 100 KB e 300 KB são limites **por página**
do e-SAJ (TJAL e TJSP), 1 MB é o menor limite por arquivo da base (TJAL/TJAM e-SAJ), 2 MB é o SPE
do TRT3, 5 MB e 10 MB citam os tribunais que de fato usam esses valores. Dados em
`src/data/tamanhosAlvo.ts`, página em `src/pages/comprimir-pdf-para-[tamanho].astro`.

**Recurso novo na ferramenta:** link `?limiteMb=<valor>` (`src/tool/App.tsx`), irmão do `?regra=`
que as páginas de tribunal já usavam — abre a ferramenta com o limite manual pré-preenchido e
mostra o mesmo aviso de "destino já escolhido". Sem isso as páginas de tamanho-alvo seriam só
conteúdo; com isso o CTA já entrega o resultado configurado.

**Link cruzado:** `/comprimir-pdf/` ganhou uma seção "Já sabe o tamanho que precisa?" listando as
7 páginas; o guia `limite-por-arquivo-pagina-e-peticao` ganhou um link para a de 300 KB como
exemplo real de limite por página.

**Confirmado o pipeline de publicação automática** (era a outra parte do pedido): push na branch
designada (`claude/modest-meitner-9dcobf`) → PR aberto e mergeado sozinho na branch de produção
(`claude/jolly-einstein-q6ps8f`, ~1–2 min) → Cloudflare Workers Builds publica sozinho a partir
dessa branch. Verificado de ponta a ponta: os 8 guias do dia anterior estavam no ar em
`brpdf.com` (HTTP 200) depois do ciclo completo. Nenhuma ação manual necessária — só é preciso
não commitar direto na branch de produção nem pular a branch designada.

## Backlog priorizado (próximos dias, ~1 item por rodada)

Ordem por prioridade média do cluster (coluna `Prioridade brpdf`) e por não haver página própria
ainda. Ver `docs/seo/palavras-chave-base.csv` para os termos exatos de cada cluster.

- [ ] **Dia 2 — Guia "Como assinar PDF digitalmente: gov.br, certificado A1/A3 e ICP-Brasil"**
  (cluster F). ~86 mil buscas/mês somadas em termos ainda sem página própria de "como fazer":
  assinar documento gov.br, assinador digital, assinatura digital gratuita, assinar pdf com
  certificado digital, certificado digital A1 ou A3, certificado digital para advogado, validar
  assinatura digital, ICP-Brasil assinatura digital, como assinar petição digitalmente, assinar
  pdf já assinado por outra pessoa. Os guias existentes (`assinatura-eletronica-e-assinatura-
  digital-a-diferenca`, `por-que-comprimir-antes-de-assinar-digitalmente`) respondem "o quê" e
  "por quê"; falta o "como" prático — não é duplicata.

- [ ] **Dia 3 — Guia "Como excluir e reorganizar páginas de um PDF"** (cauda do cluster A).
  Termos sem página: excluir página de pdf (12,1 mil/mês), organizar páginas pdf (1,9 mil/mês).
  Complementa `como-girar-pagina-de-pdf-de-cabeca-para-baixo` e
  `como-extrair-paginas-especificas-de-um-pdf` (já publicados), mesma abordagem honesta:
  ferramentas gratuitas locais (LibreOffice Draw, qpdf), sem prometer um recurso que o brpdf não
  tem hoje ("Organizar páginas" segue "Em breve" na home).

- [ ] **Dia 4 — Guias de peticionamento passo a passo** (cluster C, prioridade 5, confiança
  média/alta): "como protocolar petição eletrônica passo a passo" no PJe, "como anexar documentos
  no PJe", "como anexar procuração no PJe", "peticionamento eletrônico e-SAJ passo a passo". São
  guias de processo (telas, ordem dos cliques), gerais o bastante para não ficarem obsoletos a
  cada atualização de interface do tribunal — focar no fluxo que não muda (entrar, escolher
  processo, anexar, assinar, protocolar), não em prints de tela específicos.

- [ ] **Dia 5 — Revisão de cauda longa nos guias existentes** (clusters G e H, termos de baixo
  volume individual mas já cobertos por guia existente): conferir se `pdf-a-quando-o-tribunal-
  exige` responde literalmente "pdf/a-1b como gerar" e "salvar como pdf/a no word", e se
  `o-que-e-ocr-e-texto-pesquisavel-no-pdf` responde "ocr online grátis em português" e "pdf
  pesquisável". Ajuste incremental, não guia novo — evita canibalização.

## Fora do escopo por decisão, não por esquecimento

A própria planilha já marca como "Fora do escopo atual" ou "Não perseguir": editar pdf, converter
pdf (genérico), pdf para word / word para pdf / pdf para jpg, transformar pdf em texto, remover
senha de pdf, proteger pdf com senha, e os termos navegacionais de marca (pje, e-saj, eproc,
projudi, ilovepdf, smallpdf, pdf24, carteira oab digital). Mantém a aposta descrita no
`README-seo.md`: não competir de frente com ferramentas genéricas estabelecidas.

Dois recortes pedem uma decisão do Matheus antes de qualquer página, porque mudam o escopo do
site (hoje: preparar PDF para peticionamento) em vez de só ampliar dentro dele:

- **Cluster I "Conteúdo de atração"** (modelo de petição inicial, contagem de prazo processual,
  software para advogados) — bom volume, mas é conteúdo jurídico geral, não sobre PDF. Vale como
  estratégia de link building, mas é um tipo de página novo, sem o grounding em dado real
  (`regras.json`) que sustenta as páginas atuais.
- **Página "Comparativo" com iLovePDF/Smallpdf/Adobe** — termos comerciais de bom volume
  ("ilovepdf comprimir", "adobe comprimir pdf", "ilovepdf é seguro"), mas uma comparação direta
  com concorrentes pede cuidado editorial (factual, sem depreciar) que vale confirmar antes de
  escrever.

## Como uma rodada futura deve usar este arquivo

1. Ler a seção "Backlog priorizado" e pegar o primeiro item não marcado.
2. Checar `docs/seo/palavras-chave-base.csv` para os termos exatos e o volume de cada um.
3. Depois de publicar, marcar o item como feito aqui (`[x]`) e, se sobrar orçamento do dia,
   adicionar um novo item ao final do backlog a partir da planilha — sempre um item por vez, sempre
   conferindo que a intenção não colide com página já existente (`README-seo.md` tem a lista
   completa de páginas e o mapa de palavras-chave original).
