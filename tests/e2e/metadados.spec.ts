import { test, expect, type Page } from '@playwright/test'
import { join } from 'node:path'

/*
 * Raio-X do PDF, ponta a ponta.
 *
 * As fixtures são montadas no próprio teste, com nomes inventados. A medição que originou esta
 * ferramenta encontrou o nome completo de uma pessoa real dentro de um documento público de
 * tribunal; guardar esse nome no repositório para servir de teste seria cometer o vazamento que a
 * ferramenta existe para avisar.
 */
const fx = (n: string) => join(process.cwd(), 'tests', 'fixtures', n)

async function abrir(page: Page) {
  await page.goto('/metadados-pdf/')
  await expect(page.locator('.dropzone.zone-hero')).toBeVisible()
}

async function soltar(page: Page, corpo: string, nome = 'documento.pdf') {
  await page.getByTestId('file-input').setInputFiles({ name: nome, mimeType: 'application/pdf', buffer: Buffer.from(corpo, 'latin1') })
  await expect(page.locator('.md-cartao')).toBeVisible({ timeout: 40_000 })
}

test('mostra a última alteração e quem consta como autor @navegadores', async ({ page }) => {
  await abrir(page)
  await soltar(page, `%PDF-1.7\n2 0 obj\n<< /Author (Fulano de Tal) /Creator (Microsoft Word) /ModDate (D:20211210154036-03'00') >>\nendobj\ntrailer\n<< /Info 2 0 R >>\n%%EOF\n`)

  const cartao = page.locator('.md-cartao')
  await expect(cartao).toContainText('Última alteração')
  await expect(cartao).toContainText('10 de dezembro de 2021')
  await expect(cartao).toContainText('Fulano de Tal')
  await expect(cartao).toContainText('Microsoft Word')
})

test('arquivo limpo é apresentado como boa notícia, não como falha @navegadores', async ({ page }) => {
  /*
   * Para quem ENVIA um documento, nenhum metadado é o estado desejável. Se a tela dissesse só
   * "nada encontrado", o usuário leria como defeito da ferramenta e iria embora achando que não
   * funcionou.
   */
  await abrir(page)
  await soltar(page, '%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n', 'limpo.pdf')
  const vazio = page.locator('.md-cartao .md-vazio')
  await expect(vazio).toBeVisible()
  await expect(vazio).toContainText(/estado desejável/i)
})

test('a trilha de gravações aparece quando o arquivo foi salvo mais de uma vez', async ({ page }) => {
  await abrir(page)
  await soltar(page,
    `%PDF-1.7\n2 0 obj\n<< /Author (Primeiro) >>\nendobj\ntrailer\n<< /Info 2 0 R >>\n%%EOF\n` +
    `${' '.repeat(90)}\n5 0 obj\n<< /Author (Recente) >>\nendobj\ntrailer\n<< /Info 5 0 R >>\n%%EOF\n`)
  const cartao = page.locator('.md-cartao')
  await expect(cartao.locator('.md-revisoes h4').first()).toContainText(/salvo 2 vezes/i)
  // Vale o /Info mais recente: o antigo continua no arquivo e mostraria o autor errado.
  await expect(cartao).toContainText('Recente')
})

test('prova gravação posterior à assinatura, e chama isso de prova @navegadores', async ({ page }) => {
  /*
   * O diferencial da ferramenta. Todo o resto da tela é declaração — data e autor são texto que
   * qualquer editor muda. Isto aqui é aritmética sobre os bytes que a assinatura protege.
   */
  const { readFileSync } = await import('node:fs')
  const base = readFileSync(fx('assinado-ok.pdf'))
  const sobra = Buffer.from('\n% pagina anexada depois\n' + ' '.repeat(200) + '\n%%EOF\n', 'latin1')
  await abrir(page)
  await page.getByTestId('file-input').setInputFiles({ name: 'assinado-e-mexido.pdf', mimeType: 'application/pdf', buffer: Buffer.concat([base, sobra]) })
  await expect(page.locator('.md-cartao')).toBeVisible({ timeout: 40_000 })

  const prova = page.locator('.md-cartao .md-prova')
  await expect(prova).toBeVisible()
  await expect(prova).toContainText(/depois de ele ser assinado/i)
  await expect(page.locator('.md-trilha li.depois')).toHaveCount(1)
})

test('o aviso de mão dupla aparece: o mesmo vale para o seu arquivo', async ({ page }) => {
  await abrir(page)
  await soltar(page, `%PDF-1.7\n2 0 obj\n<< /Author (Fulano) >>\nendobj\ntrailer\n<< /Info 2 0 R >>\n%%EOF\n`)
  await expect(page.locator('.md-cartao .conf-saida')).toContainText(/o .*seu.* PDF conta a qualquer pessoa/i)
})

test('a tela nunca chama metadado de prova, exceto no cruzamento com a assinatura', async ({ page }) => {
  /*
   * Disciplina de vocabulário, a mesma do verificador de assinaturas: "consta", "declarado". Um
   * arquivo sem assinatura não tem nada aqui que sustente a palavra prova.
   */
  await abrir(page)
  await soltar(page, `%PDF-1.7\n2 0 obj\n<< /Author (Fulano) /ModDate (D:20200101000000Z) >>\nendobj\ntrailer\n<< /Info 2 0 R >>\n%%EOF\n`)
  const texto = (await page.locator('.md-cartao').innerText()).toLowerCase()
  expect(texto, 'a tela chamou metadado de prova num arquivo sem assinatura').not.toMatch(/\bprova\b|\bcomprova/)
  expect(texto).toContain('declarado')
})

test('nenhuma requisição carrega o documento lido @navegadores', async ({ page }) => {
  const externas: string[] = []
  await abrir(page)
  const base = new URL(page.url()).origin
  page.on('request', (r) => { if (!r.url().startsWith(base)) externas.push(r.url()) })
  await soltar(page, `%PDF-1.7\n2 0 obj\n<< /Author (Fulano de Tal) >>\nendobj\ntrailer\n<< /Info 2 0 R >>\n%%EOF\n`, 'sigiloso.pdf')
  await page.waitForTimeout(1500)
  expect(externas, 'a leitura saiu para a internet').toEqual([])
})

test('no celular a página não rola na horizontal, antes e depois do resultado @navegadores', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await abrir(page)
  const rola = () => page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
  expect(await rola()).toBe(false)
  await soltar(page, `%PDF-1.7\n2 0 obj\n<< /Author (Fulano de Tal) /Producer (Adobe PDF Library 10.0) /ModDate (D:20211210154036-03'00') >>\nendobj\ntrailer\n<< /Info 2 0 R >>\n%%EOF\n`)
  expect(await rola(), 'rola na horizontal com o resultado na tela').toBe(false)
})

test('a origem declarada aparece com o nome da ferramenta @navegadores', async ({ page }) => {
  await abrir(page)
  await soltar(page, `%PDF-1.7\n2 0 obj\n<< /Producer (Microsoft\\256 Word 2019) >>\nendobj\ntrailer\n<< /Info 2 0 R >>\n%%EOF\n`)
  const origem = page.locator('.md-cartao .md-origem')
  await expect(origem).toBeVisible()
  await expect(origem).toContainText('Microsoft Word')
  await expect(origem).toContainText(/segundo o próprio arquivo/i)
})

test('ferramenta com recursos de IA não vira acusação de IA @navegadores', async ({ page }) => {
  /*
   * Canva tem geração por IA e é usado o tempo todo sem ela. É o falso positivo mais fácil de
   * cometer, e o que derrubaria a credibilidade da ferramenta no primeiro caso real.
   */
  await abrir(page)
  await soltar(page, `%PDF-1.7\n2 0 obj\n<< /Producer (Canva) >>\nendobj\ntrailer\n<< /Info 2 0 R >>\n%%EOF\n`)
  const origem = page.locator('.md-cartao .md-origem')
  await expect(origem).toContainText('Canva')
  await expect(origem).not.toHaveClass(/\bia\b/)
  await expect(origem).toContainText(/não diz se foram usados/i)
})

test('a marca oficial de IA é mostrada como declaração do gerador @navegadores', async ({ page }) => {
  await abrir(page)
  await soltar(page, `%PDF-1.7\n<Iptc4xmpExt:DigitalSourceType>http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia</Iptc4xmpExt:DigitalSourceType>\n%%EOF\n`)
  const origem = page.locator('.md-cartao .md-origem')
  await expect(origem).toHaveClass(/\bia\b/)
  await expect(origem).toContainText(/declara conteúdo gerado por inteligência artificial/i)
})

test('a tela nunca mostra percentual de probabilidade de IA', async ({ page }) => {
  /*
   * A regra que define a ferramenta de origem. Detector de texto por IA não funciona de forma
   * confiável, e um percentual errado num documento que instrui processo vira acusação falsa. Este
   * teste existe para que ninguém acrescente um "score" achando que melhora o produto.
   */
  await abrir(page)
  await soltar(page, `%PDF-1.7 trainedAlgorithmicMedia\n2 0 obj\n<< /Producer (Canva) >>\nendobj\ntrailer\n<< /Info 2 0 R >>\n%%EOF\n`)
  const texto = (await page.locator('.md-cartao').innerText()).toLowerCase()
  expect(texto, 'apareceu vocabulário de probabilidade').not.toMatch(/probabilidade|\bchance\b|percentual|\bscore\b|pontuação|\d+\s*%/)
})
