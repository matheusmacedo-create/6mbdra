---
title: "Como girar a página de um PDF que ficou de cabeça para baixo"
description: "Formas gratuitas de corrigir a rotação de uma ou mais páginas de um PDF digitalizado, sem instalar programa pago e sem enviar o arquivo para a internet."
updated: 2026-09-14
tags:
  - girar pdf
  - digitalização
  - organização
---

É um problema pequeno que ocupa um tempo desproporcional: um lote de dez páginas digitalizadas no alimentador automático, e uma delas — quase sempre a que foi colocada de forma diferente das outras — sai de cabeça para baixo ou deitada. O documento está correto, só a orientação está errada.

## Por que não basta girar a visualização

No Adobe Reader, **Exibir → Rotação → Girar no Sentido Horário** muda como a página aparece *na tela naquele momento*, mas não altera o arquivo. Ao fechar e abrir de novo, a página volta a nascer torta — e se esse PDF for anexado assim ao processo, quem abrir do outro lado vê exatamente o mesmo problema. É preciso uma ferramenta que grave a rotação dentro do arquivo, não só na exibição.

## LibreOffice Draw (gratuito, funciona offline)

1. Abra o PDF com o LibreOffice Draw (botão direito no arquivo → Abrir com).
2. Cada página do PDF vira uma página do Draw, navegável pelo painel de miniaturas à esquerda.
3. Selecione a página torta, clique nela para ativar a seleção e use **Formatar → Girar ou Inclinar**, ou simplesmente arraste a alça de rotação que aparece nos cantos da seleção.
4. Exporte de novo como PDF (**Arquivo → Exportar como → Exportar como PDF**).

É gratuito, roda inteiramente no computador e não exige conta em lugar nenhum — o caminho mais indicado quando o documento tem informação sigilosa.

## Linha de comando, para quem já usa terminal

Para quem tem `qpdf` instalado (gratuito, código aberto), girar uma página específica é uma linha só:

```
qpdf --rotate=+90:3 original.pdf corrigido.pdf
```

Isso gira 90 graus a página 3 do arquivo, mantendo todas as outras como estavam. É a opção mais rápida quando o PDF tem muitas páginas e só uma ou duas precisam de ajuste, porque evita reabrir o documento inteiro num editor visual.

## Ferramentas online: quando evitar

Sites como conversores gratuitos de "girar PDF" resolvem o problema em poucos cliques, mas recebem o arquivo inteiro num servidor de terceiros antes de devolver o resultado. Para a maioria dos documentos isso não é um risco relevante, mas vale a mesma regra de sempre: se o processo corre em segredo de justiça ou o documento tem dado sensível, prefira uma ferramenta que rode no computador, como o LibreOffice Draw ou o `qpdf`.

## Depois de girar, confira três coisas

- **A ordem das páginas continua a mesma?** Alguns editores reorganizam sem avisar ao exportar; confira numerando mentalmente antes e depois.
- **O texto pesquisável sobreviveu?** Se o PDF original tinha OCR, abra o resultado e teste Ctrl+F com uma palavra do documento. Veja [o que é OCR e texto pesquisável](/guias/o-que-e-ocr-e-texto-pesquisavel-no-pdf/) se a busca não encontrar nada.
- **O tamanho do arquivo não disparou.** Reexportar um PDF em outro programa às vezes aumenta o peso, especialmente se o editor reprocessa as imagens internamente. Se isso acontecer, o [brpdf](/comprimir-pdf/) resolve na etapa seguinte.

## Prevenindo para a próxima digitalização

Página de cabeça para baixo quase sempre nasce no alimentador automático do scanner, quando uma folha entra virada no meio do lote. Conferir a orientação de cada folha antes de colocar no alimentador evita o retrabalho — e para digitalizações feitas pelo celular, os aplicativos de escaneamento corrigem a perspectiva automaticamente, o que já elimina boa parte desse problema. Veja [como digitalizar com tamanho menor e boa legibilidade](/guias/como-digitalizar-documentos-com-tamanho-menor-e-boa-legibilidade/) para o processo completo.

## Leia também

- [Digitalizar pelo celular sem gerar um arquivo gigante](/guias/digitalizar-pelo-celular-sem-arquivo-gigante/)
- [Checklist antes de protocolar anexos em PDF](/guias/checklist-antes-de-protocolar-anexos-em-pdf/)
- [Comprimir PDF para protocolo](/comprimir-pdf/)
