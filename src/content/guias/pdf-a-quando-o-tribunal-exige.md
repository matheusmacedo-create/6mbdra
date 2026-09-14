---
title: "PDF/A: quando o tribunal exige e como converter"
description: "O que é PDF/A, por que alguns sistemas exigem esse formato na petição inicial e como gerar um sem software pago — na ordem certa em relação à compressão."
updated: 2026-09-14
tags:
  - PDF/A
  - peticionamento
  - formato
---

Alguns sistemas de peticionamento recusam a petição inicial se o arquivo não estiver em PDF/A. O tamanho está certo, o documento abre normalmente, e mesmo assim volta erro de formato.

## O que é PDF/A

PDF/A é uma variante do PDF criada para **arquivamento de longo prazo**. A ideia é que o documento continue sendo exibido do mesmo jeito daqui a décadas, mesmo que os programas mudem.

Para garantir isso, o formato impõe restrições:

- **Todas as fontes vão embutidas no arquivo.** Um PDF comum pode só citar a fonte e contar que ela exista no computador de quem abre; em PDF/A ela viaja junto.
- **Nada de conteúdo dinâmico.** Sem JavaScript, sem áudio, sem vídeo, sem conteúdo que dependa de rede.
- **Sem criptografia.** O arquivo não pode ser protegido por senha.
- **Cores descritas de forma independente do dispositivo.**

O preço disso é tamanho: fontes embutidas fazem o arquivo crescer, às vezes bastante, principalmente em documentos curtos com muitas fontes diferentes.

## Como saber se o seu tribunal exige

A exigência não é geral — é de sistemas específicos, e em geral **só para a petição inicial**, não para os anexos.

A página do seu tribunal no [diretório](/tribunais/) informa quando existe essa exigência, com a fonte oficial. Se aparecer "exige PDF/A na inicial", vale conferir também a tela do sistema antes de protocolar, porque regra de formato muda sem aviso como qualquer outra.

## Como gerar PDF/A sem pagar por isso

**Do editor de texto (o caminho mais comum).** Ao exportar para PDF, tanto o LibreOffice quanto o Microsoft Word oferecem a opção de conformidade com PDF/A — no LibreOffice ela está na própria janela de exportação; no Word, nas opções de salvamento como PDF. Como o documento é gerado direto do original, o resultado costuma ser o mais limpo.

**Convertendo um PDF existente.** O LibreOffice Draw abre um PDF e permite reexportá-lo como PDF/A. É uma conversão de verdade, não uma renomeação — mas confira o resultado, porque documentos complexos podem sair com o layout alterado.

**Com software pago.** Acrobat Pro e ferramentas equivalentes fazem a conversão e ainda validam a conformidade. Se o escritório já tem licença, é o caminho mais previsível.

Cuidado com conversores online: são servidores de terceiros recebendo a sua petição inicial. Se for usar, considere o que está enviando.

## A ordem que evita retrabalho

Esta é a parte que mais causa problema, porque as três operações interferem umas nas outras:

1. **Gere o documento** no editor.
2. **Comprima**, se precisar caber num limite.
3. **Converta para PDF/A.**
4. **Assine digitalmente.**

Por quê nessa ordem:

- **Comprimir depois de converter** pode quebrar a conformidade com PDF/A, porque a compressão reescreve o arquivo.
- **Comprimir depois de assinar** invalida a assinatura — sempre. Veja [por que comprimir antes de assinar](/guias/por-que-comprimir-antes-de-assinar-digitalmente/).
- **Converter depois de assinar** também invalida, pelo mesmo motivo: a conversão gera um arquivo novo.

O [brpdf](/) entrega PDF comum, não PDF/A — e avisa isso na tela quando o tribunal escolhido tem essa exigência. A conversão é o passo seguinte, no LibreOffice ou no Acrobat.

## Se o arquivo em PDF/A ficar grande demais

É uma tensão real: PDF/A tende a crescer, e o limite do tribunal não muda por causa disso. Caminhos possíveis:

- Comprima **antes** de converter, com folga maior que a usual, prevendo o crescimento.
- Reduza a variedade de fontes no documento — cada família embutida ocupa espaço.
- Se o peso vem de imagens, [digitalize melhor na origem](/guias/digitalizar-pelo-celular-sem-arquivo-gigante/): é onde mais se ganha.

## Leia também

- [O sistema recusou meu PDF](/guias/o-sistema-recusou-meu-pdf-causas-e-solucoes/)
- [Limite por arquivo, por página e por petição](/guias/limite-por-arquivo-pagina-e-peticao/)
