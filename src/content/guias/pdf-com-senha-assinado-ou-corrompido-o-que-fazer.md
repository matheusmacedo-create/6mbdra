---
title: "O que fazer com PDF com senha, assinado ou corrompido"
description: "Como reconhecer um PDF protegido por senha, assinado digitalmente ou corrompido, por que a ferramenta avisa e o que fazer em cada caso antes de protocolar."
updated: 2026-09-10
tags:
  - senha
  - assinatura digital
  - pdf corrompido
---

Nem todo PDF que passa do limite de tamanho pode ser simplesmente comprimido ou dividido. Há três situações em que a [ferramenta de compactar e dividir PDF](/) para e avisa antes de fazer qualquer coisa: o arquivo tem senha de abertura, já foi assinado digitalmente ou está corrompido. Em cada caso o motivo é diferente, e a solução também.

Nenhuma delas é um beco sem saída. Na maioria das vezes, basta voltar ao programa que gerou o arquivo, pedir uma nova cópia a quem enviou ou refazer a assinatura na ordem certa. O que você não deve fazer é descobrir o problema só na hora de protocolar.

Como os limites de tamanho variam muito conforme tribunal, sistema e tipo de petição (de pouco mais de 1 MB a dezenas de megabytes), confira o valor que se aplica a você no [diretório de limites por tribunal](/tribunais/).

## Como identificar cada caso

- **PDF com senha**: ao abrir, o leitor pede uma senha e não mostra nada até que ela seja digitada.
- **PDF assinado digitalmente**: o leitor mostra uma faixa com algo como "Assinado e todas as assinaturas são válidas" ou um painel de assinaturas. Muitas vezes há também um carimbo visual na página, com nome, CPF ou CNPJ e a menção a certificado ICP-Brasil.
- **PDF corrompido**: o arquivo não abre, mostra mensagem de erro, exibe páginas em branco ou aparece com tamanho zero ou muito menor do que deveria.

## PDF com senha

Existem dois tipos de proteção. A **senha de abertura** criptografa o conteúdo inteiro: sem ela, nenhum programa consegue ler as páginas, e por isso a ferramenta recusa o arquivo. A **senha de permissões** deixa o arquivo abrir, mas tenta restringir impressão ou edição; ela pode ou não impedir o processamento, dependendo de como foi aplicada.

O caminho correto é destravar o PDF no programa de origem, onde ele foi gerado ou onde você o abre com a senha:

1. Abra o arquivo digitando a senha.
2. Procure a opção de segurança ou as propriedades do documento e remova a senha, ou use "Salvar como" para gravar uma cópia sem proteção.
3. Se o programa não oferecer isso, use "Imprimir" e escolha a impressora virtual de PDF para gerar uma cópia nova. Atenção: esse caminho pode descartar a camada de texto do OCR (a camada invisível que permite buscar palavras) e os marcadores do arquivo.

Se você não tem a senha, não existe atalho legítimo. Peça a quem enviou o arquivo (banco, cartório, contabilidade, perito, cliente) uma versão sem proteção ou a senha correspondente.

## PDF assinado digitalmente

A assinatura digital com certificado ICP-Brasil, no padrão PAdES (o formato de assinatura próprio para PDF), funciona como um lacre matemático calculado sobre o conteúdo exato do arquivo. Qualquer alteração faz o lacre deixar de bater: comprimir imagens, dividir em partes, girar uma página e, em alguns programas, até salvar de novo. A assinatura deixa de valer.

Se você não tem certeza se o lacre deste arquivo ainda bate, dá para [conferir a assinatura aqui mesmo](/conferir-assinatura/), no navegador, antes de mexer em qualquer coisa.

É isso que o aviso "Assinado digitalmente" da ferramenta quer dizer: o arquivo fica de fora do lote por padrão, e só é processado se você clicar em "Processar mesmo assim". Se você seguir em frente, o resultado não terá mais uma assinatura válida. O carimbo visual pode continuar aparecendo na página; o que se perde é a verificação eletrônica.

O que fazer depende de quem assinou:

- **Você mesmo assinou**: volte ao arquivo anterior à assinatura, comprima ou divida, confira o resultado e assine de novo. A ordem certa é sempre preparar o PDF, depois assinar, depois protocolar. Se não guardou a versão sem assinatura, gere o documento novamente a partir do editor de texto ou do scanner.
- **Outra pessoa assinou** (procuração do cliente, laudo pericial, documento de órgão público): não altere o arquivo. Peça ao signatário uma versão menor, já assinada, ou verifique nas regras do sistema se há outra forma de anexar o documento. Se decidir protocolar uma cópia comprimida, saiba que a assinatura eletrônica não será mais verificável; avalie se isso é aceitável no seu caso.

## PDF corrompido

Um PDF corrompido tem a estrutura interna incompleta ou fora do formato esperado, e a ferramenta não consegue interpretar as páginas. As causas mais comuns são:

- download ou transferência interrompida;
- anexo cortado pelo serviço de e-mail por causa do tamanho;
- arquivo de outro formato renomeado para `.pdf`, como um `.docx` ou uma imagem.

Para recuperar, tente nesta ordem:

1. Confira o tamanho do arquivo. Se aparece 0 KB ou muito menos do que o esperado, o conteúdo não chegou inteiro.
2. Baixe ou copie o arquivo novamente da origem. Prefira links de compartilhamento a anexos de e-mail quando o arquivo for grande.
3. Tente abrir em outro leitor de PDF ou no navegador. Se abrir, use "Imprimir" com a impressora virtual de PDF para gerar uma cópia limpa.
4. Se o documento veio de um editor de texto, exporte-o de novo; se veio do scanner, digitalize outra vez; se recebeu de terceiros, peça o reenvio.

Quando você ainda tem acesso à fonte, gerar o arquivo de novo é mais rápido e confiável do que tentar programas "reparadores".

## A ordem certa para não repetir o trabalho

1. Destrave o PDF (remova a senha) no programa de origem.
2. Comprima e, se necessário, divida em partes nomeadas em sequência (`parte_01`, `parte_02`).
3. Mantenha uma margem de segurança de uns 5% abaixo do limite (a ferramenta aplica essa margem sozinha). Alguns sistemas contam 1 MB como 1.000.000 bytes e outros como 1.048.576 bytes (o chamado MiB), e essa diferença pode derrubar um arquivo que está no limite exato.
4. Abra cada arquivo final e confira se todas as páginas estão legíveis e na ordem.
5. Assine digitalmente.
6. Protocole.

A ferramenta roda inteiramente no seu navegador, sem enviar nada a servidor, e não é oficial nem vinculada a nenhum tribunal. Conferir o documento antes de protocolar é sempre responsabilidade sua.

## Perguntas frequentes

### A ferramenta remove a senha do meu PDF?

Não. Um PDF com senha de abertura está criptografado e precisa ser destravado no programa que o gerou ou em um leitor onde você digite a senha. Depois disso, a cópia sem proteção pode ser comprimida ou dividida normalmente.

### Comprimi um PDF assinado e o carimbo continua aparecendo. Está tudo certo?

Não necessariamente. O carimbo visual é só uma imagem; a assinatura eletrônica em si foi invalidada pela alteração. Se a assinatura precisa ser válida, use o arquivo anterior à assinatura e assine de novo após comprimir.

### O arquivo abre no meu computador, mas o sistema do tribunal diz que ele é inválido. E agora?

Alguns leitores toleram pequenos defeitos que os sistemas de peticionamento podem não aceitar. Gere uma cópia nova via "Imprimir" com a impressora virtual de PDF, ou exporte o documento outra vez da origem.
