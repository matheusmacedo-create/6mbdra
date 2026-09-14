---
title: "Juntar procuração e documentos num PDF só, sem perder assinatura"
description: "Quando vale unir os anexos em um arquivo, em que ordem apresentá-los e por que documento assinado digitalmente nunca deve entrar na junção."
updated: 2026-09-14
tags:
  - anexos
  - organização
  - assinatura digital
---

Nem todo sistema limita só o tamanho: alguns limitam a **quantidade** de anexos por petição. Aí não adianta o arquivo caber — sobram documentos.

Unir vários PDFs em um resolve. Mas há uma armadilha que custa caro se passar batido.

## A armadilha: juntar destrói assinatura digital

Juntar PDFs não é colar folhas: é **copiar as páginas para um arquivo novo**. Do ponto de vista técnico, o resultado é um documento diferente dos originais.

A consequência: **a assinatura digital não acompanha**. Uma procuração assinada com certificado, ao ser juntada com outros documentos, vira a imagem de uma assinatura dentro de um arquivo que ninguém assinou. Visualmente idêntica; juridicamente, nada.

O problema é que isso não dá erro. O arquivo é gerado, o upload funciona, e a invalidade só aparece quando alguém verifica a assinatura — possivelmente no pior momento.

Por isso o [brpdf](/juntar-pdf/) **se recusa** a juntar documento assinado. Ele detecta a assinatura, mantém o arquivo separado e avisa antes de você clicar. Não é um aviso que dá para ignorar: é bloqueio.

## Quando juntar faz sentido

- O sistema limita a quantidade de anexos por petição.
- O documento é naturalmente **um só** e foi dividido pela digitalização — contrato escaneado em três partes, por exemplo.
- Os documentos formam um conjunto que só faz sentido lido junto, e nenhum deles está assinado.

## Quando não juntar

- **Qualquer documento assinado digitalmente** está no conjunto.
- O sistema pede os anexos **separados por tipo** (petição, procuração, documentos) — juntar tudo pode causar recusa.
- Os documentos serão citados individualmente na petição, com referência ao anexo.

Na dúvida, separado é mais seguro: dá trabalho a mais no upload, mas não cria problema de validade.

## A ordem importa

Ordem de anexo não é decorativa. Quem lê segue a sequência que você apresentou, e a ordem usual de uma petição é:

1. A peça (inicial, contestação, recurso)
2. Procuração
3. Substabelecimento, se houver
4. Contrato social ou estatuto, quando a parte é pessoa jurídica
5. Documentos pessoais do representante
6. Comprovante de residência
7. Contrato ou documento que fundamenta o pedido
8. Laudos e pareceres
9. Comprovantes de pagamento
10. Certidões
11. Guias e custas

Não é norma — é convenção, e ela varia com o tipo de ação. Mas é o ponto de partida quando não há instrução específica.

A ferramenta sugere essa sequência lendo o **nome** dos arquivos: se você numerou (`01 - petição`, `02 - procuração`), a sua numeração manda; se não numerou, ela aplica a ordem acima. E a lista tem setas para você ajustar antes de juntar — a ordem da lista é exatamente a ordem do arquivo final.

## E se o arquivo juntado estourar o limite?

Cinco documentos de 3 MB viram um de 15 MB. Se o tribunal aceita 10, o arquivo juntado é comprimido até caber — e dividido em partes se nem assim couber. Juntar e caber no limite não são escolhas excludentes: acontecem na mesma passada.

## Leia também

- [Como nomear os anexos do protocolo](/guias/como-nomear-anexos-do-protocolo/) — a numeração que orienta a ordem
- [Por que comprimir antes de assinar](/guias/por-que-comprimir-antes-de-assinar-digitalmente/)
- [Limite por arquivo, por página e por petição](/guias/limite-por-arquivo-pagina-e-peticao/)
