---
title: "Checklist antes de protocolar anexos em PDF"
description: "Lista prática de conferências para anexos em PDF antes do protocolo: tamanho, páginas, ordem, nomes, legibilidade, senha, assinatura e PDF/A."
updated: 2026-09-10
tags:
  - checklist
  - peticionamento
  - PDF
---

Quase todo erro no protocolo eletrônico acontece por um detalhe pequeno: um anexo acima do limite, um documento com senha, uma parte fora de ordem ou uma assinatura invalidada porque o arquivo foi editado depois. São problemas simples, mas que aparecem na pior hora, com o prazo correndo.

A solução é ter uma rotina de conferência e repeti-la sempre, seja você advogado(a), estagiário(a) ou da equipe administrativa. Este guia reúne essa rotina em forma de checklist, na ordem em que as etapas acontecem.

Uma ressalva: limites e exigências mudam de tribunal para tribunal. Use este checklist como base e ajuste ao sistema que você vai usar.

## Checklist de conferência

Passe por cada item antes de abrir a tela de protocolo.

1. **Formato**: os anexos estão em PDF? Como regra, fotos em JPG, planilhas e arquivos de Word precisam ser convertidos. Alguns sistemas aceitam outros formatos para áudio e vídeo; confira as regras do seu.
2. **Tamanho por arquivo**: cada anexo está abaixo do limite do seu tribunal? Os limites variam muito conforme tribunal, sistema e tipo de petição: há sistemas que aceitam pouco mais de 1 MB por arquivo e outros que aceitam dezenas de megabytes. Confira o valor no [diretório de limites por tribunal](/tribunais/). Vale deixar uma margem de segurança de uns 5%, porque 1 MB pode ser contado como 1.000.000 bytes ou como 1.048.576 bytes (o chamado MiB), e sistemas diferentes usam um ou outro. Se você usa a [ferramenta](/), essa margem já é aplicada automaticamente: informe o limite do tribunal, não um valor menor.
3. **Número de páginas**: alguns sistemas limitam páginas por arquivo, além do tamanho. Verifique se há esse limite no seu caso.
4. **Ordem**: os documentos estão na sequência em que são citados na petição? Uma procuração no fim do lote confunde quem lê.
5. **Nomes dos arquivos**: use nomes curtos, sem acento ou caracteres especiais, e numerados: `01_procuracao.pdf`, `02_contrato.pdf`. Se um documento foi dividido, nomeie as partes em sequência: `03_extratos_parte_01.pdf`, `03_extratos_parte_02.pdf`.
6. **Legibilidade em zoom normal**: abra cada anexo a 100% e leia um trecho. Se precisar de zoom para entender, a compressão foi forte demais ou a digitalização ficou ruim.
7. **Senha**: nenhum PDF pode ter senha de abertura. Se tiver, destrave no programa de origem antes de tudo.
8. **Assinatura digital**: o arquivo foi assinado (ICP-Brasil, padrão PAdES) por último, depois de compactar, dividir ou juntar? Qualquer alteração depois da assinatura a invalida.
9. **PDF/A, quando exigido**: PDF/A é uma variante do PDF pensada para arquivamento de longo prazo. Nem todo sistema exige esse formato; se o seu exigir, converta antes de assinar e confira se o resultado abre normalmente.
10. **Descrição no sistema**: ao anexar, escolha o tipo de documento correto e escreva uma descrição clara ("Contrato de locação", não "doc3"). Isso ajuda quem julga e você mesmo, quando precisar localizar a peça.

## Como organizar o lote

A organização começa antes do protocolo, na pasta do computador.

- Crie uma pasta só para aquele protocolo e coloque nela apenas os arquivos finais.
- Numere os arquivos na ordem em que aparecem na petição. Assim a lista da pasta já mostra a sequência certa.
- Prefira um documento por arquivo. Um PDF gigante com tudo dentro dificulta a leitura e aumenta a chance de estourar o limite.
- Quando um documento grande precisar ser dividido, divida por páginas em partes sequenciais e nomeie com `parte_01`, `parte_02`, e assim por diante. A ordem se mantém e quem lê entende que é um documento só.

A [ferramenta de compactar e dividir PDF](/) deste site ajuda nos itens 2 e 5: você informa o limite e ela compacta o arquivo e, se ainda assim não couber, divide em partes numeradas. Tudo acontece no seu navegador, sem enviar os arquivos para nenhum servidor.

## Por que os arquivos ficam grandes

PDFs escaneados são grandes porque cada página é uma imagem. Reduzir a resolução (o dpi, que é a quantidade de pontos por polegada) e a qualidade JPEG dessas imagens diminui muito o tamanho. Texto vindo de um editor, como a própria petição, ocupa pouco espaço e raramente precisa de compressão.

Na hora de digitalizar documentos de texto, escolha preto e branco a 300 dpi. O arquivo sai pequeno e nítido. Colorido a 300 dpi gera arquivos muito maiores, e só vale a pena quando a cor importa, como em fotos ou plantas.

Se o anexo for digitalizado, vale também ativar o OCR no scanner: ele cria uma camada de texto invisível sobre a imagem que permite pesquisar e selecionar o conteúdo. Uma compressão que atua só nas imagens, como a desta ferramenta, preserva essa camada; métodos que convertem a página inteira em uma nova imagem apagam o texto. Depois de compactar, teste com Ctrl+F se a busca ainda funciona.

## O que fazer se o sistema recusar o arquivo

As causas mais comuns e o que fazer em cada uma:

- **"Arquivo excede o tamanho máximo"**: compacte o PDF. Se continuar acima do limite, divida em partes e anexe cada uma com a descrição indicando "parte 1 de 3", "parte 2 de 3".
- **"Formato inválido" ou "arquivo corrompido"**: abra o arquivo em outro leitor de PDF. Se não abrir, exporte de novo a partir do original. Se o sistema exigir PDF/A, converta.
- **"Arquivo protegido"**: há senha ou restrição de edição. Remova no programa de origem e gere um novo PDF.
- **"Assinatura inválida"**: o arquivo foi alterado depois de assinado. Refaça a assinatura sobre a versão final.
- **Erro sem mensagem clara**: tente outro navegador ou reduza o número de anexos por envio. Se persistir, procure o suporte do tribunal e guarde o comprovante da tentativa.

Depois de corrigir, confira de novo a legibilidade e a assinatura do arquivo novo. Um arquivo compactado às pressas pode ficar ilegível, e isso é pior do que um arquivo grande.

## Antes de clicar em protocolar

Esta ferramenta e este guia não são oficiais nem vinculados a nenhum tribunal. As regras de cada sistema mudam, e o único jeito seguro é abrir cada anexo final, conferir o conteúdo, a ordem e a assinatura — os assinados passam pelo [verificador de assinatura](/conferir-assinatura/) em segundos, e o [Raio-X do PDF](/metadados-pdf/) mostra o que os arquivos estão levando junto — e só então protocolar.

## Perguntas frequentes

### Devo compactar antes ou depois de assinar?

Sempre antes. Compactar, dividir, juntar ou converter para PDF/A são alterações no arquivo, e qualquer alteração depois da assinatura a invalida. A assinatura é a última etapa.

### Como saber o limite de tamanho do meu tribunal?

Os limites variam entre tribunais, sistemas e tipos de petição. Consulte o [diretório de limites por tribunal](/tribunais/) e, na dúvida, confira também a página de ajuda do próprio sistema.

### Dividir o documento em partes atrapalha a leitura?

Não, desde que as partes sejam nomeadas em sequência (parte_01, parte_02) e descritas no sistema como partes de um mesmo documento. A ordem das páginas se mantém.
