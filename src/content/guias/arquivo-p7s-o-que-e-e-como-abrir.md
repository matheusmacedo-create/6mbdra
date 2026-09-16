---
title: "Arquivo .p7s: o que é e o que fazer com ele"
description: "O .p7s é a assinatura digital guardada fora do documento. Como abrir, por que ele aparece, o que acontece se um dos dois arquivos se perder e como protocolar."
updated: 2026-09-16
tags:
  - assinatura digital
  - ICP-Brasil
  - formato
  - anexos
---

Você baixou um documento do sistema e vieram dois arquivos: `peticao.pdf` e `peticao.pdf.p7s`. Ou recebeu um `.p7s` sozinho e o computador não sabe abrir.

O `.p7s` não é um documento. É a **assinatura**, guardada num arquivo separado do que ela assina.

## Dois formatos, duas filosofias

Existem duas maneiras de assinar digitalmente um documento:

**Assinatura embutida (PAdES).** A assinatura mora dentro do próprio PDF. Um arquivo só, que carrega documento e assinatura. É o mais comum no peticionamento eletrônico.

**Assinatura destacada (CAdES, o `.p7s`).** A assinatura fica num arquivo ao lado. Dois arquivos que só fazem sentido juntos.

O `.p7s` existe porque funciona com **qualquer tipo de arquivo** — planilha, imagem, vídeo, banco de dados. Não depende do formato saber hospedar uma assinatura. É por isso que sistemas de gestão documental e vários tribunais o adotaram.

## A consequência prática: eles não podem se separar

Um `.p7s` sozinho não serve para nada — assina um documento que você não tem. Um documento cujo `.p7s` se perdeu volta a ser um arquivo comum, sem assinatura.

Isso muda como se arquiva e como se envia:

- **Guarde os dois juntos**, na mesma pasta, com os nomes correspondentes.
- **Não renomeie** nenhum dos dois sem renomear o outro. Muitos validadores encontram o par pelo nome.
- **Ao enviar por e-mail**, mande os dois. Anexar só o PDF é mandar um documento sem assinatura.
- **Nunca comprima nem altere** o documento assinado — pela mesma razão de sempre: a assinatura cobre os bytes exatos.

## Como abrir e conferir

O `.p7s` não abre com duplo clique, e não deveria: ele não é para ser lido, é para ser verificado.

**O caminho oficial** é o [validador do ITI](https://validar.iti.gov.br/), que aceita o par e faz a verificação completa — integridade, cadeia até a ICP-Brasil, revogação e carimbo do tempo. É a referência quando o resultado precisa valer numa discussão.

**No Windows**, com o certificado instalado, dá para clicar com o botão direito no `.p7s` e ver as propriedades da assinatura. Mostra quem assinou, mas não confere a cadeia brasileira sem configuração.

**Programas de gestão de certificado digital** — os que vêm com o token ou o cartão — costumam ter função de verificar `.p7s`.

O [conferidor do brpdf](/conferir-assinatura/) hoje lê a assinatura **embutida** no PDF, não o `.p7s`. Se você tem os dois arquivos, o ITI é o caminho.

## Como saber qual dos dois você tem

Se o PDF tem assinatura embutida, o leitor mostra uma faixa de assinaturas ao abrir, e o conferidor encontra a assinatura no próprio arquivo.

Se não aparece nada e você sabe que o documento foi assinado, provavelmente existe um `.p7s` em algum lugar — no ZIP que veio do sistema, na pasta de downloads, ou nunca foi baixado junto.

## Ao protocolar

Confira o que o sistema aceita. Há três comportamentos:

1. **O sistema assina para você** ao enviar, e não interessa o que você tinha antes.
2. **O sistema aceita o PDF assinado** com assinatura embutida, e um `.p7s` não tem onde entrar.
3. **O sistema aceita o par**, com campo para o documento e campo para a assinatura.

Enviar um `.p7s` onde o sistema esperava PDF assinado costuma resultar em recusa, e a mensagem raramente explica isso — vira mais uma [causa de recusa no envio](/guias/o-sistema-recusou-meu-pdf-causas-e-solucoes/) difícil de diagnosticar.

## Se o documento não couber no limite

Vale a mesma ordem de sempre, com um cuidado a mais: como a assinatura está fora, é tentador achar que dá para comprimir o documento e manter o `.p7s`. Não dá. A assinatura cobre os bytes do arquivo original; comprimir muda esses bytes e o par deixa de conferir.

[Prepare o documento antes de assinar](/guias/por-que-comprimir-antes-de-assinar-digitalmente/) — com `.p7s` a regra é idêntica, só a aparência muda.

## Por que o `.p7s` incomoda tanto

Porque ele quebra a intuição de que "o documento é o arquivo". Numa rotina de escritório em que arquivos são copiados, renomeados, anexados e reenviados, um par que precisa andar junto se separa com facilidade — e a separação é silenciosa: o PDF continua abrindo normalmente, só deixou de ter assinatura.

O hábito que evita isso é simples: guardar o par num ZIP com os dois dentro, e tratar esse ZIP como o documento.
