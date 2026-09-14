---
title: "Como nomear os anexos do protocolo para o sistema não recusar"
description: "Acento, espaço e caractere especial em nome de arquivo derrubam upload em alguns portais. Um padrão simples que funciona em qualquer sistema de peticionamento."
updated: 2026-09-14
tags:
  - peticionamento
  - organização
  - anexos
---

Nome de arquivo parece detalhe até o portal recusar o anexo sem dizer por quê — ou aceitar e, depois, gerar um documento com o nome truncado no meio.

Não existe uma regra única: cada sistema é rigoroso de um jeito. Como não dá para saber de antemão qual vai implicar, a saída é adotar um padrão que passa em todos.

## O que costuma dar problema

- **Acento e cedilha.** `petição_inicial.pdf`, `procuração.pdf`. Dependendo de como o sistema lê o nome, os caracteres viram símbolos estranhos ou o upload falha.
- **Espaço.** Alguns portais convertem em `%20` e o nome fica ilegível no processo.
- **Símbolos.** `#`, `&`, `%`, `/`, `\`, `:`, `*`, `?`, `"`, `<`, `>`, `|` têm significado especial em endereços de internet ou em sistemas de arquivos.
- **Nome longo demais.** Caminho completo muito extenso pode ser cortado, e `contrato_de_prestacao_de_servicos_assinado_pelas_partes_em_2026_via_1.pdf` vira algo irreconhecível.
- **Ponto no meio.** `doc.v2.final.pdf` confunde sistemas que assumem que o texto depois do último ponto é a extensão.

## O padrão que funciona em qualquer lugar

```
NN_tipo-do-documento.pdf
```

- **`NN`** — dois dígitos com a ordem de protocolo: `01`, `02`, `03`. Garante que os arquivos aparecem na ordem certa em qualquer listagem, e deixa explícita a sequência para quem vai ler.
- **`tipo-do-documento`** — sem acento, sem espaço, tudo minúsculo, palavras separadas por hífen ou sublinhado.
- **`.pdf`** — um ponto só, no fim.

Exemplos:

```
01_peticao-inicial.pdf
02_procuracao.pdf
03_contrato-social.pdf
04_rg-do-representante.pdf
05_comprovante-de-residencia.pdf
06_guia-de-custas.pdf
```

Para documento dividido em partes, mantenha a numeração do conjunto e acrescente a da parte:

```
03_contrato-social_parte_01_de_03.pdf
03_contrato-social_parte_02_de_03.pdf
03_contrato-social_parte_03_de_03.pdf
```

## Por que numerar com dois dígitos

Sem o zero à esquerda, a ordenação alfabética embaralha: `1`, `10`, `11`, `2`, `3`. Com dois dígitos, `01` a `99` ficam sempre na sequência correta. Se o processo tiver mais de cem anexos, use três.

## Numerar também ajuda quem lê

A ordem dos anexos em uma petição não é decorativa: o juiz e o servidor leem na sequência em que você apresentou. Um conjunto numerado e nomeado por tipo é lido mais rápido e reduz a chance de um documento passar despercebido.

É o oposto de anexar `scan0001.pdf`, `scan0002.pdf`, `IMG_20260914.pdf` — nomes que não dizem nada e obrigam quem lê a abrir cada um para descobrir o que é.

## A ferramenta já faz isso

Ao baixar o lote em ZIP, o [brpdf](/) entrega os arquivos já numerados na ordem da lista, com os nomes normalizados — sem acento, sem espaço —, os documentos divididos em pasta própria e um `LEIA-ME.txt` com o resumo do que foi feito em cada um.

Se você [juntar tudo em um PDF só](/juntar-pdf/), a ordem da lista também é a ordem do arquivo final, e a ferramenta sugere uma sequência lendo o nome dos arquivos: numeração que você escreveu vem primeiro; sem ela, vale a ordem usual de uma petição.

## Antes de anexar

1. Os nomes estão sem acento, sem espaço e sem símbolo?
2. A numeração reflete a ordem em que os documentos devem ser lidos?
3. O tipo do documento está no nome, de forma reconhecível?
4. Cada arquivo abre normalmente?

O [checklist completo](/guias/checklist-antes-de-protocolar-anexos-em-pdf/) cobre o resto da conferência.
