---
title: "O que é OCR e texto pesquisável no PDF"
description: "Entenda a diferença entre PDF de texto e PDF de imagem, por que o texto pesquisável importa no processo e como gerar e preservar o OCR."
updated: 2026-09-10
tags:
  - OCR
  - PDF
  - peticionamento
---

Nem todo PDF é igual por dentro. Alguns guardam o texto de verdade, letra por letra, e por isso você consegue selecionar um trecho, copiar e pesquisar uma palavra. Outros guardam apenas uma fotografia de cada página: parecem iguais na tela, mas para o computador são só imagens, sem nenhuma letra reconhecível.

Essa diferença afeta o dia a dia de quem trabalha com processo eletrônico. Um PDF que só tem imagem não pode ser pesquisado, não é lido por leitores de tela e costuma ser bem mais pesado. É aí que entra o OCR, que transforma a imagem em texto pesquisável sem mudar a aparência do documento.

Neste guia você vai entender o que é OCR, como descobrir se o seu PDF tem texto, o que acontece com essa camada quando você compacta o arquivo e como gerar OCR com o que já tem.

## PDF de texto e PDF de imagem

Um PDF de texto nasce em programas como Word, LibreOffice ou Google Docs. Quando você exporta a petição para PDF, o programa guarda as letras, as fontes e a posição de cada palavra. Isso ocupa pouco espaço: uma petição de 30 páginas costuma ter poucas centenas de KB.

Um PDF de imagem nasce no scanner ou na câmera do celular. Cada página é uma foto. Por isso um documento escaneado de 30 páginas pode chegar facilmente a dezenas de MB, e você não consegue selecionar nem pesquisar nada nele.

Existe ainda um terceiro tipo, que é o mais útil para anexos digitalizados: o PDF de imagem com OCR. Ele continua mostrando a foto da página, mas por baixo dela existe uma camada de texto invisível.

## O que o OCR faz

OCR é a sigla em inglês para reconhecimento ótico de caracteres. Em termos simples, é um programa que "lê" a imagem da página, identifica as letras e cria uma camada de texto invisível sobre a imagem. Você continua vendo o documento escaneado como sempre, mas agora pode:

- pesquisar uma palavra com Ctrl+F dentro do arquivo;
- selecionar e copiar um trecho para citar em outra peça;
- encontrar o documento pela busca de conteúdo do sistema processual, quando ele oferece essa função;
- permitir que leitores de tela leiam o documento para pessoas com deficiência visual.

O OCR não é perfeito. Em documentos com letra manuscrita, carimbos por cima do texto ou digitalização torta e escura, o reconhecimento erra mais. Por isso a camada de texto serve de apoio à busca, mas o que vale é a imagem visível da página.

## Por que texto pesquisável importa no processo

Além de encontrar um nome ou uma data em segundos, há razões práticas para preferir anexos com OCR:

- Quem vai ler o processo (magistrado, assessoria, a parte contrária) consegue localizar o que precisa sem folhear tudo.
- Documentos pesquisáveis são acessíveis a pessoas que usam leitores de tela.
- Alguns sistemas oferecem busca pelo conteúdo dos anexos, e um PDF sem camada de texto não é encontrado nessa busca.

## Como saber se o seu PDF tem texto

Há dois testes rápidos que qualquer pessoa consegue fazer:

1. Abra o PDF e tente selecionar um trecho com o mouse. Se o cursor marca palavras, há texto. Se ele desenha um retângulo sobre a página inteira, é só imagem.
2. Pressione Ctrl+F e pesquise uma palavra que aparece na página. Se não encontrar, não há camada de texto.

Dar zoom alto em uma letra mostra se a página é imagem (aparecem serrilhado ou pontinhos) ou texto nativo (continua nítida), mas não diz se há OCR por baixo.

## Compressão preserva ou destrói o OCR?

Depende de como a compressão é feita. Uma boa compressão trabalha apenas nas imagens: reduz a resolução (a quantidade de pontos por polegada, o dpi) e a qualidade JPEG, e deixa a camada de texto intacta. O resultado é um arquivo menor que continua pesquisável.

Já alguns métodos "achatam" o documento, convertendo cada página inteira em uma nova imagem. Nesse caso a camada de texto se perde, e o PDF volta a ser só uma foto. Se você usar um método assim, o OCR precisará ser refeito depois.

A [ferramenta de compactar e dividir PDF](/) deste site trabalha sobre as imagens e preserva a camada de texto existente, sem enviar o arquivo para servidor nenhum: todo o processamento acontece no seu navegador. Seja qual for a ferramenta usada, vale repetir o teste do Ctrl+F no arquivo final para confirmar que a busca continua funcionando.

Uma observação sobre a ordem das etapas: faça OCR e compressão antes de assinar digitalmente. Alterar um PDF já assinado (ICP-Brasil, padrão PAdES) invalida a assinatura, então a assinatura deve ser sempre a última etapa.

## Como gerar OCR com o que você já tem

Você não precisa de programa especializado. Algumas opções comuns:

- **Scanner ou multifuncional do escritório**: a maioria tem a opção "PDF pesquisável" ou "OCR" no painel ou no programa que acompanha o aparelho. Ative antes de digitalizar. Para documentos de texto, prefira digitalizar em preto e branco a 300 dpi: fica nítido e o arquivo sai pequeno.
- **Aplicativos de scanner no celular**: muitos reconhecem o texto automaticamente ao salvar em PDF. Procure a opção nas configurações do aplicativo.
- **Editores de PDF**: programas pagos e gratuitos costumam ter uma função chamada "Reconhecer texto" ou "OCR". Aplique e salve o arquivo.

Seja qual for a ferramenta, escolha o idioma português no reconhecimento, para que acentos e cedilhas sejam identificados corretamente.

## Antes de protocolar

Os limites de tamanho por arquivo variam bastante, algo entre 1,5 MB e 20 MB, conforme o tribunal, o sistema e o tipo de petição. Confira o valor que vale para o seu caso no [diretório de limites por tribunal](/tribunais/). Esta ferramenta não é oficial nem vinculada a nenhum tribunal: sempre abra o arquivo final e confira o conteúdo antes de protocolar.

## Perguntas frequentes

### OCR altera a aparência do documento?

Não. O OCR adiciona apenas uma camada de texto invisível. A imagem da página continua exatamente como foi digitalizada.

### Preciso de OCR na petição feita no Word?

Não. Um PDF exportado de um editor de texto já tem texto nativo e é pesquisável por natureza. O OCR serve para documentos digitalizados ou fotografados.

### Compactar o PDF vai apagar o texto pesquisável?

Se a compressão atua só nas imagens, como a desta ferramenta, o texto é preservado. Se ela converte a página inteira em imagem nova, o texto se perde. Faça o teste do Ctrl+F no arquivo final para ter certeza.
