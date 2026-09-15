---
title: "Como numerar as páginas do PDF antes de protocolar"
description: "Quando faz sentido numerar as páginas de um anexo em PDF, a diferença para a numeração automática dos autos e como adicionar números sem custo."
updated: 2026-09-14
tags:
  - numeração de páginas
  - peticionamento
  - organização
---

"Vide fls. 42" só funciona se a folha 42 existir de verdade no documento. Em laudos periciais, contratos extensos ou processos administrativos anexados por inteiro, numerar as páginas antes de protocolar é o que permite à petição referenciar um trecho específico sem obrigar quem lê a procurar manualmente.

## Duas numerações diferentes, que se confundem

**A numeração dos autos** é automática: ao protocolar, o sistema (PJe, e-SAJ, eproc, Projudi) atribui um número de folha ao documento inteiro dentro do processo eletrônico. Isso não depende de nada que o advogado faça no arquivo — é o sistema que numera, e essa numeração só existe depois do protocolo.

**A numeração dentro do próprio PDF** é outra coisa: são números impressos no rodapé ou cabeçalho de cada página do documento, decididos por quem produziu o arquivo, e existem antes mesmo de o documento ser anexado. É essa numeração que faz sentido quando a petição vai citar uma página específica de um anexo longo — porque o número citado tem que bater com o que a pessoa do outro lado vai ver ao abrir o PDF, e não com a numeração dos autos, que muda dependendo de onde o documento foi inserido no processo.

## Quando vale a pena numerar

- **Laudos periciais e pareceres técnicos** longos, quando a petição vai discutir um trecho específico ("conforme fl. 15 do laudo").
- **Contratos e aditivos** anexados por inteiro, quando cláusulas específicas serão citadas na argumentação.
- **Processos administrativos ou inquéritos** anexados como prova, em que remeter a uma página exata evita que o juiz precise ler o documento inteiro para achar o ponto citado.

Para um anexo curto — uma procuração, um RG, um comprovante — numerar não agrega nada; o documento é identificado pelo nome do arquivo, não por número de página.

## Se o documento nasceu no Word ou LibreOffice

O caminho mais simples é numerar **antes** de exportar para PDF, porque o editor de texto já tem campo de numeração de página pronto:

- **Word**: Inserir → Número de Página, escolhendo posição (rodapé é o mais comum em peças jurídicas) e formato.
- **LibreOffice Writer**: Inserir → Cabeçalho e Rodapé para ativar o rodapé, depois Inserir → Campo → Número de Página dentro dele.

Depois disso, exporte normalmente para PDF — a numeração já sai gravada no arquivo. Veja [como converter Word em PDF antes de protocolar](/guias/converter-word-para-pdf-antes-de-protocolar/) para os detalhes da exportação.

## Se o documento já é um PDF (escaneado ou recebido de terceiro)

Quando não há mais acesso ao arquivo de origem — um laudo recebido pronto, um contrato só em PDF — a numeração precisa ser aplicada sobre o PDF existente:

- **PDFsam Basic**, gratuito e de código aberto, tem uma função de carimbar número em cada página, rodando localmente no computador.
- **LibreOffice Draw** permite inserir uma caixa de texto com o número em cada página manualmente — funciona, mas é trabalhoso em documentos longos, então vale mais a pena para poucos casos pontuais.
- Ferramentas online de "numerar PDF" existem e são rápidas, mas, como em qualquer upload para servidor de terceiros, evite para documento sigiloso ou em segredo de justiça.

## Depois de numerar

Confira se a sequência bate com a ordem real das páginas — um erro comum é numerar antes de reorganizar o documento, ou vice-versa, e a petição acaba citando um número que não corresponde a mais nada. E se o arquivo carimbado cresceu de tamanho, o [brpdf](/comprimir-pdf/) resolve isso na etapa seguinte, sem afetar os números já gravados.

## Leia também

- [Como nomear os anexos do protocolo](/guias/como-nomear-anexos-do-protocolo/)
- [Checklist antes de protocolar anexos em PDF](/guias/checklist-antes-de-protocolar-anexos-em-pdf/)
- [Dividir PDF por tamanho](/dividir-pdf/)
