---
title: "Como saber se um documento foi feito por IA"
description: "Detectores de texto por IA erram muito e não servem para acusar ninguém. Veja o que dá para verificar de fato num arquivo, e por que a ausência de marca não prova nada."
updated: 2026-09-16
tags:
  - anexos
  - checklist
  - formato
  - peticionamento
---

A pergunta aparece cada vez mais: aquela petição, aquele laudo, aquele parecer — foi escrito por uma pessoa ou por um modelo de linguagem?

A resposta honesta tem duas partes. Uma delas é decepcionante e a outra é mais útil do que parece.

## A parte decepcionante: detector de texto não funciona

Existem sites que recebem um texto e devolvem "87% de probabilidade de ter sido gerado por IA". O número passa confiança e não tem lastro.

Os fatos conhecidos sobre essa categoria de ferramenta:

- A **OpenAI desligou o próprio detector** em 2023, alegando baixa taxa de acerto. Quem fez o modelo desistiu de detectá-lo.
- A taxa de **falso positivo** é alta o bastante para causar dano. Casos documentados no meio acadêmico envolvem trabalhos humanos marcados como IA.
- O erro é **pior fora do inglês**. Os detectores foram treinados majoritariamente em textos em inglês, e português corre mais risco de ser classificado errado.
- Texto revisado, traduzido ou escrito em estilo formal — exatamente o texto jurídico — cai com mais facilidade no falso positivo.

Some-se o problema de fundo: mesmo que o detector acertasse 95% das vezes, o que fazer com o resultado? Levar ao juízo que "uma ferramenta gratuita apontou 87%" não sustenta alegação nenhuma, e sustenta muito bem uma resposta da outra parte.

**Um percentual implica calibração que ninguém tem.** É por isso que o brpdf não dá nenhum.

## A parte útil: o que o arquivo registra sobre si

Enquanto o texto não denuncia a origem, o **arquivo** às vezes denuncia. E aí não é adivinhação: é leitura.

### A marca oficial de conteúdo gerado por IA

A IPTC — a mesma entidade que padroniza metadados de notícias e fotografia — mantém um vocabulário para o arquivo registrar como o conteúdo nasceu. O valor `trainedAlgorithmicMedia` significa "gerado inteiramente por um modelo treinado".

Quando essa marca está presente, **quem está afirmando é o gerador**, não um detector. É informação de primeira mão.

Um cuidado que quase todo mundo erra: `algorithmicMedia` sozinho **não** é IA. Pela definição da IPTC, é conteúdo criado por algoritmo que não parte de dados de treino — geração procedural, um gráfico calculado, uma captura de tela. Tratar um como o outro é o falso positivo mais fácil de cometer neste assunto.

### Content Credentials (C2PA)

Um padrão aberto de proveniência apoiado por Adobe, Microsoft, OpenAI e Google, entre outros. Ferramentas participantes embutem no arquivo um **manifesto assinado** dizendo o que foi usado para criar e o que foi feito depois.

Quando existe, é a informação de origem mais forte disponível hoje. Em PDF ainda é raro — numa medição de 166 documentos, incluindo um exportado do Adobe Express, nenhum trazia manifesto. A especificação prevê, e a adoção está começando.

### A ferramenta declarada

Mais banal e mais frequente: o campo que diz com qual programa o arquivo foi gerado. "Microsoft Word 2019", "Canva", "Skia/PDF Google Docs Renderer", o nome de um scanner, o sistema do próprio tribunal.

Não prova autoria, mas conta uma história. Um documento que se apresenta como digitalização de papel e declara ter saído de um editor de texto merece uma pergunta.

Cuidado com o atalho fácil: Canva e Adobe Express **têm** recursos de IA e são usados o tempo todo sem eles. Dizer "feito por IA" porque o arquivo saiu do Canva seria inventar.

## A parte que mais importa entender

**Arquivo sem marca nenhuma não prova nada.**

Os campos são opcionais. A maioria das ferramentas ainda não marca. E qualquer marca existente sai com um clique — inclusive sem querer, ao passar o arquivo por um conversor.

Ausência de indicação é **ausência de informação**, nunca prova de autoria humana. Quem inverter isso vai errar, e vai errar contra alguém.

## Um roteiro realista

1. **Leia a origem declarada.** Solte o arquivo em [documento feito por IA](/documento-feito-por-ia/). Em segundos você vê a ferramenta declarada, a marca IPTC se houver, e Content Credentials se existirem. O arquivo não sai do seu computador.
2. **Confira a coerência.** A ferramenta declarada bate com o que o documento diz ser? As datas fazem sentido com a história contada? O [Raio-X do PDF](/metadados-pdf/) mostra o resto da ficha.
3. **Se houver assinatura, verifique.** É aqui que existem fatos: o [verificador de assinatura](/verificar-assinatura-digital/) diz se o conteúdo mudou e se escreveram no arquivo depois da assinatura.
4. **Para o texto em si, não existe atalho.** Contradição interna, citação de julgado inexistente, referência que não confere — isso se acha lendo, e é o que efetivamente sustenta uma alegação.

## O que isto significa na prática forense

Alegar em juízo que um documento foi produzido por IA, com base num percentual de site, é frágil: a outra parte só precisa apontar que a ferramenta é reconhecidamente imprecisa.

O que sustenta é o concreto — uma marca de origem no próprio arquivo, uma incoerência entre o que o documento afirma e o que ele registra, uma citação que não existe. Menos espetacular, e verificável.
