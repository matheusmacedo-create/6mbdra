---
title: "PAdES e as siglas AD-RB, AD-RT, AD-RC e AD-RA"
description: "O que significam as políticas de assinatura da ICP-Brasil em PDF, o que cada uma exige de verdade e qual escolher para petição, contrato e documento de arquivo."
updated: 2026-09-16
tags:
  - assinatura digital
  - ICP-Brasil
  - formato
  - peticionamento
---

Na hora de assinar, o programa pergunta qual política usar e oferece siglas: AD-RB, AD-RT, AD-RC, AD-RA. Quem tem prazo correndo escolhe a primeira e segue. Funciona quase sempre — e nas vezes em que não funciona, o motivo fica obscuro.

Vale entender a diferença, porque ela decide se o documento ainda se sustenta daqui a cinco anos.

## PAdES: onde a assinatura mora

PAdES é o padrão de assinatura **dentro do próprio PDF**. Um único arquivo carrega documento e assinatura, e é o formato usado na maior parte do peticionamento eletrônico brasileiro.

O outro formato que aparece é o **CAdES destacado**, o famoso `.p7s`: um arquivo separado que acompanha o documento. Dois arquivos que precisam andar juntos — se um se perde, a assinatura não confere mais.

Quando alguém diz "assinei o PDF", quase sempre é PAdES.

## As quatro políticas, do que elas realmente exigem

A ICP-Brasil publica uma lista oficial das políticas aprovadas para PDF. São dezoito entradas, em quatro famílias. A diferença entre elas é uma só pergunta: **quanta prova viaja junto do documento.**

### AD-RB — Referência Básica

Prova **quem** assinou e **que o conteúdo não mudou**. Não prova **quando**.

É a mais comum, e para peticionamento costuma bastar: os autos registram o momento do protocolo, então a data vem do sistema do tribunal, não da assinatura.

### AD-RT — Referência do Tempo

Tudo da básica, mais um **carimbo do tempo** emitido por autoridade credenciada. Passa a existir prova independente da data.

Importa quando a data é o fato em disputa — notificação, exercício de direito com prazo, documento que precisa provar anterioridade.

### AD-RC — Referências Completas

Carrega dentro do arquivo as **provas de que o certificado valia na hora da assinatura**: cadeia de certificados e listas de revogação daquele momento.

Por que isso importa: normalmente, verificar uma assinatura antiga exige consultar se o certificado estava revogado — e esses registros nem sempre continuam disponíveis anos depois. A AD-RC guarda essa prova dentro do documento, tornando a verificação autossuficiente.

### AD-RA — Referências para Arquivamento

Feita para durar décadas. Acumula carimbos do tempo sucessivos, para sobreviver ao envelhecimento dos algoritmos — um algoritmo considerado seguro hoje pode não ser em vinte anos, e cada carimbo novo reafirma o conjunto antes disso acontecer.

É a escolha para o que precisa durar mais do que a validade dos certificados envolvidos.

## Qual escolher

| Situação | Política |
|---|---|
| Petição, manifestação, recurso | AD-RB basta — os autos registram a data. |
| Notificação, documento com prazo próprio | AD-RT, pelo carimbo do tempo. |
| Contrato que vai ser verificado anos depois | AD-RC. |
| Documento de guarda permanente | AD-RA. |
| O sistema exige uma específica | A que ele pedir, sempre. |

Na dúvida e sem exigência do sistema, AD-RT é um meio-termo razoável: custa pouco a mais e resolve a pergunta "quando", que é a que mais aparece depois.

## Como saber qual política o arquivo declara

O PDF carrega essa informação, e dá para lê-la sem enviar o documento a lugar nenhum: o [conferidor de assinatura](/conferir-assinatura/) mostra a política declarada, com a sigla e o que ela exige.

Uma ressalva importante: **declarar não é cumprir.** O arquivo diz qual política segue; verificar se ele de fato cumpre exige conferir carimbo do tempo e referências, o que é outra etapa. O conferidor é explícito sobre isso, e o [validador do ITI](https://validar.iti.gov.br/) faz a verificação completa.

## Um detalhe que atrapalha quem vai atrás da fonte

A ICP-Brasil publica **três listas diferentes** de políticas aprovadas, e a mais fácil de achar é a errada para PDF:

- `LPA.xml` — só XML-DSig. Está parada desde 2016 e a maioria das políticas dela foi revogada.
- `LPA.der` — CAdES, o formato do `.p7s`.
- `LPA_PAdES.der` — **esta** é a de PDF.

Quem baixar a primeira por engano vai conferir seu PDF contra uma lista de uma década atrás, de outro formato. As entradas da lista de PAdES valem até março de 2029.

## O que isso muda na prática

Para a maior parte do trabalho, pouco: AD-RB resolve o peticionamento diário. A escolha passa a importar quando o documento precisa se defender sozinho, longe dos autos que o contextualizam — e aí a pergunta útil é "daqui a quantos anos alguém vai precisar verificar isto, e com o quê?".

Antes de qualquer política, vale a ordem: [comprimir antes de assinar](/guias/por-que-comprimir-antes-de-assinar-digitalmente/). Nenhuma delas sobrevive a um arquivo reescrito depois.
