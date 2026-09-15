---
title: "Como converter uma tabela em PDF para Excel"
description: "Extrato bancário, cálculo de liquidação ou tabela de precatório em PDF: como levar os números para o Excel sem redigitar, e por que sempre conferir o resultado."
updated: 2026-09-15
tags:
  - conversão
  - excel
  - cálculo
---

Extrato bancário anexado ao processo, planilha de cálculo de liquidação enviada pela perícia, tabela de precatório publicada em PDF pelo tribunal — em algum momento esses números precisam ir para uma planilha, para conferir, recalcular ou usar em outra peça. Redigitar tudo é lento e é onde mais se erra um dígito.

## O primeiro passo: descobrir se o PDF tem texto ou é imagem

Isso muda completamente o caminho. Abra o PDF e tente **selecionar um trecho da tabela com o mouse**:

- **Se o texto fica destacado em azul e dá para copiar** — é um PDF nativo, gerado direto de uma planilha ou sistema. O caminho é simples.
- **Se nada é selecionável e o texto parece "colado" na página** — é uma digitalização (imagem), e precisa de OCR antes de virar tabela editável. Veja o [guia sobre OCR](/guias/o-que-e-ocr-e-texto-pesquisavel-no-pdf/) para entender essa etapa.

## PDF nativo: copiar e colar direto

Na maioria dos casos, selecionar a tabela inteira, copiar e colar diretamente numa planilha do Excel ou do Google Sheets já preserva linhas e colunas razoavelmente bem. Quando o resultado sai desalinhado — o mais comum é colunas se misturando em uma só —, duas alternativas costumam resolver:

- **Colar como texto** e usar a função de "texto para colunas" da planilha, separando por espaço ou tabulação.
- Ferramentas de conversão de PDF para Excel dedicadas, que reconhecem a estrutura da tabela em vez de tratar tudo como texto corrido — úteis quando a tabela é grande ou tem muitas colunas.

## PDF escaneado: precisa de OCR antes

Se a tabela veio de uma digitalização (por exemplo, um extrato impresso e fotografado), não existe "copiar e colar" possível antes de rodar OCR — o arquivo, tecnicamente, não tem texto, só uma imagem que parece texto. Depois do OCR, o resultado ainda tende a errar mais em tabelas do que em texto corrido, porque o reconhecimento de linhas e colunas é mais sensível a desalinhamento na digitalização original.

## A regra que não pode ser pulada: conferir número por número

Toda extração automática de tabela — mesmo a partir de PDF nativo — comete erros sutis com frequência maior do que se espera: casas decimais deslocadas, colunas invertidas, células mescladas viradas uma só. Para uso interno isso é um incômodo; para um cálculo que vai instruir uma petição ou embasar uma liquidação, é risco real. Depois de converter, confira contra o PDF original pelo menos os totais e algumas linhas ao acaso antes de usar os números em qualquer peça.

## Leia também

- [O que é OCR e texto pesquisável no PDF](/guias/o-que-e-ocr-e-texto-pesquisavel-no-pdf/)
- [Converter PDF escaneado em Word editável](/guias/converter-pdf-escaneado-em-word-editavel/)
