# Estrutura de páginas, palavras-chave e acompanhamento

## A aposta

Não vamos disputar "comprimir pdf" com iLovePDF e Smallpdf. Eles têm mais de uma década de
autoridade e milhões de links; entrar nessa briga é queimar meses sem resultado.

A aposta é o **oposto**: dezenas de buscas específicas que eles não respondem e nem podem
responder, porque exigem uma base de regras de tribunal brasileiro. Quem digita *"limite de anexo
no PJe do TRT2"* tem intenção altíssima e encontra, hoje, fórum de 2019 e página de tribunal mal
indexada. É aí que dá para ganhar.

## Arquitetura de páginas

| Tipo | URL | Quantas | Responde a |
| --- | --- | --- | --- |
| Ferramenta | `/` | 1 | marca, "brpdf" |
| Tarefa | `/comprimir-pdf/`, `/dividir-pdf/`, `/juntar-pdf/` | 3 | a tarefa + contexto jurídico |
| Sistema | `/sistemas/<slug>/` | 5 | "limite do PJe", "tamanho máximo e-SAJ" |
| Índice de sistemas | `/sistemas/` | 1 | comparação entre sistemas |
| Tribunal | `/tribunais/<id>/` | 53 | "limite PDF TJSP e-SAJ" |
| Diretório | `/tribunais/` | 1 | "limite de anexo por tribunal" |
| Guia | `/guias/<slug>/` | 8 | o problema, não a ferramenta |
| Institucional | `/metodologia/`, `/privacidade/`, `/termos/`, `/contato/` | 4 | confiança (E-E-A-T) |

**124 URLs no sitemap.** `/painel/` é `noindex` e fica fora.

### Por que a camada de sistema foi a peça que faltava

A base é organizada por tribunal, mas ninguém busca por tribunal na hora do aperto — busca pelo
**sistema que está na tela**. As páginas de sistema agregam o que a base já tinha e respondem à
pergunta que antes ficava sem resposta:

| Página | Tribunais | Limite |
| --- | --- | --- |
| `/sistemas/pje/` | 44 | 1,5 MB a 50 MB |
| `/sistemas/pje-jt/` | 25 | 10 MB (norma do CSJT, igual em todos) |
| `/sistemas/eproc/` | 10 | 4 MB a 40 MB |
| `/sistemas/projudi/` | 7 | 1,4 MB a 10 MB |
| `/sistemas/e-saj/` | 5 | 1 MB a 30 MB |

Sistemas usados por **um** tribunal só (e-STF, CPE, JPe-Themis, SPE/SRRE) **não** ganham página:
seria duplicata da página daquele tribunal. Há teste que quebra se alguém criar uma.

## Malha de links internos

Medição feita sobre o site construído, com 22 guias no ar: **seis guias tinham um
único link de entrada** (o do índice) e **nenhuma das 101 páginas de tribunal
apontava para guia nenhum**. Ou seja, 73% das páginas do site não passavam nada
para o conteúdo — e a rotina diária estava produzindo mais guias para o mesmo
buraco.

Três ligações, em `src/tool/lib/guias.ts`:

**Página de tribunal → guias** (`guiasDoTribunal`). A escolha sai dos dados
daquele tribunal: exige PDF/A, tem limite por página, tem limite por petição, o
teto é apertado ou folgado. Cada link vem com o motivo escrito ao lado — é o que
separa um bloco útil de uma lista de links.

Os guias que valem em qualquer tribunal (checklist, recusa, OCR, nomes de
arquivo) são escolhidos por **rotação estável pelo id do tribunal**. Sem isso,
77 páginas mostrariam o mesmo bloco, que é o boilerplate que o buscador desconta.
A rotação é determinística: o mesmo tribunal dá sempre o mesmo resultado, então
o bloco não muda sozinho entre deploys.

**Guia → guias** (`relacionados`). Por etiquetas em comum, normalizadas (as tags
foram escritas por sessões diferentes e vêm com "PDF"/"pdf", "PJe"/"pje",
"peticionamento"/"peticionamento eletrônico"). Escala sozinho: guia novo entra na
malha no mesmo build, sem ninguém editar lista nenhuma — o que importa porque há
uma rotina criando guias todo dia.

**Índice por tema** (`porTema`). Lista plana de 22 itens não diz o que o site
cobre. Agrupado, vira mapa. Guia que não casa com tema nenhum cai em "Outros",
nunca some.

### Por que o rodapé tem 3 guias, e não 22

Link de rodapé é igual em todas as páginas — é a definição de boilerplate, e o
buscador desconta. Uma lista que cresce todo dia também deixaria o rodapé
ilegível para quem usa o site. No rodapé ficam só as três portas de entrada de
maior intenção de busca; o peso real vem dos blocos contextuais, onde cada link
tem motivo escrito e as páginas mostram conjuntos diferentes.

### O resultado, medido

| | antes | depois |
|---|---:|---:|
| Guias alcançáveis só pelo índice | 6 | **0** |
| Páginas de tribunal que linkam guias | 0 de 101 | **100 de 100** |
| Combinações distintas de bloco | — | **26** |

`tests/unit/ligacao.test.ts` trava as propriedades, não os números: nenhum guia
órfão, toda página de tribunal aponta para guias, os blocos variam, e todo slug
citado no código existe de verdade (renomear um guia sem ajustar quebra o teste
em vez de derrubar o link em 100 páginas silenciosamente).

## Mapa de palavras-chave

Uma intenção por página. Duas páginas mirando o mesmo termo competem entre si (canibalização) e
as duas perdem.

### Páginas de tarefa

| Página | Principal | Variações que o texto cobre |
| --- | --- | --- |
| `/comprimir-pdf/` | comprimir pdf para peticionamento | reduzir tamanho pdf protocolo · diminuir pdf para o pje · compactar pdf advogado · pdf muito grande para anexar |
| `/dividir-pdf/` | dividir pdf por tamanho | separar pdf em partes mb · dividir pdf sem perder ordem · pdf grande demais para protocolar |
| `/juntar-pdf/` | juntar pdf | unir pdf peticionamento · juntar procuração e documentos · limite de quantidade de anexos |

### Páginas de sistema e de tribunal

Padrão: `limite [de tamanho] [de arquivo|anexo|pdf] <sistema>` e a mesma coisa com a sigla do
tribunal. O título já segue a forma da busca — *"Limite de PDF no e-SAJ do TJSP: 30 MB"* —, o que
melhora a taxa de clique porque o resultado **já mostra a resposta**.

Cobre também: "tamanho máximo anexo pje", "quantos mb o esaj aceita", "eproc limite arquivo",
"projudi tamanho máximo", "<sistema> não aceita arquivo grande".

### Guias

Miram o problema antes de a pessoa saber que existe ferramenta: "pdf digitalizado muito pesado",
"o que é mb e mib", "pdf com senha não anexa", "assinei e não consigo comprimir".

### O que ficou de fora de propósito

- **"comprimir pdf" puro** — competitivo demais para um site novo.
- **Página por cidade/comarca** — é o mesmo conteúdo com nome trocado. Google chama isso de
  doorway page e pune.
- **Página por combinação tribunal × tarefa** (53 × 3 = 159 páginas finas) — mesmo problema.

## Auditoria: o que foi medido e corrigido

Revisão sobre as 132 páginas construídas. **Nada estava quebrado** — nenhuma página sem título,
descrição, H1 ou canonical; nenhum duplicado; JSON-LD todo válido; `lang` correto; 404 devolvendo
404 de verdade; Googlebot recebendo 200 com HTML real. O que foi corrigido eram perdas silenciosas:

| Achado | Antes | Depois |
| --- | --- | --- |
| Título com a resposta depois do corte do Google | pior caso no caractere 90 | sempre antes do 60 |
| Descrição acima do que o buscador exibe | 103 páginas | 2 |
| Página sem prévia de compartilhamento | 130 de 130 | 0 |
| Página de conteúdo sem dados estruturados | 107 | 0 |
| Página com menos de 300 palavras | 16 | 2 |
| CLS da página inicial | 0,061 | 0,009 |

Três decisões merecem explicação:

**Título das páginas de tribunal.** O contexto ("petição intermediária") foi para o fim. Não é
estética: o Google corta perto de 60 caracteres, e o que precisa sobreviver ao corte é a resposta —
sigla, sistema e o valor do limite. Antes, `Limite de PDF na petição intermediária no Portal de
Serviços (petição eletrônica) do TJRJ: 6 MB` empurrava o "6 MB" para depois do caractere 90.

**Nome curto do sistema.** `sistemaCurto()` tira o parêntese explicativo, mas mantém a sigla quando
é ela que está lá: "Central do Processo Eletrônico (CPE)" vira "CPE", "Portal de Serviços (petição
eletrônica)" vira "Portal de Serviços".

**FAQ nas páginas de tribunal.** Cada resposta é montada com os dados daquele tribunal — limite,
data de conferência, limite por página, exigência de PDF/A. Por isso as 107 páginas têm conteúdo
diferente, e não o mesmo bloco repetido, que seria conteúdo duplicado.

`tests/unit/meta.test.ts` roda essa auditoria a cada build e quebra se algo regredir.
`tests/unit/links.test.ts` confere que nenhum link interno aponta para página inexistente.

## Dados estruturados

- `/` — `WebApplication` + `FAQPage`
- `/sistemas/<slug>/` — `BreadcrumbList` + `FAQPage`
- `/comprimir-pdf/` — `HowTo` + `FAQPage` + `BreadcrumbList`
- `/dividir-pdf/`, `/juntar-pdf/` — `FAQPage` + `BreadcrumbList`

`FAQPage` é o que pode render trecho expandido no resultado. Todas as respostas são factuais: nada
de número inventado, avaliação ou depoimento.

`lastmod` no sitemap é a **data real de conferência da regra** daquele tribunal — não a data do
último deploy. É o sinal que o buscador usa para decidir quando revisitar, e aqui ele corresponde a
uma mudança de verdade.

---

# Como acompanhar o avanço

## O ponto que o Analytics não cobre

GA4 e o painel em `/painel/` só enxergam **depois que a pessoa chegou**. Nenhum dos dois sabe
quantas vezes o site apareceu numa busca, em que posição, nem o que foi digitado. Para SEO, a
ferramenta é o **Google Search Console** — e ele é gratuito.

### Ligar o Search Console (5 minutos, precisa da sua conta Google)

1. <https://search.google.com/search-console> → **Adicionar propriedade** → tipo **Domínio** →
   `brpdf.com`.
2. Ele devolve um registro **TXT**. Cole em **Cloudflare → brpdf.com → DNS → Add record** (tipo
   TXT, nome `@`, conteúdo o que o Google deu) e clique em verificar.
   - O tipo *Domínio* cobre apex, `www`, http e https de uma vez — por isso é melhor que *Prefixo
     de URL*.
   - Alternativa: build com `PUBLIC_GOOGLE_SITE_VERIFICATION=<código>`, que injeta a meta tag. Mas
     aí a verificação depende do HTML continuar no ar.
3. **Sitemaps** → enviar `https://brpdf.com/sitemap-index.xml`.

## Expectativa realista

Site novo não ranqueia em semana. O que acontece de verdade:

| Quando | O que esperar | O número que importa |
| --- | --- | --- |
| Semanas 1–2 | Google descobre e indexa | **páginas indexadas** subindo até ~124 |
| Semanas 3–8 | Aparece em buscas de cauda longa, posição 20–50 | **impressões** (clique ainda quase zero) |
| Meses 2–4 | Páginas específicas sobem para a 1ª página | **posição média** caindo |
| Meses 4–8 | Cliques em volume | **cliques** e lotes iniciados no painel |

Impressão antes de clique é o normal. Comemorar impressão no mês 1 e clique no mês 4 é ler o
funil certo; esperar clique no mês 1 é desistir antes da hora.

## O painel conta o rastreamento, e isso chega antes do Search Console

`/painel/` tem a seção **Rastreamento pelos buscadores**, alimentada pelo Worker — não por
JavaScript. Isso importa porque **rastreador não roda JavaScript**: o Googlebot nunca apareceria
na medição do navegador.

É o sinal mais precoce que existe. Entre publicar e o Search Console mostrar o primeiro número há
dias de silêncio; nesse intervalo, ver "Google · Página de tribunal · 37 passadas" é a prova de
que o rastreamento começou. A leitura:

- **Zero passadas na primeira semana** — normal. O Google precisa descobrir o site.
- **Passadas só na home** — ele chegou mas não seguiu os links. Verifique o sitemap no Search
  Console.
- **Passadas nas páginas de tribunal e de sistema** — é o que queremos: o conteúdo que diferencia
  está sendo lido.
- **Passadas caem a quase zero depois de semanas ativas** — o Google concluiu que não vale
  revisitar. Sinal de conteúdo considerado fraco.

É contador agregado por dia, rastreador e tipo de página — não guarda URL nem IP.

## Os três painéis, e o que cada um responde

| Ferramenta | Responde | Não responde |
| --- | --- | --- |
| **Search Console** | apareci? onde? para quê? | o que a pessoa fez depois |
| **`/painel/`** | quantos preparam e baixam de fato; qual tribunal; o que dá errado; **se o Google está rastreando** | em que posição aparecemos |
| **GA4** | comportamento agregado de quem aceitou cookie | tudo de quem recusou |

O painel próprio conta **todo mundo** (sem cookie, sem consentimento). O GA4 só conta quem
aceitou. Quando os números divergirem, o do painel é o completo.

## Ritual semanal — 10 minutos

1. **Search Console → Desempenho**, últimos 28 dias comparado aos 28 anteriores. Anote
   impressões, cliques e posição média.
2. **Search Console → Páginas**. Indexadas subindo? Algum erro novo?
3. **Search Console → Consultas**, ordenado por impressões. Procure a linha com **muita impressão
   e pouco clique**: significa que aparecemos mas o título não convenceu. Reescrever esse título é
   a melhoria de maior retorno que existe.
4. **`/painel/`** → funil e "tribunais escolhidos". Se o tráfego cresce mas o funil não, estamos
   atraindo a intenção errada.
5. **Uma ação.** Uma por semana, sempre: reescrever um título, responder uma dúvida que apareceu
   nas consultas, ou cadastrar um tribunal que falta.

## Sinais de alerta

- **Impressões sobem, cliques não** → título e descrição. Conserto barato, retorno alto.
- **Cliques sobem, lotes iniciados não** → a página promete o que a ferramenta não entrega, ou a
  intenção da busca é outra.
- **Páginas indexadas estacionam bem abaixo de 124** → o Google está achando as páginas fracas.
  Menos páginas com mais conteúdo é melhor que muitas páginas finas.
- **Erro no Search Console** → resolver na semana. Página fora do índice não traz nada.

## Uma alavanca fora do site

Ranqueamento depende também de outros sites apontarem para cá, e isso não se resolve em código:
OAB seccional, comissões de tecnologia, grupos de prática, professores. Uma menção de um site
jurídico confiável vale mais que dezenas de páginas novas. Vale mais a pena investir nisso do que
em criar mais páginas.
