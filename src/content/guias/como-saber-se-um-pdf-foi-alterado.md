---
title: "Como saber se um PDF foi alterado"
description: "A data de modificação é uma pista, e pode ser forjada. Veja o que dá para verificar de fato num PDF, o que é só declaração e onde está a diferença."
updated: 2026-09-16
tags:
  - assinatura digital
  - checklist
  - peticionamento
  - anexos
---

Você recebeu um documento e desconfia que ele não é o mesmo que foi produzido originalmente. Ou precisa demonstrar que um arquivo juntado aos autos foi mexido depois de assinado.

Existem duas respostas para essa pergunta, e a diferença entre elas é o que decide se você tem uma pista ou um fato.

## A resposta fraca: a data que o arquivo declara

Todo PDF pode guardar a data da última modificação num campo interno. Dá para ler em segundos no [Raio-X do PDF](/metadados-pdf/), junto com o autor e o programa que gravou o arquivo.

É útil, e é por onde se começa. Mas atenção ao que esse campo é: **texto escrito pelo programa que salvou o arquivo**. Não é carimbo, não é registro externo, não é verificável. Quem quiser mudar, muda — com um editor hexadecimal, em menos de um minuto, sem deixar rastro.

Então a data de modificação serve para:

- Entender a linha do tempo de um documento que ninguém tem motivo para falsificar.
- Notar incoerências (um arquivo "de 2019" gravado por um programa lançado em 2023).
- Levantar uma pergunta.

E **não** serve para provar alteração numa discussão em que a outra parte tem interesse em esconder.

## A resposta forte: o que a assinatura protege

Quando o PDF está **assinado digitalmente**, a coisa muda de natureza.

A assinatura cobre uma sequência exata de bytes e registra, dentro do próprio arquivo, até onde essa proteção vai. Isso cria dois fatos verificáveis, que não dependem de ninguém ter escrito a verdade em campo nenhum:

**1. Se o conteúdo assinado mudou.** Um único byte trocado dentro do trecho protegido derruba a conferência. Não há como alterar o documento e manter a assinatura conferindo — é justamente para isso que ela existe. O [verificador de assinatura](/verificar-assinatura-digital/) responde isso em menos de um segundo.

**2. Se escreveram depois.** O formato PDF permite gravar acrescentando ao fim do arquivo. Tudo que está além do ponto onde a assinatura alcança é, comprovadamente, posterior a ela. A assinatura pode continuar conferindo — ela cobre o que cobria — e ainda assim o documento não ser mais só aquilo que foi assinado.

Esse segundo caso é o que costuma passar despercebido: uma página anexada, um carimbo aplicado, uma anotação. A ferramenta avisa quando encontra, e essa é a única afirmação temporal que vale como fato.

## Comparando as duas

| Pergunta | Responde? | Vale como prova? |
|---|---|---|
| Que data o arquivo declara? | Sim | Não — é texto editável |
| Quem consta como autor? | Muitas vezes | Não — é texto editável |
| O conteúdo assinado mudou? | Se estiver assinado | **Sim** |
| Escreveram depois da assinatura? | Se estiver assinado | **Sim** |
| Quando exatamente foi assinado? | Só com carimbo do tempo | Com carimbo, sim |

A coluna da direita é a que importa numa discussão. Sem assinatura digital, um PDF não tem como provar nada sobre a própria história — é um arquivo, e arquivos são editáveis.

## As versões anteriores continuam lá dentro

Um detalhe que surpreende: como o PDF grava acrescentando ao fim sem apagar o que já estava, um arquivo pode conter **versões anteriores inteiras** de si mesmo.

O Raio-X mostra quantas gravações existem. Se um documento aparece com quatro, ele foi salvo quatro vezes — e o conteúdo das três primeiras continua dentro do arquivo, mesmo que o leitor de PDF mostre apenas a última.

Para quem recebe um documento, é informação. Para quem envia, é aviso: apagar um trecho e salvar por cima nem sempre apaga de verdade.

## Um roteiro prático

1. **Solte o arquivo no [Raio-X do PDF](/metadados-pdf/).** Veja datas, autor, programa e quantas gravações existem.
2. **Se houver assinatura, [verifique](/verificar-assinatura-digital/).** É aqui que aparecem os fatos: integridade e gravação posterior.
3. **Compare com o que se alega.** Incoerência entre a data declarada e o programa usado, ou entre o número de gravações e a história contada, é motivo para perguntar.
4. **Se for virar disputa, chame perícia.** Nenhuma ferramenta gratuita substitui laudo. O que ela faz é dizer se vale a pena ir atrás.

## Onde quase todo mundo erra

Tratar a data de modificação como se fosse prova. É o erro mais comum, e o mais fácil de desmontar: basta a outra parte apontar que o campo é editável.

Se a sua demonstração depende de "o arquivo diz que foi alterado em tal data", ela está apoiada em texto que qualquer pessoa escreve. Se depende de "a assinatura não confere mais" ou "há conteúdo além do que a assinatura cobre", está apoiada em matemática.

É uma diferença que vale conhecer antes de precisar dela.
