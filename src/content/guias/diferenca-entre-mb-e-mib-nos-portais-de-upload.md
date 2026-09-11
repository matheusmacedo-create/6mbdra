---
title: "MB ou MiB? Por que seu PDF é recusado no limite de upload"
description: "Entenda a diferença entre MB e MiB, como Windows e macOS mostram tamanhos e por que deixar margem de segurança ao enviar PDFs ao tribunal."
updated: 2026-09-10
tags:
  - tamanho de arquivo
  - peticionamento
  - PJe
---

Você conferiu o tamanho do arquivo, viu "5,9 MB" na tela, tentou enviar em um sistema que aceita "até 6 MB" e recebeu uma mensagem de erro dizendo que o arquivo é grande demais. Não é defeito do sistema, e não é culpa sua: existem duas formas diferentes de contar um "megabyte", e nem todo programa usa a mesma.

Esse detalhe passa despercebido no dia a dia, mas em peticionamento eletrônico ele custa tempo. Um upload recusado no fim do expediente, com prazo vencendo, é o tipo de problema que ninguém quer enfrentar. A boa notícia é que a solução é simples: entender a diferença e deixar uma pequena folga.

Neste guia você vai ver o que são MB e MiB, por que o Windows e o macOS mostram números diferentes para o mesmo arquivo, o que é margem de segurança e por que vale a pena mirar um pouco abaixo do limite do tribunal.

## Duas formas de contar o mesmo arquivo

O tamanho de um arquivo é medido em bytes. O problema começa quando esse número fica grande e passamos a usar "mega":

- **MB (megabyte decimal):** 1 MB = 1.000.000 bytes. É a contagem "redonda", igual à que usamos para metros e quilômetros.
- **MiB (mebibyte, contagem binária):** 1 MiB = 1.048.576 bytes. É a contagem tradicional da computação, baseada em potências de 2.

A diferença é de cerca de 4,9%. Parece pouco, mas é justamente essa fatia que faz um arquivo "de 6 MB" ser aceito em um lugar e recusado em outro.

Para complicar, muitos programas escrevem "MB" na tela mesmo quando estão contando em MiB. Ou seja, a sigla que você vê nem sempre diz qual conta foi feita.

## Como o Windows e o macOS mostram o tamanho

Os dois sistemas mais usados em escritórios calculam de jeitos diferentes:

- **Windows:** o Explorador de Arquivos usa a contagem binária (1.048.576 bytes), mas exibe a sigla "MB". Um arquivo de 6.200.000 bytes aparece como aproximadamente 5,91 MB.
- **macOS:** o Finder usa a contagem decimal (1.000.000 bytes). O mesmo arquivo aparece como 6,2 MB.

O arquivo é idêntico. Só o número na tela muda. Se você usa Windows e vê "5,91 MB", pode achar que está dentro de um limite de 6 MB, mas o arquivo tem, na verdade, 6,2 milhões de bytes.

Uma forma de escapar da confusão é olhar o tamanho exato em bytes. No Windows, clique com o botão direito no arquivo, escolha Propriedades e veja o número entre parênteses. No macOS, selecione o arquivo, pressione Cmd+I e veja o valor em bytes ao lado do tamanho.

## E o portal do tribunal, conta como?

Aqui está o ponto central: cada sistema de peticionamento decide, internamente, qual conta usar. Um sistema pode tratar "6 MB" como 6.000.000 bytes; outro, como 6 x 1.048.576 = 6.291.456 bytes. Essa informação raramente aparece na tela de upload.

Os limites também variam bastante, algo entre cerca de 1,5 MB e 20 MB, conforme o tribunal, o sistema (PJe, eproc, e-SAJ, Projudi) e o tipo de petição. Antes de preparar o arquivo, confira o valor no [diretório de limites por tribunal](/tribunais/).

Como você não controla qual conta o portal faz, o caminho mais seguro é assumir o pior caso: a contagem decimal, que resulta no limite menor.

## O que é margem de segurança

Margem de segurança é a folga que você deixa entre o tamanho do arquivo e o limite do sistema. Em vez de tentar chegar a exatos 6 MB, você mira em algo como 5,7 MB.

Essa folga de uns 5% cobre três situações comuns:

1. **A diferença entre MB e MiB**, que sozinha chega a quase 5%.
2. **Arredondamentos na tela**, que escondem alguns milhares de bytes.
3. **Pequenas alterações depois da compactação**, como assinar digitalmente, o que pode acrescentar alguns quilobytes ao arquivo.

Na prática, ao usar a [ferramenta de compactar e dividir PDF](/), informe um limite um pouco abaixo do que o tribunal exige. Se o portal aceita 6 MB, peça arquivos de até 5,7 MB. Tudo acontece no seu navegador: nenhum arquivo é enviado a servidor.

## Como conferir antes de protocolar

Um roteiro rápido:

- Confira o limite do seu tribunal no [diretório de limites por tribunal](/tribunais/).
- Compacte ou divida o PDF mirando uns 5% abaixo desse limite.
- Verifique o tamanho em bytes, não apenas o número arredondado na tela.
- Abra o arquivo final e confira se todas as páginas estão lá e legíveis.
- Se dividiu em partes, nomeie em sequência (parte_01, parte_02) para manter a ordem.

Lembre-se: esta ferramenta não é oficial nem vinculada a nenhum tribunal. Sempre confira o documento antes de protocolar e siga as orientações do sistema que você utiliza.

## Perguntas frequentes

### Meu arquivo mostra 5,9 MB no Windows. Cabe em um limite de 6 MB?

Não dá para garantir. No Windows, "5,9 MB" corresponde a cerca de 6,18 milhões de bytes. Se o portal contar em decimal (6.000.000 bytes), o arquivo será recusado. Reduza um pouco mais ou divida o documento.

### Que limite devo informar na ferramenta?

Um valor uns 5% abaixo do limite do tribunal. Essa folga cobre a diferença entre MB e MiB, os arredondamentos da tela e o pequeno aumento causado pela assinatura digital. Assim, o arquivo tende a passar em qualquer forma de contagem.

### Qual é a forma mais confiável de ver o tamanho real de um arquivo?

Olhe o valor em bytes nas propriedades do arquivo (Windows) ou na janela de informações (macOS). Esse número não depende de sigla nem de arredondamento e é o que o sistema do tribunal realmente compara com o limite.
