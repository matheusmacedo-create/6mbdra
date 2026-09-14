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
