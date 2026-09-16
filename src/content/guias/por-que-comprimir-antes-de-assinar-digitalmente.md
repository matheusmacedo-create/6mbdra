---
title: "Por que comprimir o PDF antes de assinar digitalmente"
description: "Entenda por que alterar um PDF assinado invalida a assinatura ICP-Brasil, a ordem certa do fluxo e o que fazer quando o documento já vem assinado."
updated: 2026-09-10
tags:
  - assinatura digital
  - ICP-Brasil
  - peticionamento
---

Uma situação comum no escritório: a petição está pronta, assinada com o certificado digital, e na hora de protocolar o sistema avisa que o arquivo passou do limite de tamanho. A primeira reação é compactar o PDF e tentar de novo. O problema é que, ao fazer isso, a assinatura deixa de valer.

Isso acontece porque a assinatura digital funciona como um lacre. Qualquer alteração no arquivo depois do lacre, inclusive uma compressão, rompe esse lacre, e o documento passa a aparecer como "assinatura inválida" ou "documento alterado após a assinatura".

Neste guia você vai entender, em termos simples, como funciona a assinatura digital em PDF, por que a ordem das etapas importa tanto e o que fazer quando o documento já chegou assinado por outra pessoa.

## Como funciona a assinatura digital em PDF

Quando você assina um PDF com certificado ICP-Brasil (a cadeia oficial de certificados digitais no Brasil), o programa faz basicamente três coisas:

1. **Calcula uma "impressão digital" do arquivo.** É um código gerado a partir de todos os bytes do documento. Se um único byte mudar, o código muda por completo.
2. **Cifra essa impressão digital com a sua chave privada**, que fica no seu token, cartão ou certificado em nuvem. Só você consegue gerar essa cifra.
3. **Grava tudo dentro do PDF**, junto com os dados do seu certificado, seguindo o padrão PAdES (o formato de assinatura próprio para PDF, usado nos sistemas de peticionamento).

Quem recebe o documento faz o caminho inverso: recalcula a impressão digital do arquivo e compara com a que foi assinada. Se bater, a assinatura é válida e o conteúdo é o mesmo de quando você assinou. Se não bater, o programa avisa que houve alteração.

## Por que qualquer alteração invalida a assinatura

Compactar um PDF significa reescrever as imagens em resolução ou qualidade menor e reorganizar a estrutura interna do arquivo. Do ponto de vista da assinatura, isso é uma alteração como qualquer outra: os bytes mudaram, a impressão digital não bate mais.

O mesmo vale para outras ações aparentemente inofensivas:

- Dividir o PDF em partes.
- Remover ou reordenar páginas.
- Girar uma página.
- Adicionar carimbo, numeração ou marca d'água.
- Salvar novamente em outro programa.

Em todos esses casos, o sistema do tribunal pode recusar o documento ou exibi-lo com alerta de assinatura inválida. Não há como "consertar" a assinatura depois: a única saída é assinar de novo.

Na dúvida sobre um arquivo específico, o [conferidor de assinatura](/conferir-assinatura/) responde em segundos, sem enviar o documento para lugar nenhum — melhor que descobrir pela recusa do protocolo.

## A ordem correta do fluxo

A regra é uma só: a assinatura tem de ser a última coisa a acontecer antes do protocolo. O fluxo recomendado é:

1. **Preparar.** Junte as páginas, coloque na ordem certa, compacte e, se necessário, divida o PDF para caber no limite do tribunal. Os limites variam muito conforme tribunal, sistema e tipo de petição (de pouco mais de 1 MB a dezenas de megabytes); confira o seu no [diretório de limites por tribunal](/tribunais/). A [ferramenta de compactar e dividir PDF](/) faz essa etapa direto no seu navegador, sem enviar o arquivo a servidor algum.
2. **Conferir.** Abra cada arquivo final e verifique se todas as páginas estão presentes, legíveis e na ordem. Se dividiu, confira os nomes (parte_01, parte_02) e o tamanho de cada parte.
3. **Assinar.** Só agora aplique a assinatura digital, em cada arquivo que será enviado. Se o PDF foi dividido em três partes, são três assinaturas.
4. **Protocolar.** Envie os arquivos assinados. Não abra para editar, não salve por cima e não passe por nenhum outro programa depois da assinatura.

Um detalhe útil: a assinatura acrescenta alguns quilobytes ao arquivo. Por isso, ao compactar, é preciso uma pequena margem de segurança (uns 5%) abaixo do limite, para que o arquivo assinado continue cabendo. A [ferramenta](/) aplica essa margem sozinha quando você informa o limite do tribunal.

## E se o documento já veio assinado por terceiros?

É frequente receber PDFs assinados por outra pessoa: um contrato assinado pelo cliente, uma procuração assinada por um colega, um laudo assinado por um perito. Se esse arquivo estiver acima do limite, compactá-lo faria a assinatura de quem o emitiu deixar de valer.

As opções, nesse caso, são:

- **Pedir a quem assinou um arquivo menor.** É o caminho mais limpo. A pessoa gera o PDF já compactado e assina de novo.
- **Verificar se o sistema aceita o documento de outro modo.** Alguns fluxos permitem anexar o arquivo em partes ou como documentos separados; consulte as orientações do tribunal.
- **Anexar como está, se couber.** Se o tamanho estiver dentro do limite, envie o arquivo sem tocar nele.

Se o documento assinado por terceiros for apenas um comprovante (um recibo, uma foto de contrato) e a assinatura digital não for essencial para a prova, avalie com cautela se uma cópia compactada, sem a assinatura original, atende ao caso. Essa é uma decisão jurídica, não técnica, e cabe a você.

## Cuidados extras

- **PDF com senha de abertura:** precisa ser destravado no programa de origem antes de compactar e assinar.
- **PDF escaneado:** é grande porque cada página é uma imagem. Reduzir a resolução (dpi, a quantidade de pontos por polegada) e a qualidade das imagens costuma resolver.
- **PDF com OCR:** OCR é a camada de texto invisível sobre a imagem que permite buscar e copiar o conteúdo. A ferramenta preserva essa camada ao compactar, mas nem todo programa faz isso; depois de comprimir, teste se o texto continua selecionável.
- **Assinaturas em cadeia:** se mais de uma pessoa precisa assinar, todas assinam depois da preparação, uma após a outra, sem editar o arquivo entre as assinaturas.

Esta ferramenta não é oficial nem vinculada a nenhum tribunal. Confira sempre o documento final, com a assinatura validada, antes de protocolar.

## Perguntas frequentes

### Compactei um PDF já assinado. Tem conserto?

Não dá para recuperar a assinatura antiga. O que você pode fazer é usar o arquivo compactado (sem assinatura) e assinar de novo, desde que a assinatura seja sua. Se era de outra pessoa, será preciso pedir a ela um novo arquivo.

### Dividir o PDF em partes também invalida a assinatura?

Sim. Cada parte é um arquivo novo, com bytes diferentes do original. Divida primeiro e assine cada parte depois.

### Como confirmo que a assinatura ficou válida antes de protocolar?

Abra o arquivo em um leitor de PDF que verifique assinaturas ou em um validador de assinaturas ICP-Brasil. O aviso deve indicar que a assinatura é válida e que o documento não foi modificado após a assinatura.
