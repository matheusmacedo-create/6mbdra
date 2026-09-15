---
title: "Como converter PDF escaneado em Word editável"
description: "Como transformar um PDF de imagem em texto editável no Word usando OCR, quando isso funciona de verdade e por que o original continua sendo o anexo oficial."
updated: 2026-09-15
tags:
  - OCR
  - converter pdf
  - Word
---

Uma petição antiga que só existe em PDF escaneado, um contrato recebido pronto que precisa virar minuta editável, um modelo de peça de outro escritório salvo apenas como imagem — em todos esses casos, reaproveitar o texto significa primeiro transformar o PDF de imagem em algo que o Word consiga editar de verdade, não só exibir.

## Por que "abrir no Word" às vezes não funciona

O Word consegue abrir um arquivo PDF diretamente (Arquivo → Abrir → escolher o PDF) e convertê-lo automaticamente. Isso funciona bem **quando o PDF já tem uma camada de texto** — ou seja, quando já passou por OCR antes, mesmo que pareça só uma imagem na tela. Num PDF de imagem pura, sem essa camada, o resultado sai vazio, cheio de erros ou como uma imagem colada dentro do documento do Word, porque não existe texto nenhum para extrair. Para entender a diferença entre os dois tipos de PDF, veja [o que é OCR e texto pesquisável no PDF](/guias/o-que-e-ocr-e-texto-pesquisavel-no-pdf/).

## Quando o PDF ainda não tem OCR

**Google Docs** é o caminho mais simples para quem não tem problema em usar um serviço na nuvem: envie o PDF para o Google Drive, clique com o botão direito e escolha **Abrir com → Google Docs**. O Google roda OCR automaticamente ao abrir, mesmo em arquivos sem camada de texto nenhuma, e o resultado já sai como um documento editável — que pode ser baixado depois em formato `.docx`. O reconhecimento em português costuma funcionar bem em texto datilografado ou impresso nítido.

**ocrmypdf**, gratuito e de código aberto, roda inteiramente no computador: adiciona uma camada de texto pesquisável ao PDF sem enviar nada para servidor nenhum. Depois de rodar essa ferramenta, o PDF resultante já pode ser aberto diretamente no Word ou no LibreOffice com o texto reconhecido. É o caminho indicado quando o documento tem informação sigilosa ou corre em segredo de justiça, porque nada sai da máquina.

## Sempre revise depois de converter

OCR erra — em assinatura manuscrita, carimbo, tabela mal alinhada, papel amassado ou letra pequena demais. O texto que sai do reconhecimento precisa ser conferido palavra por palavra contra o documento original antes de virar a base de qualquer peça nova, porque um erro de reconhecimento vira um erro de digitação invisível: ninguém "digitou" errado, mas o resultado é o mesmo.

Vale conferir com atenção especial:

- **Números** (valores, datas, números de processo) — são os que mais custam caro quando saem errados.
- **Nomes próprios**, principalmente com acento ou grafia menos comum.
- **Tabelas**, que o OCR costuma desmontar, perdendo o alinhamento entre colunas.

## O documento convertido não substitui o original

O texto em Word gerado por OCR serve para **reaproveitar conteúdo** — editar, adaptar, citar em outra peça —, não para protocolar no lugar do documento original. Se o PDF escaneado é o próprio anexo do processo, ele continua sendo a versão oficial; a conversão para Word é uma ferramenta de trabalho do escritório, que fica de fora do protocolo.

## Leia também

- [O que é OCR e texto pesquisável no PDF](/guias/o-que-e-ocr-e-texto-pesquisavel-no-pdf/)
- [Como digitalizar documentos com tamanho menor e boa legibilidade](/guias/como-digitalizar-documentos-com-tamanho-menor-e-boa-legibilidade/)
- [O que fazer com PDF com senha, assinado ou corrompido](/guias/pdf-com-senha-assinado-ou-corrompido-o-que-fazer/)
