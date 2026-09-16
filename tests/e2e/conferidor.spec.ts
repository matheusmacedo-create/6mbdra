import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'

/*
 * Conferidor de assinaturas, ponta a ponta.
 *
 * As fixtures aqui são fixas no repositório (e não geradas em tempo de execução como as da
 * bancada) porque PDF assinado não se improvisa: os bytes precisam ser exatamente os que a
 * assinatura cobre. São regeneráveis com `node scripts/fixtures/gera-assinado.mjs`.
 */
const fx = (n: string) => join(process.cwd(), 'tests', 'fixtures', n)

async function abrir(page: Page) {
  await page.goto('/verificar-assinatura-digital/')
  await expect(page.locator('.dropzone.zone-hero')).toBeVisible()
}

async function conferir(page: Page, arquivo: string) {
  await page.getByTestId('file-input').setInputFiles(fx(arquivo))
  await expect(page.locator('.conf-cartao')).toBeVisible({ timeout: 60_000 })
}

test('documento íntegro: a integridade confere, e a palavra "válida" não aparece @navegadores', async ({ page }) => {
  await abrir(page)
  await conferir(page, 'assinado-ok.pdf')

  const cartao = page.locator('.conf-cartao')
  await expect(cartao).toHaveAttribute('data-estado', 'conferida')
  await expect(cartao.locator('h3')).toHaveText(/assinatura confere/i)
  await expect(cartao).toContainText('FULANO DE TAL')

  /*
   * A disciplina de vocabulário é a regra que mais importa neste produto e a mais fácil de perder
   * numa revisão de texto bem-intencionada. Um teste é mais firme que uma intenção.
   *
   * O escopo é o CARTÃO DE VEREDITO, não a página: o texto ao redor precisa poder escrever
   * "assinatura válida" para explicar justamente por que a ferramenta não diz isso. A primeira
   * versão deste teste olhava a página inteira e reprovava a FAQ que ensina a regra.
   */
  const veredito = (await cartao.innerText()).toLowerCase()
  expect(veredito, 'o veredito usou vocabulário de validade jurídica').not.toMatch(/válid|inválid|autentic/)
})

test('um byte trocado vira "documento alterado", nunca "não deu para conferir" @navegadores', async ({ page }) => {
  await abrir(page)
  await conferir(page, 'assinado-quebrado.pdf')

  const cartao = page.locator('.conf-cartao')
  await expect(cartao).toHaveAttribute('data-estado', 'quebrada')
  await expect(cartao.locator('h3')).toHaveText(/alterado depois de assinado/i)
  await expect(cartao.locator('.conf-acao')).toContainText(/recupere o arquivo original/i)
  // O erro que mataria o produto: virar 'indeterminada' e mandar a pessoa ao ITI sem avisar do risco.
  await expect(cartao).not.toHaveAttribute('data-estado', 'indeterminada')
})

test('certificado sem procedência é avisado mesmo com a integridade conferindo @navegadores', async ({ page }) => {
  await abrir(page)
  await conferir(page, 'assinado-autoassinado.pdf')

  const cartao = page.locator('.conf-cartao')
  // Arquivo intacto E sem origem: as duas metades da resposta aparecem juntas, e discordam.
  await expect(cartao).toHaveAttribute('data-estado', 'conferida')
  const proc = cartao.locator('.conf-procedencia')
  await expect(proc).toHaveClass(/ruim/)
  await expect(proc).toContainText(/Não é um certificado ICP-Brasil/i)
  await expect(proc).toContainText(/assina a si mesmo/i)
})

test('cadeia sem os elos do arquivo é "incompleta", e não uma acusação @navegadores', async ({ page }) => {
  /*
   * A distinção que mais importa nesta camada: faltar no arquivo a autoridade que emitiu o
   * certificado é defeito do arquivo, não prova de que o certificado seja irregular. Confundir as
   * duas coisas transformaria a ferramenta numa fonte de falso alarme.
   */
  await abrir(page)
  await conferir(page, 'assinado-politica.pdf')
  const proc = page.locator('.conf-cartao .conf-procedencia')
  await expect(proc).toHaveClass(/neutro/)
  await expect(proc).toContainText(/incompleta/i)
  await expect(proc).not.toContainText(/Não é um certificado ICP-Brasil/i)
})

test('a verificação de cadeia não faz nenhuma requisição de rede @navegadores', async ({ page }) => {
  /*
   * Consultar revogação, ou baixar a autoridade que falta, contaria a um terceiro que ESTE
   * documento está sendo conferido aqui. As raízes moram no código exatamente para isso não ser
   * necessário — e o teste prova que continua assim.
   */
  const externas: string[] = []
  await abrir(page)
  const base = new URL(page.url()).origin
  page.on('request', (r) => { if (!r.url().startsWith(base)) externas.push(r.url()) })
  await conferir(page, 'assinado-autoassinado.pdf')
  await page.waitForTimeout(1500)
  expect(externas, 'a conferência saiu para a internet').toEqual([])
})

test('PDF sem assinatura não vira falso positivo', async ({ page }) => {
  await abrir(page)
  // Um PDF qualquer do próprio site serve: não tem assinatura nenhuma.
  await page.getByTestId('file-input').setInputFiles({
    name: 'sem-assinatura.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF'),
  })
  const cartao = page.locator('.conf-cartao')
  await expect(cartao).toBeVisible({ timeout: 60_000 })
  await expect(cartao).toHaveAttribute('data-estado', 'sem_assinatura')
  await expect(cartao.locator('h3')).toHaveText(/nenhuma assinatura/i)
})

test('o leitor de assinaturas só baixa quando um arquivo chega @navegadores', async ({ page }) => {
  /*
   * São 376 KB de biblioteca de ASN.1. Quem abre a página para ler o texto não deveria pagar por
   * eles, e quem solta um arquivo não deveria esperar por eles duas vezes. O import() dinâmico
   * resolve os dois casos — e é fácil alguém "simplificar" isso para um import comum sem perceber
   * o custo, então o teste mede.
   */
  const baixados: string[] = []
  page.on('request', (r) => baixados.push(r.url()))

  await abrir(page)
  await page.waitForLoadState('networkidle')
  expect(baixados.filter((u) => /\/_astro\/assinatura\./.test(u)), 'o leitor baixou antes da hora').toHaveLength(0)

  await conferir(page, 'assinado-ok.pdf')
  expect(baixados.filter((u) => /\/_astro\/assinatura\./.test(u)).length, 'o leitor não foi carregado').toBeGreaterThan(0)
})

test('nenhuma requisição carrega o documento conferido @navegadores', async ({ page }) => {
  /*
   * A mesma garantia da bancada (RF06), agora para a ferramenta nova. Uma promessa de sigilo que
   * vale só na metade do site não vale.
   */
  const reqs: { url: string; method: string; body: string | null; headers: Record<string, string> }[] = []
  const sockets: string[] = []
  page.on('request', (r) => reqs.push({ url: r.url(), method: r.method(), body: r.postData() ?? null, headers: r.headers() }))
  page.on('websocket', (ws) => sockets.push(ws.url()))

  await page.addInitScript(() => {
    const janela = window as unknown as { __medicoes: { url: string; corpo: string }[] }
    janela.__medicoes = []
    const original = navigator.sendBeacon?.bind(navigator)
    navigator.sendBeacon = (url: string | URL, data?: BodyInit | null) => {
      const guardar = (corpo: string) => janela.__medicoes.push({ url: String(url), corpo })
      if (data instanceof Blob) void data.text().then(guardar)
      else guardar(String(data))
      return original ? original(url, data) : true
    }
  })

  await abrir(page)
  await conferir(page, 'assinado-politica.pdf')
  // A medição viaja em lote, alguns segundos depois dos eventos.
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await page.waitForTimeout(5_000)

  const origem = new URL(page.url()).origin
  const bytes = readFileSync(fx('assinado-politica.pdf'))
  const sha = createHash('sha256').update(bytes).digest('hex')
  const tamanho = String(bytes.length)

  expect(sockets, 'nenhum WebSocket').toHaveLength(0)
  for (const r of reqs) {
    expect(r.url.startsWith(origem), `origem externa: ${r.url}`).toBe(true)
    const rota = new URL(r.url).pathname
    if (rota !== '/api/e') {
      expect(r.method, `método em ${r.url}`).toBe('GET')
      expect(r.body, `corpo em ${r.url}`).toBeNull()
    }
    const tudo = r.url + JSON.stringify(r.headers) + (r.body ?? '')
    expect(tudo, 'nome do arquivo na rede').not.toMatch(/assinado-politica/)
    expect(tudo).not.toContain(sha.slice(0, 16))
    expect(tudo).not.toContain(tamanho)
  }

  const medicoes = await page.evaluate(() => (window as unknown as { __medicoes: { url: string; corpo: string }[] }).__medicoes)
  for (const m of medicoes) {
    expect(m.corpo).not.toMatch(/assinado-politica/)
    expect(m.corpo).not.toContain(sha.slice(0, 16))
    expect(m.corpo).not.toContain(tamanho)
    // E o nome do titular do certificado também não pode sair daqui.
    expect(m.corpo).not.toContain('FULANO DE TAL')
  }
})

test('a política declarada aparece, sem virar promessa de conformidade', async ({ page }) => {
  await abrir(page)
  await conferir(page, 'assinado-politica.pdf')
  const cartao = page.locator('.conf-cartao')
  await expect(cartao).toContainText('AD-RB')
  // "declarada" precisa estar escrito: ler a política do arquivo não é verificar que ele a cumpre.
  await expect(cartao.locator('.conf-fatos')).toContainText(/declarada/i)
})

test('dá para conferir um arquivo atrás do outro sem recarregar', async ({ page }) => {
  await abrir(page)
  await conferir(page, 'assinado-ok.pdf')
  await expect(page.locator('.conf-cartao')).toHaveAttribute('data-estado', 'conferida')
  await page.getByRole('button', { name: 'Conferir outro' }).click()
  await expect(page.locator('.conf-cartao')).toHaveCount(0)
  await conferir(page, 'assinado-quebrado.pdf')
  await expect(page.locator('.conf-cartao')).toHaveAttribute('data-estado', 'quebrada')
})

test('vários documentos de uma vez viram um cartão cada', async ({ page }) => {
  await abrir(page)
  await page.getByTestId('file-input').setInputFiles([fx('assinado-ok.pdf'), fx('assinado-quebrado.pdf')])
  await expect(page.locator('.conf-cartao')).toHaveCount(2, { timeout: 60_000 })
  await expect(page.locator('.conf-cartao').nth(0)).toHaveAttribute('data-estado', 'conferida')
  await expect(page.locator('.conf-cartao').nth(1)).toHaveAttribute('data-estado', 'quebrada')
})

test('no celular a página não rola na horizontal, antes e depois do resultado @navegadores', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await abrir(page)
  const rola = () => page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
  expect(await rola(), 'rola na horizontal já na abertura').toBe(false)
  await conferir(page, 'assinado-politica.pdf')
  expect(await rola(), 'rola na horizontal com o resultado na tela').toBe(false)
})
