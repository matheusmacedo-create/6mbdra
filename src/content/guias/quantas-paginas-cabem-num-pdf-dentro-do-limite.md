---
title: "Quantas páginas cabem num PDF dentro do limite do tribunal"
description: "Estimativas realistas de quantas páginas cabem num PDF de acordo com o tipo de conteúdo, e por que a conta muda demais para confiar numa regra fixa."
updated: 2026-09-15
tags:
  - tamanho de arquivo
  - peticionamento
  - limites
---

Antes de digitalizar um processo inteiro ou reunir um lote de anexos, é natural querer saber de antemão: isso vai caber no limite do tribunal? A resposta certa é "depende", mas depende de fatores previsíveis o suficiente para dar uma estimativa útil antes de começar.

## O que muda o tamanho por página, na prática

O mesmo número de páginas pode gerar arquivos com tamanhos completamente diferentes, porque o que pesa não é a página — é o que está nela:

| Tipo de conteúdo | Tamanho aproximado por página | Páginas estimadas em 10 MB |
| --- | --- | --- |
| Texto nativo (Word/LibreOffice, sem imagem) | 10–50 KB | 200 a mais de 1.000 |
| Digitalização em preto e branco, 200 dpi | 50–150 KB | 65 a 200 |
| Digitalização colorida, 200–300 dpi | 300 KB–1 MB | 10 a 30 |
| Digitalização colorida em alta resolução (600 dpi ou mais) | 1–3 MB | 3 a 10 |

Esses números são estimativas, não uma regra fixa — dois documentos digitalizados na mesma resolução podem variar bastante dependendo do scanner, da quantidade de texto versus área em branco na página e de quanto a imagem foi comprimida na origem.

## Por que vale mais a pena testar do que calcular

Fazer conta antes de digitalizar ajuda a decidir a resolução certa de saída, mas a forma confiável de saber se um documento cabe é comprimi-lo e conferir o resultado, não estimar de cabeça. Isso porque a compressão não é proporcional: um PDF com muita área de texto e pouca imagem pode cair drasticamente de tamanho ao ser otimizado, enquanto um PDF já compacto na origem quase não muda. O [brpdf](/comprimir-pdf/) faz esse teste em segundos, sem sair do navegador — é mais rápido e mais preciso do que qualquer estimativa.

## MB, MiB e a margem que falta

Parte da confusão em "quantas páginas cabem" vem de um detalhe que passa despercebido: o limite informado pelo tribunal e o tamanho mostrado pelo computador nem sempre usam a mesma unidade. Um arquivo que aparenta caber por pouco pode estourar o limite real por causa dessa diferença. Veja [MB ou MiB: por que seu PDF é recusado no limite de upload](/guias/diferenca-entre-mb-e-mib-nos-portais-de-upload/) para entender a diferença antes de fazer qualquer conta de capacidade.

## Três limites, não um só

Além do limite por arquivo, muitos sistemas também limitam o número de páginas de um único documento e a soma de todos os anexos de uma petição — um PDF que cabe tranquilamente sozinho pode ainda assim ser recusado se o lote inteiro ultrapassar o teto da petição. Veja [limite por arquivo, por página e por petição](/guias/limite-por-arquivo-pagina-e-peticao/) para os três tipos e como conferir cada um antes de protocolar.

## Resistir à tentação de reduzir demais a resolução

Diminuir a resolução da digitalização "para caber mais páginas" tem um limite prático: abaixo de um certo ponto, o documento perde legibilidade — texto pequeno vira mancha, assinatura fica ilegível, carimbo perde os detalhes. É melhor dividir o arquivo em partes do que entregar um documento tecnicamente dentro do limite, mas difícil de ler. Veja [como digitalizar com tamanho menor e boa legibilidade](/guias/como-digitalizar-documentos-com-tamanho-menor-e-boa-legibilidade/) para o equilíbrio certo entre tamanho e nitidez.

## Antes de começar, confira o limite do sistema

Cada sistema de peticionamento tem seu próprio limite, e alguns variam por tribunal mesmo dentro do mesmo sistema. Consulte a página do [seu tribunal](/tribunais/) ou do [sistema usado](/sistemas/) antes de estimar quantas páginas cabem — a estimativa só é útil quando comparada a um número real, não a uma suposição.

## Leia também

- [MB ou MiB? Por que seu PDF é recusado no limite de upload](/guias/diferenca-entre-mb-e-mib-nos-portais-de-upload/)
- [Limite por arquivo, por página e por petição](/guias/limite-por-arquivo-pagina-e-peticao/)
- [Comprimir PDF para protocolo](/comprimir-pdf/)
