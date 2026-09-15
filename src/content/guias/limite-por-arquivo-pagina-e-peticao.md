---
title: "Limite por arquivo, por página e por petição: três coisas diferentes"
description: "Um PDF dentro do limite individual ainda pode ser recusado. Entenda os três tipos de limite que os sistemas de peticionamento aplicam e como conferir cada um."
updated: 2026-09-14
tags:
  - tamanho de arquivo
  - peticionamento
  - limites
---

"O sistema aceita 10 MB" é uma frase incompleta. Dez megabytes **por quê**? Por arquivo? Somando tudo? E se o documento tiver duzentas páginas?

Sistemas de peticionamento aplicam até três limites diferentes ao mesmo tempo, e a recusa pode vir de qualquer um deles. Saber distingui-los evita a situação de encolher o arquivo errado.

## 1. Limite por arquivo

O mais conhecido: cada PDF anexado não pode passar de um tamanho. É o que a tela de anexar costuma informar, e o que quase todo mundo entende por "o limite do tribunal".

Ele varia bastante. Entre os tribunais que usam o PJe e têm regra publicada, os valores vão de 1,5 MB a 50 MB — uma diferença de mais de trinta vezes entre o mais restritivo e o mais folgado. Por isso não existe "o limite do PJe": existe o limite do seu tribunal, na sua instância.

Consulte o seu no [diretório por tribunal](/tribunais/) ou na [tabela por sistema](/sistemas/).

## 2. Limite por página

Menos conhecido e mais traiçoeiro. Alguns sistemas exigem que cada **página** fique abaixo de um tamanho — tipicamente algumas centenas de kilobytes.

A consequência prática: um documento de 100 páginas com limite de 300 KB por página tem, na prática, teto de 30 MB — mas um documento de 3 páginas com o mesmo limite não pode passar de 900 KB, mesmo que o limite por arquivo seja de 10 MB.

Ou seja: **documento curto e pesado é o caso que mais sofre.** Uma digitalização colorida de três páginas em alta resolução passa fácil do limite por página, enquanto um calhamaço de texto de duzentas páginas passa sem esforço.

Quando existe esse limite, a ferramenta ajusta a meta de cada arquivo pelo número de páginas, em vez de mirar só o limite por arquivo.

## 3. Limite por petição

Limita a **soma** dos anexos de um mesmo protocolo. Você anexa cinco documentos de 2 MB, todos dentro do limite individual, e a petição de 10 MB é recusada porque o teto do conjunto é 8 MB.

Esse é o limite que mais surpreende, porque cada arquivo isolado parece correto. Quando ele existe, as saídas são duas: reduzir mais os arquivos ou **protocolar em mais de uma petição**.

## Como saber quais se aplicam ao seu caso

A página de cada tribunal no [diretório](/tribunais/) lista os três, quando existem, com a fonte oficial e a data em que a regra foi conferida. Se o seu tribunal tem limite por página ou por petição, ele aparece lá junto do limite por arquivo.

Se o seu tribunal não estiver na base, o limite por arquivo costuma estar na própria tela de anexar. Os outros dois raramente são exibidos — normalmente estão no manual do sistema ou em ato normativo do tribunal.

## O que a ferramenta faz com cada um

O [brpdf](/) considera os três ao preparar o lote:

- **Por arquivo** — comprime cada PDF até a meta segura, um pouco abaixo do limite declarado.
- **Por página** — quando a regra tem esse limite, a meta de cada arquivo é recalculada pelo número de páginas dele, e as partes da divisão respeitam o mesmo teto.
- **Por petição** — a ferramenta não divide petição, porque a decisão de o que vai em cada uma é sua. Mas ela **avisa** quando a soma passa do permitido, e o ZIP já separa os arquivos em pastas por petição.

## Por que a meta fica abaixo do limite

Em todos os casos a preparação mira um pouco abaixo do valor declarado. O motivo é que "megabyte" tem duas contas possíveis, com quase 5% de diferença, e nem todo portal usa a mesma do seu computador. Arquivo no valor exato é o que mais é recusado. O assunto está em [MB ou MiB?](/guias/diferenca-entre-mb-e-mib-nos-portais-de-upload/).

## Leia também

- [O sistema recusou meu PDF](/guias/o-sistema-recusou-meu-pdf-causas-e-solucoes/) — a lista completa de causas
- [Dividir PDF por tamanho](/dividir-pdf/) — quando a compressão não basta
- [Comprimir PDF para 300 KB](/comprimir-pdf-para-300kb/) — o limite por página do e-SAJ em São Paulo, um exemplo real do segundo tipo
- [Metodologia](/metodologia/) — como cada regra entra na base e com que frequência é conferida
