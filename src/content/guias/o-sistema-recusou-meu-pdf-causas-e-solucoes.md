---
title: "O sistema recusou meu PDF: as causas e o que fazer em cada uma"
description: "Arquivo grande demais, formato inválido, nome com caractere proibido, PDF com senha: as recusas mais comuns no peticionamento eletrônico e a saída de cada uma."
updated: 2026-09-14
tags:
  - peticionamento
  - erro de upload
  - PJe
---

A mensagem aparece sempre na pior hora: o anexo é recusado, o prazo está correndo, e o sistema não explica o motivo — ou explica de um jeito que não ajuda ("falha ao enviar o documento").

A boa notícia é que a lista de causas é curta. Quase toda recusa cai em um destes casos, e todos têm solução em minutos.

## 1. O arquivo passa do limite

É a causa mais comum, e a mais fácil de confundir, porque **o limite não é o mesmo em todo lugar**. Um tribunal aceita 10 MB, o vizinho aceita 1,5 MB, e o mesmo tribunal pode ter limite diferente por instância.

O que fazer:

1. Descubra o limite do seu caso na [tabela por sistema](/sistemas/) ou no [diretório por tribunal](/tribunais/).
2. [Comprima o PDF](/comprimir-pdf/) mirando **um pouco abaixo** do limite, não o valor exato — o motivo está no item 2.
3. Se nem comprimido couber, [divida em partes](/dividir-pdf/) por páginas inteiras.

## 2. O arquivo parece caber, mas é recusado

Você vê "5,9 MB" na tela, o sistema aceita "até 6 MB", e mesmo assim recusa. Não é bug: existem duas contas diferentes para "megabyte", e a diferença é de quase 5%.

É o suficiente para derrubar um upload no limite exato. Por isso a recomendação é sempre deixar folga. O assunto está detalhado em [MB ou MiB?](/guias/diferenca-entre-mb-e-mib-nos-portais-de-upload/).

## 3. O PDF exige senha para abrir

Sistemas de peticionamento não conseguem processar arquivo protegido por senha de abertura — e não deveriam mesmo, porque não teriam como indexar o conteúdo.

O que fazer: abra o documento no programa de origem com a senha, salve uma cópia **sem** proteção e anexe essa cópia. Se o arquivo veio de terceiro e você não tem a senha, peça uma via sem proteção a quem enviou.

Atenção a um caso que confunde: existe PDF que **abre normalmente** mas tem restrição de edição ou impressão. Esse costuma ser aceito no upload, mas pode travar a compressão. Mais sobre isso em [PDF com senha, assinado ou corrompido](/guias/pdf-com-senha-assinado-ou-corrompido-o-que-fazer/).

## 4. O documento está assinado digitalmente e você tentou alterá-lo

Assinatura digital garante que o arquivo não mudou depois de assinado. Qualquer alteração — inclusive comprimir — quebra essa garantia. O sistema pode aceitar o upload e a assinatura aparecer como inválida depois, o que é pior do que a recusa.

A ordem correta é: **prepare primeiro, assine depois**. Se o documento já chegou assinado e não cabe, as saídas são dividir em partes (e assinar cada parte, se a assinatura precisa valer) ou pedir nova via ao emissor. Veja [por que comprimir antes de assinar](/guias/por-que-comprimir-antes-de-assinar-digitalmente/).

## 5. O nome do arquivo tem caractere que o sistema não aceita

Alguns portais recusam nomes com acento, cedilha, espaço ou símbolo. Outros aceitam no upload e quebram depois, na hora de gerar o documento do processo.

Como não dá para saber de antemão qual portal é rigoroso, a regra segura é padronizar sempre: sem acento, sem espaço, sem caractere especial. O tema tem guia próprio: [como nomear os anexos](/guias/como-nomear-anexos-do-protocolo/).

## 6. O formato não é PDF de verdade

Renomear `documento.jpg` para `documento.pdf` não converte nada — o sistema lê o conteúdo, não a extensão, e recusa. O mesmo vale para arquivo interrompido no meio do download ou da digitalização: ele tem extensão `.pdf` mas a estrutura está incompleta.

O que fazer: gere o PDF de novo a partir do original, pelo programa que criou o documento ou pelo scanner.

## 7. O tribunal exige PDF/A e você enviou PDF comum

Alguns sistemas exigem PDF/A na petição inicial. Se for o caso do seu, o upload é recusado mesmo com o arquivo pequeno e íntegro. A página do seu tribunal no [diretório](/tribunais/) informa quando essa exigência existe, e o [guia de PDF/A](/guias/pdf-a-quando-o-tribunal-exige/) explica como converter.

## 8. A soma dos anexos passou do limite da petição

Existe sistema que limita **o conjunto**, não só cada arquivo. Você anexa cinco documentos de 2 MB, todos dentro do limite individual, e a petição de 10 MB é recusada.

Nesse caso, ou você reduz mais os arquivos, ou protocola em mais de uma petição. A diferença entre os três tipos de limite está em [limite por arquivo, por página e por petição](/guias/limite-por-arquivo-pagina-e-peticao/).

## Um roteiro para não repetir o problema

Antes de abrir o sistema:

1. Confira o limite do seu tribunal e da sua instância.
2. Prepare os arquivos com folga em relação ao limite.
3. Padronize os nomes.
4. Assine por último.
5. Confira se cada PDF abre normalmente antes de anexar.

O [checklist antes de protocolar](/guias/checklist-antes-de-protocolar-anexos-em-pdf/) traz a versão completa dessa lista.
