---
title: "Assinatura inválida ou documento alterado: o que fazer"
description: "O PDF assinado aparece como alterado ou com assinatura inválida. As seis causas reais, como descobrir qual é a sua e o que dá (ou não dá) para recuperar."
updated: 2026-09-16
tags:
  - assinatura digital
  - ICP-Brasil
  - erro de upload
  - peticionamento
---

O aviso aparece na hora errada: você abre o PDF assinado e o leitor informa que o documento foi alterado, ou o sistema do tribunal recusa a peça com "assinatura inválida".

A boa notícia é que nem todo aviso desses significa documento estragado. Duas das causas mais comuns não têm nada a ver com o arquivo. A má notícia é que uma delas não tem conserto, e é melhor descobrir isso agora do que na véspera do prazo.

## Primeiro, descubra qual é o seu caso

Antes de qualquer coisa, [passe o arquivo pelo conferidor](/verificar-assinatura-digital/). Ele roda no navegador, não envia o documento e distingue as duas situações que os leitores de PDF costumam misturar:

- **"O documento foi alterado depois de assinado"** — o conteúdo mudou de verdade. Causas 1 a 3 abaixo.
- **"Não foi possível concluir a conferência"** — a verificação não chegou a rodar. Isso **não** é um documento com problema.

Essa distinção é a parte que mais economiza tempo. Um leitor de PDF que não tem a cadeia da ICP-Brasil instalada mostra alerta para arquivo perfeitamente íntegro, e quem não sabe disso refaz trabalho à toa.

## As seis causas, da mais comum à mais rara

### 1. O arquivo foi comprimido depois de assinado

De longe a campeã. A assinatura cobre uma sequência exata de bytes, e comprimir reescreve o arquivo inteiro. Não existe compressão leve o bastante.

**Tem conserto?** Não no arquivo comprimido. Recupere o original assinado e, se precisar caber num limite, [comprima antes de assinar](/guias/por-que-comprimir-antes-de-assinar-digitalmente/).

### 2. O PDF foi dividido, juntado ou teve páginas mexidas

Mesma mecânica. Dividir em partes, juntar com outro documento, remover, girar ou reordenar páginas: tudo reescreve o arquivo.

**Tem conserto?** Não. E é por isso que o brpdf se recusa por padrão a juntar ou comprimir documentos assinados, avisando antes de você clicar.

### 3. O arquivo foi aberto e salvo de novo em outro programa

O mais traiçoeiro, porque ninguém sente que alterou nada. Abrir num editor e usar "Salvar" — mesmo sem mudar uma vírgula — pode reescrever a estrutura interna. Preencher um campo de formulário, adicionar um comentário ou carimbar numeração tem o mesmo efeito.

**Tem conserto?** Não. Use sempre "Salvar como" numa cópia quando precisar mexer, mantendo o assinado intocado.

### 4. Falta a cadeia da ICP-Brasil no leitor

Aqui o arquivo está perfeito. O Adobe Reader confia na lista de certificados dele, que não inclui a raiz brasileira por padrão. Resultado: "assinatura de validade desconhecida" ou "não foi possível verificar", numa peça impecável.

**Como saber que é este o caso:** o conferidor diz que a integridade confere, e mesmo assim o leitor reclama. Aí o problema é do leitor.

**Tem conserto?** Sim. Instale a cadeia da ICP-Brasil no leitor, ou confira no [validador do ITI](https://validar.iti.gov.br/), que já conhece a cadeia.

### 5. O certificado expirou ou foi revogado

Certificado A1 vale um ano, A3 costuma valer até três. Assinatura feita dentro da validade continua conferindo depois do vencimento — desde que exista prova de **quando** foi assinada, o que só um carimbo do tempo dá.

Sem carimbo, uma assinatura de dois anos atrás com certificado vencido fica num limbo: o conteúdo confere, mas provar a data depende de outros elementos dos autos.

**Tem conserto?** Não retroativamente. É o argumento a favor de [usar política com carimbo do tempo](/guias/pades-e-as-siglas-ad-rb-ad-rt-ad-rc-ad-ra/) em documento que precisa durar.

### 6. O certificado não é ICP-Brasil

Existem assinadores que geram um certificado próprio, sem autoridade certificadora nenhuma por trás. A integridade confere perfeitamente — o arquivo não foi alterado — e mesmo assim o tribunal recusa, porque a assinatura não tem origem verificável.

**Como saber:** o conferidor avisa quando o certificado assina a si mesmo. É o sinal de que ninguém o emitiu.

**Tem conserto?** Assinar de novo com certificado ICP-Brasil.

## O resumo desagradável

| Causa | Conserto |
|---|---|
| Comprimido depois de assinar | Nenhum. Recupere o original. |
| Dividido, juntado ou páginas mexidas | Nenhum. Recupere o original. |
| Salvo de novo em outro programa | Nenhum. Recupere o original. |
| Falta a cadeia no leitor | Sim — e o arquivo está bom. |
| Certificado vencido ou revogado | Depende do carimbo do tempo. |
| Certificado não é ICP-Brasil | Assinar de novo com certificado válido. |

Três das seis não têm volta. Vale a pena guardar o arquivo como saiu do assinador, em cópia intocada, antes de qualquer preparo.

## Se o original se perdeu

Não há saída técnica: só quem tem a chave privada consegue assinar, e a chave está no token, no cartão ou na nuvem de quem assinou. Peça o documento de novo a essa pessoa.

Se foi você quem assinou e o original se perdeu, assine outra vez — desta vez a partir do arquivo já preparado no tamanho final.

## Para não voltar aqui

A regra cabe numa linha: **assinar é a última coisa que acontece antes de protocolar.** Junte, comprima, divida, numere, converta — e só então assine. O [checklist antes de protocolar](/guias/checklist-antes-de-protocolar-anexos-em-pdf/) coloca isso na ordem, e o [conferidor](/verificar-assinatura-digital/) fecha a conta em segundos.
