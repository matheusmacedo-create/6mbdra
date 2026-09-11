---
title: "Como compactar PDF para peticionamento eletrônico"
description: "Entenda por que o PDF ficou grande, o que a compressão muda na qualidade e como reduzir o arquivo para caber no limite do tribunal, no navegador."
updated: 2026-09-10
tags:
  - compactar pdf
  - peticionamento eletrônico
  - pje
---

Você termina a petição, anexa os documentos, clica em enviar e o sistema devolve a mensagem de que o arquivo excede o tamanho permitido. É uma das situações mais comuns no peticionamento eletrônico, e quase sempre acontece na pior hora: perto do fim do prazo.

A boa notícia é que, na maioria dos casos, o problema tem solução rápida. Um PDF grande costuma ser grande por um motivo simples, e a compressão resolve sem que o documento perca a legibilidade. Este guia explica de onde vem o tamanho, o que muda quando você comprime, como escolher o limite certo e o que fazer quando comprimir não basta.

Uma ressalva importante antes de começar: este site e a ferramenta não são oficiais nem têm vínculo com nenhum tribunal. Sempre confira o documento final antes de protocolar.

## Por que o PDF fica tão grande

A causa mais frequente é a digitalização. Quando você escaneia um contrato ou uma procuração, cada página vira uma fotografia. O PDF guarda essa fotografia inteira, mesmo que a página só tenha texto preto em fundo branco. Um documento de algumas dezenas de páginas escaneado em cores pode chegar facilmente a dezenas de megabytes.

Já o texto digitado em um editor (como a petição em si, salva diretamente em PDF) ocupa pouquíssimo espaço. Um texto de 20 páginas raramente passa de algumas centenas de KB. Por isso, o vilão quase sempre está nos anexos escaneados, não na peça.

Dois fatores definem o tamanho de uma página escaneada:

- **Resolução (dpi)**: é a quantidade de pontos por polegada, ou seja, o nível de detalhe da imagem. Quanto maior, mais detalhe e mais espaço. Para documentos de texto, 300 dpi já é suficiente para leitura e impressão.
- **Cor e qualidade da imagem**: colorido a 300 dpi gera arquivos muito maiores que preto e branco a 300 dpi. A qualidade do JPEG (o formato de imagem geralmente usado para guardar cada página) também pesa: quanto mais alta, maior o arquivo.

## O que a compressão faz

Comprimir um PDF escaneado é, basicamente, reprocessar as imagens de cada página: diminuir a resolução até um valor adequado e reduzir a qualidade JPEG para um nível em que a diferença quase não se percebe. O texto continua legível, os carimbos e assinaturas continuam visíveis, mas o arquivo fica bem menor.

Se o seu PDF tem OCR (uma camada de texto invisível sobre a imagem, que permite buscar palavras e selecionar trechos), a [ferramenta de compactar e dividir PDF](/) preserva essa camada ao comprimir. Ou seja, o documento continua pesquisável depois de comprimido. Nem todo programa faz isso, então, se você usar outro, vale testar a busca no resultado.

## O que muda na qualidade

A compressão sempre envolve uma troca: menos espaço, um pouco menos de detalhe. Na prática, para documentos de texto, a diferença costuma ser imperceptível na tela e na impressão. Onde você pode notar alguma perda:

- Fotos e imagens com muitos tons, como laudos com fotografias.
- Textos muito pequenos ou apagados, como notas de rodapé de contratos antigos.
- Documentos já digitalizados em baixa qualidade.

A regra prática é comprimir o mínimo necessário para caber no limite, e sempre abrir o resultado para conferir as páginas mais delicadas.

## Como escolher o limite certo

Os limites de tamanho por arquivo variam bastante: algo entre 1,5 MB e 20 MB, conforme o tribunal, o sistema (PJe, eproc, e-SAJ, Projudi) e o tipo de petição. Não existe um número único. Antes de comprimir, confira o valor do seu caso no [diretório de limites por tribunal](/tribunais/).

Um detalhe que engana muita gente: há dois jeitos de contar megabytes. No sistema decimal, 1 MB tem 1.000.000 de bytes. No binário, 1 MiB tem 1.048.576 bytes. Sistemas diferentes podem usar um ou outro, e o arquivo que parece caber pode ser recusado por uma diferença mínima. Por isso, deixe uma margem de segurança de uns 5%: se o limite é 10 MB, mire em algo perto de 9,5 MB.

## Passo a passo na ferramenta

A ferramenta funciona inteiramente no seu navegador. Nenhum arquivo é enviado a servidor, o que importa quando o documento tem dados de clientes.

1. Abra a ferramenta e selecione o PDF (ou arraste o arquivo para a página).
2. Escolha o limite de tamanho do seu tribunal. Se tiver dúvida, use o diretório e aplique a margem de 5%.
3. Inicie a compressão e aguarde. Arquivos grandes podem levar alguns segundos.
4. Baixe o resultado e abra o PDF para conferir se as páginas continuam legíveis.
5. Só depois disso, assine digitalmente, se for o caso.

Sobre a assinatura: se o PDF já está assinado com certificado digital (ICP-Brasil, padrão PAdES), qualquer alteração invalida a assinatura. O caminho correto é comprimir primeiro e assinar depois. E se o arquivo tem senha de abertura, ele precisa ser destravado no programa de origem antes, porque a ferramenta não consegue ler um PDF fechado.

## Dicas para evitar o problema na origem

- Digitalize documentos de texto em preto e branco (1 bit, no formato CCITT G4) a 300 dpi. O resultado é nítido e pequeno.
- Use colorido apenas quando a cor importa, como em fotos de laudo ou selos.
- Salve a petição direto do editor de texto em PDF, sem imprimir e escanear.

## Quando nem a compressão resolve

Às vezes o documento é tão longo que, mesmo comprimido até o ponto aceitável, continua acima do limite. Comprimir mais deixaria o texto ilegível. Nessa situação, a solução é dividir o PDF em partes menores, cada uma dentro do limite, e protocolar cada parte como um documento separado. A mesma ferramenta faz isso: divide por páginas inteiras e nomeia as partes em sequência (parte_01, parte_02), para você não perder a ordem.

## Perguntas frequentes

### Comprimir o PDF altera o conteúdo do documento?

A compressão muda a forma como as imagens são guardadas, não o teor do que está escrito. O que você precisa garantir é que o texto continue legível e que a assinatura digital seja feita depois da compressão, não antes.

### O arquivo comprimido ainda dá para pesquisar palavras?

Se o original tinha camada de OCR, a ferramenta a preserva. Se o original era só imagem, sem OCR, ele continua sem busca, comprimido ou não.

### Meus arquivos ficam guardados em algum lugar?

Não. A ferramenta processa tudo no navegador, e o arquivo não sai do seu computador. Ao fechar a aba, nada permanece.
