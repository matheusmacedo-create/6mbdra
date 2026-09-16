---
title: "Como verificar a assinatura digital de um PDF"
description: "Três formas de conferir se a assinatura de um PDF continua íntegra: no navegador, no validador oficial do ITI e no leitor de PDF. Quando usar cada uma."
updated: 2026-09-16
tags:
  - assinatura digital
  - ICP-Brasil
  - checklist
  - peticionamento
---

Você recebeu um PDF assinado — do cliente, do correspondente, da parte contrária — ou acabou de mexer num arquivo que já estava assinado. Antes de juntar aos autos, vale saber se aquela assinatura ainda confere.

Existem três caminhos, e eles respondem perguntas diferentes. Escolher o errado faz perder tempo ou, pior, dá uma tranquilidade que o documento não merece.

## O caminho rápido: conferir a integridade no navegador

A pergunta mais frequente no dia a dia não é "este certificado é legítimo?" — é **"eu estraguei este arquivo?"**. Alguém comprimiu, dividiu, juntou ou salvou de novo um PDF que já estava assinado, e agora precisa saber se ainda dá para protocolar.

Para isso existe o [conferidor de assinatura do brpdf](/conferir-assinatura/). Arraste o PDF e a resposta vem em menos de um segundo, com o documento nunca saindo do seu computador.

Ele responde:

- Existe alguma assinatura neste arquivo, e quantas.
- O conteúdo assinado mudou desde a assinatura.
- Qual nome e emissor constam no certificado.
- Se o certificado assina a si mesmo — ou seja, não veio de autoridade certificadora nenhuma.
- Se algo foi escrito no arquivo **depois** do trecho que a assinatura cobre.

E não responde: se o certificado encadeia até as raízes da ICP-Brasil, se estava revogado, e se o carimbo do tempo confere. Para isso existe o segundo caminho.

## O caminho completo: o validador oficial do ITI

O [validador do ITI](https://validar.iti.gov.br/) é a referência oficial no Brasil. Ele faz a verificação inteira: integridade, cadeia do certificado até a raiz da ICP-Brasil, revogação e carimbo do tempo. Quando o resultado precisa valer numa discussão, é ele.

O ponto a considerar é que **o documento é enviado** para o servidor do ITI. Para uma peça pública já protocolada, isso costuma ser irrelevante. Para um documento sob sigilo profissional que ainda não saiu do escritório, é uma decisão que merece pensamento — e é exatamente por isso que a conferência local existe como primeiro passo.

Um detalhe prático: use `validar.iti.gov.br`. Os endereços do repositório de certificados da ICP-Brasil (`acraiz.icpbrasil.gov.br`, `politicas.icpbrasil.gov.br`) hoje servem a cadeia TLS incompleta, o que faz navegadores exibirem aviso e ferramentas automatizadas falharem. Não é problema do seu computador.

## O caminho que já está aberto: o leitor de PDF

Adobe Acrobat Reader e leitores equivalentes mostram um painel de assinaturas quando o arquivo tem uma. É prático porque não exige abrir nada novo, mas tem duas armadilhas.

A primeira: **o Reader confia na lista de certificados dele, não na ICP-Brasil.** Sem instalar a cadeia brasileira, ele pode marcar como "desconhecida" uma assinatura perfeitamente regular — ou aceitar como confiável um certificado que não é ICP.

A segunda: a mensagem "pelo menos uma assinatura tem problemas" costuma significar coisas muito diferentes. Pode ser documento alterado, pode ser só falta da cadeia instalada. O texto não distingue, e é a diferença entre "recomece" e "está tudo bem".

## Qual usar, afinal

| Sua pergunta | Caminho |
|---|---|
| "Comprimi depois de assinar. Estraguei?" | Conferidor no navegador — resposta imediata, sem enviar nada. |
| "Preciso de um parecer que valha numa discussão." | Validador do ITI. |
| "Só quero ver quem assinou." | Leitor de PDF, lembrando que a confiança dele não é a ICP-Brasil. |
| "Recebi de terceiro e o arquivo é sigiloso." | Conferidor no navegador primeiro; ITI só se houver dúvida real. |

## O que "assinatura válida" não quer dizer

Nenhuma ferramenta, inclusive a oficial, decide validade jurídica. O que elas conferem é um conjunto de fatos técnicos: o conteúdo não mudou, o certificado encadeia até uma raiz reconhecida, não estava revogado.

Isso não responde se quem assinou tinha poderes de representação, se o documento é o que diz ser, ou se a peça será aceita. Um contrato assinado por quem não podia assinar tem assinatura digital tecnicamente impecável.

Por isso o brpdf nunca escreve "assinatura válida". Escreve "a integridade confere", que é o que dá para medir.

## Se a conferência acusou alteração

Não há conserto. A assinatura não pode ser recolocada num arquivo que mudou — só quem tem o certificado consegue assinar, e assinar exige o documento original.

O caminho é recuperar o arquivo como saiu do assinador e recomeçar dali, desta vez [preparando o PDF antes de assinar](/guias/por-que-comprimir-antes-de-assinar-digitalmente/). Se o original se perdeu, é pedir de novo a quem assinou.

## Antes de protocolar

Vale passar os assinados pelo conferidor como último passo, junto com o resto do [checklist antes de protocolar](/guias/checklist-antes-de-protocolar-anexos-em-pdf/). Leva segundos e evita descobrir o problema pela intimação.
