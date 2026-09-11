---
title: "Como dividir PDF por tamanho sem perder a ordem"
description: "Quando dividir é melhor do que comprimir, como separar por páginas inteiras, nomear as partes em sequência e protocolar cada uma na ordem certa."
updated: 2026-09-10
tags:
  - dividir pdf
  - peticionamento eletrônico
  - eproc
---

Nem todo PDF grande cabe no limite do tribunal só com compressão. Um contrato de 200 páginas ou um laudo cheio de fotografias pode continuar acima do tamanho permitido mesmo depois de comprimido. Nessas horas, a saída é dividir o arquivo em partes menores e protocolar cada uma delas.

O receio de quem divide é perder a ordem: enviar a parte 3 antes da 2, esquecer uma página no meio ou deixar quem lê os autos sem saber onde o documento começa e termina. Com alguns cuidados simples, isso não acontece. Este guia mostra quando dividir, como nomear as partes e como protocolar de forma que qualquer pessoa entenda a sequência.

Vale lembrar: este site e a [ferramenta de compactar e dividir PDF](/) não são oficiais nem vinculados a nenhum tribunal. Confira sempre o documento antes de protocolar.

## Quando dividir é melhor do que comprimir mais

Comprimir é a primeira tentativa, porque mantém o documento em um arquivo só. Mas a compressão tem um ponto em que parar. Se, para caber no limite, o texto ficasse borrado ou as assinaturas do contrato virassem manchas, o documento deixaria de cumprir a sua função.

Divida quando:

- O PDF continua acima do limite mesmo com uma compressão razoável.
- O documento tem muitas fotografias ou páginas coloridas que não podem perder detalhe.
- O arquivo é muito longo, como autos completos ou um conjunto de notas fiscais.
- Você já comprimiu, conferiu a qualidade e não quer reduzir mais.

Os limites variam, algo entre 1,5 MB e 20 MB, conforme o tribunal, o sistema e o tipo de petição. Confira o valor do seu caso no [diretório de limites por tribunal](/tribunais/) antes de decidir o tamanho das partes.

## Divisão por páginas inteiras

A forma segura de dividir é por páginas inteiras: a parte 1 vai da página 1 até a 40, a parte 2 da 41 até a 80, e assim por diante. Nenhuma página é cortada ao meio e nenhuma se repete. Cada parte é um PDF completo que abre normalmente em qualquer leitor.

A ferramenta faz esse cálculo por você: você informa o limite de tamanho e ela agrupa as páginas em partes que fiquem dentro desse valor. Se uma página específica for maior do que o limite sozinha (uma foto em altíssima resolução, por exemplo), o caminho é comprimir o arquivo antes e só depois dividir.

Uma dica sobre o limite: 1 MB decimal tem 1.000.000 de bytes, enquanto 1 MiB (a medida binária) tem 1.048.576 bytes, e sistemas diferentes contam de jeitos diferentes. Para não ser surpreendido por uma recusa por poucos bytes, deixe uma margem de uns 5% abaixo do limite informado.

## Nomes sequenciais: parte_01, parte_02

O nome do arquivo é a sua primeira proteção contra a bagunça. Use sempre um padrão com número de dois dígitos e o nome do documento:

- contrato_parte_01.pdf
- contrato_parte_02.pdf
- contrato_parte_03.pdf

O zero à esquerda é importante. Sem ele, o computador ordena "parte_10" antes de "parte_2", e você pode anexar na ordem errada sem perceber. A ferramenta já gera os nomes nesse formato, mas vale conferir na pasta de downloads antes de subir para o sistema.

## Como protocolar as partes

No peticionamento eletrônico, cada parte é anexada como um documento separado, na ordem correta. Alguns cuidados:

1. Anexe uma parte por vez, começando pela parte 1.
2. Preencha a descrição de cada anexo indicando a sequência e o total, por exemplo: "Contrato - parte 1 de 3", "Contrato - parte 2 de 3", "Contrato - parte 3 de 3".
3. Se o sistema pedir um tipo de documento, use o mesmo para todas as partes (se a parte 1 é "Contrato", as demais também são).
4. Antes de confirmar o envio, revise a lista de anexos e veja se a ordem na tela é a mesma dos nomes dos arquivos.
5. Na petição, se fizer sentido, mencione que o documento foi juntado em partes por causa do limite de tamanho.

A descrição "parte X de Y" é o que permite a quem lê os autos saber, sem abrir os arquivos, que o documento é um só e quantas peças ele tem.

## Conferência de páginas

Depois de dividir e antes de protocolar, faça uma conferência rápida:

- Some as páginas de todas as partes. O total precisa ser igual ao do PDF original.
- Abra a última página de cada parte e a primeira da seguinte, para confirmar que o texto continua de onde parou.
- Confira se alguma parte ficou acima do limite (isso pode acontecer se o limite foi digitado errado).
- Se o documento tiver índice ou numeração própria, veja se ela segue sem saltos.

Essa checagem leva um ou dois minutos e evita uma nova petição só para juntar a página que faltou.

## Assinatura e senha

Se o documento precisa de assinatura digital com certificado (ICP-Brasil, no padrão PAdES), assine cada parte depois de dividir. Alterar um PDF já assinado invalida a assinatura, e dividir é uma alteração. Se o PDF original tem senha de abertura, destrave no programa em que ele foi criado antes de dividir, porque a ferramenta não consegue ler um arquivo fechado.

## Erros comuns

- **Anexar fora de ordem**: acontece quando os nomes não têm zero à esquerda ou quando os arquivos são selecionados às pressas. Confira a lista antes de enviar.
- **Descrição genérica**: escrever só "Contrato" nas três partes deixa quem lê sem saber a sequência. Use "parte 1 de 3".
- **Esquecer uma parte**: sem a conferência de páginas, é fácil deixar a última parte na pasta de downloads.
- **Dividir e depois comprimir demais**: se a compressão vem depois da divisão, você pode acabar com partes pequenas e ilegíveis. Comprima primeiro, na medida certa, e divida o que sobrar.
- **Assinar antes de dividir**: a assinatura se perde. Divida primeiro, assine depois.
- **Ignorar a margem de segurança**: uma parte com exatamente o tamanho do limite pode ser recusada dependendo de como o sistema conta os bytes.

## Perguntas frequentes

### Posso dividir um PDF que tem OCR sem perder a busca de texto?

Sim. Como a divisão por páginas inteiras copia cada página como ela é, a camada de texto invisível do OCR acompanha a página na parte correspondente.

### Quantas partes é razoável enviar?

Não há regra fixa. O ideal é que cada parte fique o mais próximo possível do limite (com a margem de 5%), para gerar o menor número de arquivos. Se sobrarem muitas partes, vale tentar uma compressão um pouco maior antes.

### A ferramenta guarda meus arquivos?

Não. Todo o processamento acontece no seu navegador, e nenhum arquivo é enviado a servidor. Ao fechar a página, nada fica armazenado.
