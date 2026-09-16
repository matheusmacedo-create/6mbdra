# Conferidor de assinaturas — Etapa 0 (sondagem das dependências)

A especificação do Conferidor marca a Etapa 0 como bloqueante: *"validar as três dependências
técnicas — biblioteca de parse PAdES e CAdES, tratamento das políticas brasileiras do DOC-ICP-15, e
obtenção e atualização das raízes ICP-Brasil. Nenhum desses três foi verificado ainda."*

Este documento é o resultado da sondagem, feita em 16/09/2026. Nada aqui é produto: é o que se
descobriu antes de prometer qualquer coisa ao usuário. As três dependências foram verificadas, e as
três passam — mas duas trazem armadilhas que mudam o desenho.

## Dependência 1 — parse PAdES no navegador: **viável**

`pkijs` 3.4.0 + `asn1js` 3.0.10 leem o CMS destacado do `/Contents` e conferem a integridade dentro
do navegador, sob a CSP real do site (`script-src 'self' 'wasm-unsafe-eval'`, sem `unsafe-inline`).

| Medida | Valor |
|---|---|
| Fixture PAdES assinada (cadeia de teste própria) | 17.293 bytes, ByteRange `[0 691 17077 216]` |
| Conferência de arquivo íntegro | 18 ms |
| Detecção de arquivo alterado | 5 ms |
| Custo das bibliotecas | 381 KB minificado, **81 KB gzip** |
| Custo hoje no pacote do site | **zero** — nenhum módulo do app importa o conferidor, então some no tree-shaking |

Não estão cobertos: validação de cadeia contra raízes reais, revogação, carimbo do tempo, DocMDP e
CAdES destacado (`.p7s`). A sonda cobre os estados 1 (conferida), 4 (quebrada) e 5 (sem assinatura),
que a spec identifica como a maioria esmagadora dos casos reais.

### A armadilha: sozinho, o `verify()` do pkijs nunca diria "documento alterado"

Foi a descoberta mais cara desta etapa. Quando o documento foi alterado, `SignedData.verify()` **não
devolve `false`** — ele **lança** `SignedDataVerifyError("Message digest doesn't match")`, com
`signatureVerified = null`. Nem o texto nem o campo estruturado distinguem *"alterado"* de *"não
consegui verificar"*.

Um módulo que confiasse só no `verify()` transformaria o aviso mais importante do produto —
*documento alterado, recupere o original* — num encolher de ombros: *"não deu para conferir, use o
validador do ITI"*. O estado que justifica a ferramenta existir simplesmente nunca apareceria.

A correção é comparar o resumo por conta própria, **antes** do `verify()`: o `message-digest` dos
atributos assinados contra o SHA-256 dos bytes do ByteRange. É aritmética nossa, não semântica de
exceção de terceiro. `tests/unit/assinatura.test.ts` trava isso com um teste que falha se alguém
"simplificar" o módulo de volta.

### A outra armadilha: impossibilidade de conferir virando veredito negativo

Na primeira execução da sonda num navegador real, um PDF perfeitamente íntegro foi reportado como
`quebrada`. A causa era de teste — a página era `about:blank`, que não é contexto seguro, então
`crypto.subtle` era `undefined` e o pkijs quebrava no `importKey`. Mas o modo de falha é real e
seria devastador em produção: mandar um advogado recuperar um original que nunca se perdeu destrói a
confiança na ferramenta no primeiro uso.

Regra que saiu daí, e que vale para todo o Conferidor: **impossibilidade de conferir nunca vira
veredito negativo.** Vira `indeterminada`, com encaminhamento ao validador oficial.

## Dependência 2 — políticas do DOC-ICP-15: **viável, e mais barato que o esperado**

A lista oficial de políticas de assinatura aprovadas para PDF é publicada em
`http://politicas.icpbrasil.gov.br/LPA_PAdES.der`: **2.949 bytes, 18 políticas em quatro famílias**.

| Ramo do OID | Sigla | O que a política exige |
|---|---|---|
| `2.16.76.1.7.1.11.*` | AD-RB | Quem assinou e se o conteúdo mudou. Não prova quando. |
| `2.16.76.1.7.1.12.*` | AD-RT | O mesmo, mais carimbo do tempo. |
| `2.16.76.1.7.1.13.*` | AD-RC | Carrega as provas de validade do certificado dentro do arquivo. |
| `2.16.76.1.7.1.14.*` | AD-RA | Feita para durar décadas, com carimbos acumulados. |

As entradas atuais valem até **02/03/2029**, então a lista muda raramente. É pequena o bastante para
viver no código (`src/tool/lib/politicas-icp.ts`) em vez de exigir busca em tempo de execução — o
que também mantém a promessa de funcionar offline.

Duas observações que importam:

- **Existem três listas diferentes, e é fácil pegar a errada.** `LPA.xml` (51 KB) cobre só XML-DSig;
  `LPA.der` (25 KB) cobre CMS/CAdES; só `LPA_PAdES.der` cobre PDF. A `LPA.xml` tem `NextUpdate` de
  **01/06/2016** e 20 das suas 30 políticas revogadas — quem a usasse por engano estaria conferindo
  contra uma lista de dez anos atrás.
- **Ler a política declarada não é verificar que ela foi cumprida.** O OID vem no atributo assinado
  `signature-policy-identifier` (RFC 5126 §5.8.1), então não dá para trocá-lo sem quebrar a
  assinatura — a leitura é confiável. Mas *cumprir* AD-RT exige conferir o carimbo do tempo, e
  *cumprir* AD-RC exige conferir as referências. Por isso o campo se chama `politica` **declarada**,
  e a interface não pode dizer mais do que isso.

## Dependência 3 — raízes ICP-Brasil: **obtíveis, mas o HTTPS do ITI está quebrado**

As raízes estão publicadas e são baixáveis. A raiz corrente é a **v13**:

```
Autoridade Certificadora Raiz Brasileira v13
válida de 14/02/2025 a 14/02/2045
SHA-256 2B:07:D0:BC:02:C4:A6:E0:47:8E:D2:2D:0D:99:E8:F9:7E:18:27:B2:69:09:76:96:A7:FE:B6:AA:D3:0C:3A:C8
```

As versões v5 a v13 respondem em `/credenciadas/RAIZ/ICP-Brasilv{N}.crt`; v14 ainda não existe. O
pacote completo das ACs (`ACcompactado.zip`) tem 351 KB.

**O obstáculo:** `https://acraiz.icpbrasil.gov.br` **não valida**. O servidor apresenta um
certificado Let's Encrypt (`CN=*.icpbrasil.gov.br`, emissor `YE1`) mas **envia só a folha, sem a
intermediária** — 1 certificado na cadeia, onde o host de teste da própria Let's Encrypt envia 3.
Navegadores costumam contornar isso buscando a intermediária por AIA; `curl`, um job de CI ou um
Worker, não. Toda busca automatizada por HTTPS falha com *"unable to get local issuer certificate"*.
O mesmo vale para `politicas.icpbrasil.gov.br`. (Confirmado que não é do nosso ambiente:
`valid-isrgrootx2.letsencrypt.org` valida normalmente pelo mesmo caminho de rede.)

Consequências para o desenho:

1. **Nenhuma busca em tempo de execução.** As raízes entram no código com o SHA-256 fixado. Um
   certificado é autoautenticável: se a impressão digital confere, a origem do download não importa,
   e isso torna o HTTP simples aceitável para a atualização — desde que a conferência seja manual e
   registrada.
2. **A atualização é um ritual, não um cron.** Com a v13 válida até 2045 e as políticas até 2029,
   isso custa pouco. Mas precisa estar escrito, ou envelhece em silêncio.
3. **Isto é matéria-prima de conteúdo.** "O site oficial que distribui as raízes da ICP-Brasil está
   com a cadeia TLS incompleta" é exatamente o tipo de coisa que a seção de segurança do brpdf
   existe para mostrar — e que reforça a tese do projeto.

## O que ainda não foi verificado

Nada disto está no caminho da Etapa 0, mas nenhum deles pode ser tratado como resolvido:

- Validação de cadeia de verdade contra as raízes ICP-Brasil (a sonda usa cadeia de teste própria).
- Revogação: LCR e OCSP, ambos com o mesmo problema de TLS acima.
- Carimbo do tempo (necessário para AD-RT em diante).
- DocMDP e assinaturas incrementais múltiplas: qual assinatura decide o estado do arquivo.
- CAdES destacado (`.p7s`), que é como boa parte dos tribunais entrega.
- Comportamento em Firefox e Safari: a sonda rodou em Chromium.

## Como reproduzir

```
node scripts/fixtures/gera-assinado.mjs   # regenera as fixtures assinadas
npx vitest run tests/unit/assinatura.test.ts
```
