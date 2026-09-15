# Marca do brpdf

Arquivos, onde cada um é usado, e três decisões que valem explicação.

## Arquivos

| Arquivo | Uso |
|---|---|
| `public/brpdf-logo.svg` | Logotipo completo (marca + wordmark). Embutido no cabeçalho de todas as páginas. |
| `public/brpdf-marca.svg` | Só a marca (documentos + lupa), sem o wordmark. Para usos pequenos e quadrados. |
| `public/favicon.svg` | Ícone da aba. **Não é um recorte da marca** — ver abaixo. |
| `public/og.png` | Cartão de compartilhamento, 1200×630. Gerado por script com o logotipo. |

Cores: `#2e2e2e` (lupa e fundo do favicon), `#424242` (wordmark), `#e6a822` (documentos),
`#dcdcdc` (linhas de texto dentro dos documentos).

## Três decisões

### 1. A assinatura ficou de fora

O arquivo original traz **"CONVERSÃO E ANÁLISE DE DOCUMENTOS LEGAIS"** sob o wordmark. Ela não
está em nenhum lugar do site, de propósito:

- **O brpdf não converte documentos.** Ele comprime, divide e junta. Não há conversão de formato,
  OCR ou extração de texto. Colocar "conversão" no cabeçalho seria prometer, em todas as 151
  páginas e no lugar mais visível possível, algo que a ferramenta não faz — e a pessoa que
  chegasse por essa promessa sairia sem encontrar.
- **"Documentos legais"** é anglicismo. Em português jurídico, "legal" quer dizer conforme a lei;
  o que se quis dizer é **documentos jurídicos**.

Se a assinatura for revista, uma que descreve o que existe hoje seria algo como
*"preparação de PDFs para o protocolo eletrônico"*. Enquanto isso, o cabeçalho usa a assinatura
curta que já existia: **PDF Jurídico**.

### 2. As cores viraram atributos, não estilo inline

O SVG entregue foi gerado por matplotlib e trazia toda a cor em `style="fill: …"` nas formas.

O site declara `style-src 'self'` **sem `unsafe-inline`** — a mesma política estrita descrita em
`/seguranca/verifique/`. O navegador bloqueia atributo `style` inline, e o resultado era a marca
inteira renderizando em preto: um borrão no cabeçalho.

A conversão para atributos de apresentação (`fill="#e6a822"` em vez de `style="fill: #e6a822"`)
resolve sem abrir exceção no CSP. **Qualquer SVG novo que entre no projeto precisa passar pela
mesma conversão** — ou vai aparecer preto.

O `<clipPath>` referenciado pelas formas também precisa vir junto; sem ele o desenho some.

### 3. O favicon não é um recorte da marca

A marca completa foi testada em 16px e vira borrão: traço fino e contorno vazado desaparecem
nesse tamanho. O que sobrevive é uma letra sólida com contraste alto.

Por isso o favicon é o **"br" em `#e6a822` sobre `#2e2e2e`** — deriva da paleta nova, não do
desenho. Foi escolhido comparando as duas opções renderizadas em 16, 32 e 64px.

## Tamanhos mínimos

Medido: o mark só fica legível a partir de **~26px de altura** isolado, e **36px** no contexto do
cabeçalho, onde concorre com a navegação. Abaixo disso, use `favicon.svg` ou só o wordmark.

## Uma observação sobre a tipografia

O wordmark usa **DejaVu Sans Bold** — a fonte padrão do matplotlib, embutida como contornos no
SVG (não depende de fonte instalada). O site usa **Inter**. As duas são sem serifa e convivem,
mas não são a mesma família: se um dia a marca for redesenhada por alguém, redesenhar o wordmark
em Inter alinharia a identidade.
