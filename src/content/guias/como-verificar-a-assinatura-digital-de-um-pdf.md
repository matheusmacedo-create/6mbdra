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

Para isso existe o [conferidor de assinatura do brpdf](/verificar-assinatura-digital/). Arraste o PDF e a resposta vem em menos de um segundo, com o documento nunca saindo do seu computador.

Ele responde:

- Existe alguma assinatura neste arquivo, e quantas.
- O conteúdo assinado mudou desde a assinatura.
- Qual nome e emissor constam no certificado.
- **Se a cadeia do certificado fecha numa raiz da ICP-Brasil**, e em qual delas.
- Se o certificado assina a si mesmo — ou seja, não veio de autoridade certificadora nenhuma.
- Se algo foi escrito no arquivo **depois** do trecho que a assinatura cobre.

A verificação de cadeia funciona sem consultar servidor nenhum: as doze raízes da Autoridade Certificadora Raiz Brasileira ficam guardadas dentro da ferramenta. Certificado é um objeto autoautenticável — o que garante a origem é a impressão digital, não o servidor de onde veio.

E não responde duas coisas: **revogação** e **carimbo do tempo**. A primeira fica de fora por escolha, não por limitação: consultar se um certificado foi revogado significa perguntar a um servidor do ITI sobre ele, ou seja, contar a um terceiro que aquele documento está sendo conferido. Para as duas, existe o segundo caminho.

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
| "Comprimi depois de assinar. Estraguei?" | Verificador no navegador — resposta imediata, sem enviar nada. |
| "Este certificado é mesmo da ICP-Brasil?" | Verificador no navegador: ele monta a cadeia até a raiz oficial. |
| "O certificado estava revogado? O carimbo confere?" | Validador do ITI — só ele faz essas duas. |
| "Preciso de um parecer que valha numa discussão." | Validador do ITI. |
| "Recebi de terceiro e o arquivo é sigiloso." | Verificador no navegador primeiro; ITI só se houver dúvida real. |

## O que "assinatura válida" não quer dizer

Nenhuma ferramenta, inclusive a oficial, decide validade jurídica. O que elas conferem é um conjunto de fatos técnicos: o conteúdo não mudou, o certificado encadeia até uma raiz reconhecida, não estava revogado.

Um detalhe que aparece na tela e merece explicação: quando a ferramenta diz **"origem não verificada"**, isso não é o mesmo que "não é ICP-Brasil". Significa que a cadeia aponta para a ICP-Brasil mas passa por um certificado com algoritmo que ainda não sabemos conferir aqui — acontece no ramo usado por carimbo do tempo. Não saber não é acusar, e a diferença está escrita na tela de propósito.

Isso não responde se quem assinou tinha poderes de representação, se o documento é o que diz ser, ou se a peça será aceita. Um contrato assinado por quem não podia assinar tem assinatura digital tecnicamente impecável.

Por isso o brpdf nunca escreve "assinatura válida". Escreve "a integridade confere", que é o que dá para medir.

## Se a conferência acusou alteração

Não há conserto. A assinatura não pode ser recolocada num arquivo que mudou — só quem tem o certificado consegue assinar, e assinar exige o documento original.

O caminho é recuperar o arquivo como saiu do assinador e recomeçar dali, desta vez [preparando o PDF antes de assinar](/guias/por-que-comprimir-antes-de-assinar-digitalmente/). Se o original se perdeu, é pedir de novo a quem assinou.

## Antes de protocolar

Vale passar os assinados pelo conferidor como último passo, junto com o resto do [checklist antes de protocolar](/guias/checklist-antes-de-protocolar-anexos-em-pdf/). Leva segundos e evita descobrir o problema pela intimação.
