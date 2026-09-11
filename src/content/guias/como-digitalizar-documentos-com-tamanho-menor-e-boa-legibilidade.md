---
title: "Como digitalizar documentos com tamanho menor e boa legibilidade"
description: "Configurações de scanner e celular para gerar PDFs pequenos e nítidos, com preto e branco ou cor, 200 a 300 dpi, OCR e organização dos arquivos."
updated: 2026-09-10
tags:
  - digitalização
  - scanner
  - pdf
---

Boa parte dos PDFs que estouram o limite do peticionamento eletrônico já nasce grande na digitalização. Um contrato escaneado em cores e em resolução alta pode ficar várias vezes maior do que o mesmo contrato digitalizado em preto e branco, e ainda mais difícil de ler na tela.

Isso acontece porque um PDF escaneado é, na prática, uma sequência de fotografias: cada página é uma imagem. O tamanho do arquivo depende da resolução dessa imagem e de quantas cores ela guarda. Ajustar esses dois pontos no scanner ou no aplicativo do celular resolve a maior parte do problema antes mesmo de você precisar comprimir alguma coisa.

Lembre que os limites de tamanho variam muito conforme o tribunal, o sistema e o tipo de petição (de pouco mais de 1 MB a dezenas de megabytes por arquivo). Confira o valor do seu caso no [diretório de limites por tribunal](/tribunais/).

## Por que o PDF escaneado fica grande

- **Resolução (dpi)**: dpi significa "pontos por polegada", ou seja, quantos pontos o scanner captura em cada polegada de papel. Quanto mais pontos, mais detalhe e mais bytes. Dobrar o dpi multiplica a quantidade de pontos por quatro.
- **Cores**: uma página colorida guarda três valores para cada ponto (vermelho, verde e azul). Em tons de cinza, guarda um. Em preto e branco puro, cada ponto é apenas "preto" ou "branco", o que ocupa muito menos espaço.

Por comparação, uma petição escrita em editor de texto e exportada em PDF costuma ser pequena, porque texto nativo ocupa pouco espaço.

## Preto e branco, tons de cinza ou colorido?

- **Preto e branco (1 bit)**: a melhor escolha para contratos, procurações, certidões, decisões impressas e qualquer documento que seja basicamente texto. A 300 dpi, com a compressão chamada CCITT G4 (que muitos scanners aplicam automaticamente nesse modo), o arquivo fica pequeno e o texto sai nítido.
- **Tons de cinza**: use quando o documento tem fundo manchado, texto muito claro ou fotos em preto e branco que ficariam "chapadas" no modo 1 bit. Fica maior do que em preto e branco, mas menor do que em cores.
- **Colorido**: só quando a cor é informação, e não enfeite. Colorido a 300 dpi gera arquivos muito maiores.

## Quando o colorido faz diferença

Há páginas em que a cor importa: carimbos e selos de cartório, assinaturas com caneta azul (que podem sumir em preto e branco), grifos e anotações à mão, documentos com elementos de segurança coloridos e fotografias usadas como prova.

A estratégia mais eficiente é misturar: digitalize em cores apenas essas páginas e o restante em preto e branco, depois junte tudo em um único PDF. Se o scanner não permite misturar, digitalize em dois lotes.

## Resolução: fique entre 200 e 300 dpi

- **300 dpi** é o padrão seguro para texto. Fica legível em qualquer tela, imprime bem e dá bom resultado no OCR.
- **200 dpi** ainda é legível e reduz bastante o tamanho. Funciona para letras grandes e para páginas que você precisa manter em cor.
- **Acima de 300 dpi** quase nunca é necessário para peticionamento. Só aumenta o arquivo, sem ganho visível.

## Configurando o scanner de mesa ou multifuncional

Os menus mudam de marca para marca, mas as opções costumam ser parecidas:

1. Formato de saída: **PDF**, não JPEG nem TIFF.
2. Modo de cor: "Preto e branco", "Texto" ou "Documento". Evite "Foto" e "Alta qualidade".
3. Resolução: **300 dpi**.
4. Se houver a opção "PDF pesquisável" ou "OCR", ative.
5. Se houver a opção "compressão" ou "tamanho do arquivo", escolha o nível médio ou alto. Para texto, a diferença visual costuma ser pequena.

## Digitalizando pelo celular

O aplicativo de arquivos ou de notas de muitos celulares já tem uma função de digitalizar documentos, e ela costuma dar resultado melhor do que tirar fotos com a câmera:

- Salve como **PDF**, e não como fotos JPEG na galeria. Uma foto de câmera é grande, e cada página vira um arquivo separado.
- Escolha o filtro "Documento" ou "Preto e branco" para páginas de texto.
- Apoie o papel em superfície plana, com boa luz e sem sombras, e deixe o aplicativo fazer o recorte e a correção de perspectiva.
- Digitalize todas as páginas em uma única sessão para que saiam em um só PDF, na ordem certa.

## OCR na hora de digitalizar

OCR (reconhecimento óptico de caracteres) é o recurso que "lê" a imagem e cria uma camada de texto invisível sobre ela. Você não vê a diferença, mas passa a poder buscar palavras, selecionar trechos e copiar o conteúdo, o que poupa tempo de quem vai ler o processo.

Vale ativar o OCR já na digitalização; a camada de texto ocupa pouco espaço. A [ferramenta de compactar e dividir PDF](/) preserva essa camada ao comprimir, mas outros programas podem descartá-la; se você comprimir em outro lugar, confira depois se a busca por palavras continua funcionando.

## Organização dos arquivos

- Um documento por arquivo: procuração, contrato, comprovante, cada um em seu PDF.
- Nomes descritivos, sem acentos ou caracteres especiais, por exemplo `2026-09-10_procuracao_joao.pdf`.
- Se precisar dividir um arquivo, nomeie as partes em sequência (`parte_01`, `parte_02`) para manter a ordem.
- Assine digitalmente só depois de todas as alterações. Alterar um PDF já assinado invalida a assinatura.

## Se mesmo assim o arquivo ficou grande

Documentos antigos ou recebidos de terceiros nem sempre seguem essas configurações. Nesses casos, a ferramenta reduz a resolução e a qualidade das imagens e, se ainda não couber no limite, divide o arquivo em partes numeradas. Tudo acontece no seu navegador; nenhum arquivo sai do seu computador.

A ferramenta não é oficial nem vinculada a nenhum tribunal. Abra o PDF final, confira se todas as páginas estão legíveis e na ordem, e só então assine e protocole.

## Perguntas frequentes

### Posso enviar as fotos do celular direto, sem transformar em PDF?

Não é recomendado. Fotos JPEG são grandes, saem em arquivos separados e costumam ter perspectiva torta e sombras. Use a função de digitalização do celular, escolha o filtro de documento e salve como PDF.

### Digitalizar em preto e branco não estraga a assinatura em caneta?

Pode deixar traços finos falhados. Se a assinatura ou o carimbo são importantes naquele documento, digitalize aquela página em cores ou em tons de cinza e mantenha o resto em preto e branco.

### Vale a pena redigitalizar arquivos antigos que ficaram grandes?

Se você ainda tem o papel, sim: é a solução definitiva. Se não tem, comprima o arquivo existente e confira a legibilidade antes de protocolar.
