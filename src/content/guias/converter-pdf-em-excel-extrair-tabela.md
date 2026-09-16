---
title: "Como converter PDF em Excel (extrair tabela de um PDF)"
description: "Como levar uma tabela de um PDF (extrato, cálculo de liquidação, planilha de atualização) para o Excel, e por que copiar e colar desalinha as colunas."
updated: 2026-09-15
tags:
  - converter pdf
  - Excel
  - planilha
---

Extrato bancário anexado pela parte contrária, memória de cálculo de liquidação, planilha de atualização monetária que o próprio tribunal manda em PDF — em todos esses casos, o número que interessa está preso numa tabela que não dá para editar, e refazer tudo à mão é o tipo de trabalho que ninguém quer fazer duas vezes.

## Por que copiar e colar quase sempre sai errado

Selecionar a tabela no leitor de PDF, copiar e colar direto no Excel parece o caminho óbvio, mas o resultado comum é uma bagunça: tudo cai numa única coluna, ou os números de colunas diferentes se misturam na mesma célula. Isso acontece porque um PDF não guarda "linhas e colunas" como uma planilha — guarda posições de texto na página, e cada leitor decide sozinho como agrupar isso ao copiar.

Quando o resultado colado vem como texto corrido, o comando **Dados → Texto para colunas** do Excel ajuda a separar por espaço, tabulação ou outro caractere repetido — mas só funciona bem em tabelas simples, com poucas colunas e sem células vazias no meio.

## O caminho mais confiável: importar o PDF direto no Excel

O Excel para Windows (versões 365 e 2019 em diante) tem um conector nativo para PDF, sem precisar de nenhum programa extra:

1. **Dados → Obter Dados → De Arquivo → De PDF.**
2. Escolha o arquivo. O Excel abre um **Navegador** mostrando cada página e cada tabela que conseguiu identificar automaticamente, com uma prévia ao lado.
3. Selecione a tabela certa e clique em **Carregar** para trazer os dados prontos para uma planilha nova, já em colunas separadas.

Esse recurso usa o Power Query por trás, o mesmo motor que o Excel usa para importar de banco de dados ou de outra planilha — por isso o resultado sai bem mais organizado do que um copiar e colar simples.

**No Mac**, esse conector específico "De PDF" nem sempre está disponível dependendo da versão do Excel instalada. Quando faltar, o caminho é o copiar e colar seguido de Texto para colunas, ou abrir o mesmo arquivo numa cópia do Excel para Windows (na nuvem, por exemplo) só para essa extração.

## Quando a tabela vem de um PDF escaneado

Nada disso funciona se o PDF for uma imagem — uma tabela fotografada ou escaneada sem OCR não tem texto nenhum para o Excel ler, só um desenho da tabela. Nesse caso, o passo anterior é gerar a camada de texto pesquisável primeiro; veja [como converter PDF escaneado em Word editável](/guias/converter-pdf-escaneado-em-word-editavel/), que explica o mesmo processo de OCR usado antes de qualquer extração de tabela. Mesmo depois do OCR, tabelas costumam sair desalinhadas — o reconhecimento identifica o texto, mas erra a organização em colunas com frequência maior do que em texto corrido.

## Sempre confira os números depois

Uma tabela extraída de PDF — por Power Query, por cópia manual ou depois de OCR — precisa ser conferida célula por célula contra o documento original antes de entrar em qualquer cálculo da petição. Uma coluna que desliza uma linha para cima ou para baixo na importação produz um erro de valor que não aparece em nenhuma revisão visual rápida, só quando alguém confere o total contra o documento de origem.

## Leia também

- [Como converter PDF escaneado em Word editável](/guias/converter-pdf-escaneado-em-word-editavel/)
- [O que é OCR e texto pesquisável no PDF](/guias/o-que-e-ocr-e-texto-pesquisavel-no-pdf/)
- [Como extrair só as páginas que interessam de um PDF](/guias/como-extrair-paginas-especificas-de-um-pdf/)
