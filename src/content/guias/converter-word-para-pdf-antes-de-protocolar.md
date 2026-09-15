---
title: "Como converter Word em PDF antes de protocolar"
description: "Como exportar a petição do Word ou LibreOffice para PDF com fontes embutidas, texto pesquisável e o tamanho certo, sem os erros dos conversores online."
updated: 2026-09-14
tags:
  - converter word
  - peticionamento
  - PDF
---

A petição nasce em Word ou LibreOffice, mas nenhum sistema de peticionamento aceita `.docx` como peça processual — só PDF. O passo de converter parece trivial e, mesmo assim, é onde aparecem arquivos enormes, texto que virou imagem ou um layout que muda na hora H.

## Exportar, não "imprimir para PDF"

Existem dois caminhos para sair do Word com um PDF, e eles não são equivalentes:

- **Exportar/Salvar como PDF** (Arquivo → Exportar → Criar PDF/XPS, no Word; Arquivo → Exportar como → Exportar como PDF, no LibreOffice) gera o arquivo direto da estrutura do documento: texto continua texto, fontes ficam embutidas corretamente e o tamanho final costuma ser pequeno.
- **Imprimir usando a impressora virtual "Microsoft Print to PDF"** passa o documento pelo mecanismo de impressão do Windows. Em documentos simples o resultado é parecido, mas em petições com logotipo, papel timbrado ou tabelas complexas o arquivo frequentemente sai bem maior, porque partes do conteúdo acabam rasterizadas — viram imagem em vez de continuar texto.

Para uma petição, a exportação nativa é sempre a escolha mais segura. É mais rápida, produz arquivo menor e preserva o texto pesquisável, que interessa tanto para quem lê quanto para o próprio sistema do tribunal indexar o conteúdo.

## No Word

1. **Arquivo → Exportar → Criar PDF/XPS** (ou Salvar Como → tipo PDF).
2. Na janela que abre, o Word oferece dois perfis: **Padrão** (melhor qualidade, arquivo maior) e **Tamanho mínimo** (compressão de imagens mais agressiva). Para uma petição de texto puro isso quase não muda nada; para uma petição com muitas imagens anexadas no próprio corpo, o tamanho mínimo já ajuda bastante.
3. Em **Opções**, vale conferir se "Texto compatível com leitor de tela" e "Estrutura do documento" estão marcados — isso ajuda tanto na acessibilidade quanto na navegação do PDF final.

## No LibreOffice Writer

1. **Arquivo → Exportar como → Exportar como PDF**.
2. Na aba **Geral**, o campo **Qualidade da imagem JPEG** controla a compressão de fotos e digitalizações embutidas no documento — reduzir esse valor diminui o tamanho sem afetar o texto, que é vetorial e não sofre com essa configuração.
3. Se o tribunal exigir PDF/A na petição inicial, a mesma janela tem a opção **Arquivar (PDF/A)**. Veja [quando o tribunal exige PDF/A](/guias/pdf-a-quando-o-tribunal-exige/) para entender o que muda no resultado.

## Conferir antes de anexar

Depois de exportar, dois testes rápidos evitam retrabalho:

- **Ctrl+F no PDF gerado e procure uma palavra do texto.** Se encontrar, o conteúdo continua pesquisável — é o comportamento esperado de uma exportação nativa.
- **Compare o tamanho do PDF com o do documento original.** Um crescimento grande costuma vir de imagens embutidas em alta resolução (brasão, logotipo do escritório, foto colada no corpo do texto), não do texto em si.

## Evite conversores online para a petição

Sites que convertem Word em PDF "de graça" recebem o arquivo em um servidor de terceiros antes de devolver o resultado. Para uma minuta de petição isso raramente é um problema grave, mas para documentos com informação sigilosa — segredo de justiça, dados de menor, informação financeira — o caminho mais seguro é sempre a exportação local, direto do Word ou do LibreOffice, sem passar por servidor nenhum.

## Se o PDF final ainda ficar grande

Papel timbrado com imagem de fundo, brasão em alta resolução ou uma petição com dezenas de páginas de texto justificado podem gerar um arquivo maior do que o limite do tribunal, mesmo exportado corretamente. Nesse caso, o [brpdf](/comprimir-pdf/) reduz o arquivo até a margem segura do sistema escolhido, sem sair do navegador e sem alterar o texto.

## Leia também

- [Comprimir PDF para protocolo](/comprimir-pdf/)
- [PDF/A: quando o tribunal exige e como converter](/guias/pdf-a-quando-o-tribunal-exige/)
- [Checklist antes de protocolar anexos em PDF](/guias/checklist-antes-de-protocolar-anexos-em-pdf/)
