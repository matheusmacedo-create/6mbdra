# Arquivo real com Content Credentials (C2PA)

`com-credenciais.jpg` vem das fixtures públicas do projeto oficial
[c2pa-rs](https://github.com/contentauth/c2pa-rs), sob licença Apache-2.0/MIT. Não tem conteúdo
significativo — é uma imagem de teste gerada pelo próprio projeto.

Está aqui porque um manifesto C2PA montado por nós provaria apenas que o nosso leitor entende o que
o nosso gerador escreve. Com este, o teste confere a leitura contra a saída real da implementação
de referência: caixas JUMBF, CBOR, e o `claim_generator` lido pelo comprimento declarado.

É JPEG, e não PDF, porque C2PA em PDF praticamente não existe em circulação hoje — medimos 166 PDFs
(incluindo um exportado do Adobe Express) e nenhum trazia manifesto. A especificação prevê o caso
em PDF, e o código lê do mesmo jeito; o que falta é o mundo emitir.
