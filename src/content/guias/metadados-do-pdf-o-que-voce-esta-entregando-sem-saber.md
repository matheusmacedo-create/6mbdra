---
title: "Metadados do PDF: o que você entrega sem saber"
description: "Seu nome, o programa que você usa e rascunhos antigos viajam dentro de cada PDF que você protocola. O que é gravado, como ver e como limpar antes de enviar."
updated: 2026-09-16
tags:
  - anexos
  - checklist
  - peticionamento
  - organizacao
---

Quando você salva um PDF, o programa grava junto um punhado de informações que você não escreveu e não vê na tela. Elas viajam com o arquivo: para os autos, para a parte contrária, para quem mais receber o documento.

Não é teoria. Medimos **60 documentos públicos de tribunais** e o resultado foi este:

| o que estava gravado | em quantos |
|---|---|
| Data da última alteração | 29 de 60 |
| Nome no campo de autor | 20 de 60 |
| Programa que gravou o arquivo | 32 de 60 |
| Mais de uma versão guardada no próprio arquivo | 21 de 60 |
| Nenhum dado de identificação | 17 de 60 |

Entre os nomes encontrados havia nomes completos de pessoas físicas. Ninguém decidiu publicar aquilo — o programa gravou sozinho, e o documento foi para um portal público.

## O que exatamente é gravado

**Autor.** O mais revelador. Costuma vir do nome configurado no Word ou no sistema operacional. Se o computador foi configurado pelo suporte de TI, pode ser o nome de usuário da rede. Se o arquivo passou pela mão de um estagiário, pode ser o nome dele.

**Datas de criação e de alteração.** Quando o arquivo nasceu e quando foi salvo pela última vez. Revela, por exemplo, que a peça "urgente" foi escrita há três semanas — ou terminada quinze minutos antes do prazo.

**Programa e versão.** "Microsoft Word 2016", "Adobe PDF Library 10.0", "Canva". Diz com o que o escritório trabalha e em qual versão, o que também é informação de segurança.

**Título interno.** Raramente é o título do documento. Costuma ser o nome do arquivo original ou o título de um modelo antigo — é comum aparecer `contestacao_modelo_v3` num documento que chegou aos autos com outro nome.

**Histórico de edição.** Alguns programas gravam a sequência de ações, com data e software de cada passo. Um documento que passou por InDesign e depois por um conversor carrega os dois registros.

**Versões anteriores inteiras.** Esta surpreende. O formato PDF permite salvar acrescentando ao fim do arquivo, sem apagar o que já estava lá. Um PDF pode conter, dentro de si, o conteúdo de versões anteriores — inclusive de trechos que você acha que apagou.

## Como ver o que o seu arquivo está levando

Solte o arquivo no [Raio-X do PDF](/metadados-pdf/). A ficha aparece na hora e o documento não sai do seu computador — o que importa aqui, já que estamos justamente falando de dados pessoais.

Faça o teste com a última peça que você protocolou. É o jeito mais rápido de entender se isso é um problema para o seu escritório ou não.

## Como limpar antes de enviar

**A forma mais simples: reprocessar o arquivo.** Ao passar um PDF pela [compressão do brpdf](/comprimir-pdf/), os campos de identificação do original não são carregados para o arquivo de saída. Você resolve o tamanho e a limpeza na mesma passada.

**No Word, antes de exportar.** Arquivo → Informações → Verificar Se Há Problemas → **Inspecionar Documento**. Ele encontra propriedades, comentários e dados pessoais, e remove com um clique.

**No Acrobat Pro.** Ferramentas → Proteger → **Remover Informações Ocultas**.

**Conferindo depois.** Passe o resultado de novo pelo Raio-X. Se a ficha voltar vazia, está limpo — e "vazio" ali é a boa notícia, não uma falha.

## A ordem importa, e é aqui que dá errado

Se o documento vai ser **assinado digitalmente**, limpe **antes** de assinar. Mexer nos metadados depois altera os bytes do arquivo e [quebra a assinatura](/guias/por-que-comprimir-antes-de-assinar-digitalmente/), exatamente como a compressão faz.

A sequência segura é sempre a mesma:

1. Escrever e montar o documento.
2. Limpar os metadados.
3. Comprimir e dividir, se precisar caber num limite.
4. **Assinar por último.**
5. Protocolar.

## Isso é motivo para pânico?

Não. É motivo para saber.

Na maior parte dos casos, o que vaza é inofensivo: o nome do escritório no campo de autor não muda nada. O problema aparece em situações específicas — o nome de uma pessoa física que não é parte, um título interno que revela estratégia, uma data que contradiz o que foi alegado, ou uma versão anterior guardada dentro do arquivo.

Como custa cinco segundos conferir e um clique limpar, vale incorporar ao [checklist antes de protocolar](/guias/checklist-antes-de-protocolar-anexos-em-pdf/) e parar de pensar no assunto.

## O outro lado

Se o seu PDF conta essas coisas, o PDF que você **recebe** conta também. Ao analisar um documento juntado pela parte contrária, a ficha pode indicar quando foi realmente produzido, com qual programa e — quando o arquivo está assinado — se alguém escreveu nele depois da assinatura.

Isso não é perícia e não substitui uma. É um primeiro olhar, gratuito, que às vezes levanta a pergunta certa.
