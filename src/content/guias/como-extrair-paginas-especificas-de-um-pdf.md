---
title: "Como extrair só as páginas que interessam de um PDF"
description: "A diferença entre extrair páginas e dividir por tamanho, e como selecionar só o trecho relevante de um PDF longo antes de anexar ao processo."
updated: 2026-09-15
tags:
  - extrair páginas
  - organização
  - anexos
---

Um processo administrativo de 300 páginas, mas só o parecer final e o despacho interessam para a petição. Anexar o PDF inteiro funciona, mas deixa o arquivo desnecessariamente pesado e obriga quem lê a procurar o trecho relevante no meio do resto. Extrair só as páginas que importam resolve os dois problemas.

## Extrair não é o mesmo que dividir

A ferramenta de [dividir PDF](/dividir-pdf/) do brpdf corta um arquivo grande demais em partes **sequenciais**, mantendo o conteúdo inteiro — página 1 a 30 na parte 1, 31 a 60 na parte 2, e assim por diante. É a solução certa quando o documento inteiro precisa ser protocolado, mas não cabe no limite de tamanho.

Extrair páginas é diferente: é escolher **quais** páginas ficam e **quais** são descartadas, porque o resto do documento não tem relevância para aquela petição específica. O resultado não é o documento inteiro em partes — é um recorte dele.

## Como extrair, sem programa pago

**LibreOffice Draw.** Abra o PDF (botão direito → Abrir com → LibreOffice Draw). Cada página aparece como um slide no painel lateral. Clique com o botão direito nas páginas que não interessam e escolha excluir. Exporte o que sobrou como PDF (Arquivo → Exportar como → Exportar como PDF).

**Preview, no Mac.** Abra o PDF, mostre a barra lateral de miniaturas, selecione as páginas que devem ficar (Cmd+clique para selecionar várias não seguidas) e arraste para um novo documento vazio, ou use Arquivo → Imprimir apenas com o intervalo selecionado, salvando como PDF.

**`qpdf`, para quem usa terminal.** Extrai um intervalo exato numa linha só:

```
qpdf original.pdf --pages original.pdf 42-58 -- trecho.pdf
```

Isso gera um novo arquivo só com as páginas 42 a 58 do original — útil quando o número das páginas já é conhecido, por exemplo depois de localizar o trecho relevante num leitor de PDF comum.

Evite ferramentas online de "extrair páginas de PDF" quando o documento original tem informação sigilosa: o arquivo inteiro precisa ser enviado ao servidor antes de a extração acontecer, mesmo que o resultado final tenha só duas páginas.

## Nomeando o recorte

Um PDF extraído perde o contexto do documento de origem se o nome do arquivo não deixar isso claro. Em vez de salvar como `documento.pdf`, um nome como `parecer-tecnico_processo-adm-1234_fls-42-58.pdf` deixa registrado, só pelo nome, de onde veio o trecho e quais páginas ele representa — o que ajuda inclusive se precisar localizar o documento completo depois. Veja [como nomear os anexos do protocolo](/guias/como-nomear-anexos-do-protocolo/) para o padrão completo.

## Transparência com o trecho extraído

Quando a petição anexa só uma parte de um documento maior, vale mencionar isso no próprio texto da peça — "anexa-se o parecer técnico (fls. 42 a 58 do processo administrativo nº XXXX), sendo o processo administrativo completo disponibilizado mediante requisição" — para que fique claro que a seleção foi deliberada, e não uma tentativa de omitir conteúdo. Mantenha o documento completo disponível, porque a parte adversa ou o juízo pode pedir o restante.

## Depois de extrair

Extrair páginas não comprime o arquivo — se o trecho selecionado ainda tiver imagens pesadas (digitalização em alta resolução, por exemplo), o tamanho final pode continuar acima do limite do sistema. Nesse caso, o [brpdf](/comprimir-pdf/) reduz o arquivo já extraído até a margem segura do tribunal escolhido.

## Leia também

- [Como dividir PDF por tamanho sem perder a ordem](/guias/como-dividir-pdf-por-tamanho-sem-perder-a-ordem/)
- [Como nomear os anexos do protocolo](/guias/como-nomear-anexos-do-protocolo/)
- [Dividir PDF por tamanho](/dividir-pdf/)
