import { test, expect, type Page } from '@playwright/test'
import { ensureFixtures, type Fixtures } from './fixtures'

/*
 * O que só acontece no celular. Rodam nos projetos iphone (WebKit) e android (Chromium), além do
 * chromium de mesa. As APIs de sistema — tela acesa e folha de compartilhamento — não existem no
 * navegador do teste, então entram como dublês: o que se prova aqui é que o site as chama na hora
 * certa, com o conteúdo certo, e que sem elas nada quebra.
 */
let fx: Fixtures
test.beforeAll(async () => {
  fx = await ensureFixtures()
})

async function abrirFerramenta(page: Page) {
  await page.goto('/?view=tool')
  await expect(page.getByTestId('engine-status')).toHaveAttribute('data-state', 'ready', { timeout: 120_000 })
}

async function prepararUm(page: Page, arquivo: string) {
  await page.getByTestId('file-input').setInputFiles(arquivo)
  await expect.poll(async () => page.locator('[data-testid="job"][data-kind="analyzing"]').count(), { timeout: 60_000 }).toBe(0)
  await page.locator('#regra').selectOption('custom')
  await page.getByTestId('custom-limit').fill('6')
  await page.getByTestId('start').click()
  await expect(page.locator('[data-testid="job"][data-kind="done"]')).toHaveCount(1, { timeout: 280_000 })
}

test('no celular, a faixa de consentimento não cobre a área de escolher arquivos @celular', async ({ page }) => {
  await abrirFerramenta(page)
  const area = await page.locator('.dropzone.zone-hero').boundingBox()
  expect(area).not.toBeNull()
  const faixa = page.locator('.consentimento')
  if (await faixa.isVisible()) {
    const f = (await faixa.boundingBox())!
    expect(area!.y + area!.height, 'a faixa fixa no rodapé está por cima da área de upload').toBeLessThanOrEqual(f.y + 1)
    // E a faixa em si cabe na tela, com os dois botões alcançáveis.
    await expect(faixa.getByRole('button', { name: 'Aceitar' })).toBeInViewport()
    await expect(faixa.getByRole('button', { name: 'Recusar' })).toBeInViewport()
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('a tela fica acesa enquanto o lote roda, e é liberada ao terminar @celular', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __lock: string[] }
    w.__lock = []
    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: {
        request: async (tipo: string) => {
          w.__lock.push(`request:${tipo}`)
          return { release: async () => void w.__lock.push('release'), addEventListener() {} }
        },
      },
    })
  })
  await abrirFerramenta(page)
  await prepararUm(page, fx.scanBig)
  await expect.poll(() => page.evaluate(() => (window as unknown as { __lock: string[] }).__lock)).toEqual(['request:screen', 'release'])
})

test('com Web Share, o resultado sai como PDF pela folha do sistema — por arquivo e pelo lote @celular', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __compartilhado: { nome: string; tipo: string; bytes: number }[] }
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (dados: ShareData) => {
        w.__compartilhado = (dados.files ?? []).map((f) => ({ nome: f.name, tipo: f.type, bytes: f.size }))
      },
    })
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: (dados: ShareData) => Boolean(dados?.files?.length) })
  })
  await abrirFerramenta(page)
  await prepararUm(page, fx.scanBig)
  const lido = () => page.evaluate(() => (window as unknown as { __compartilhado?: { nome: string; tipo: string; bytes: number }[] }).__compartilhado)

  await page.getByTestId('share').click()
  const porArquivo = await lido()
  expect(porArquivo).toHaveLength(1)
  expect(porArquivo![0].nome).toBe('scan_big_otimizado.pdf')
  expect(porArquivo![0].tipo).toBe('application/pdf')
  expect(porArquivo![0].bytes).toBeGreaterThan(1000)

  await page.getByTestId('share-all').click()
  expect((await lido())!.map((f) => f.nome)).toEqual(['scan_big_otimizado.pdf'])
})

test('sem Web Share, o botão não aparece e Baixar segue sendo o caminho @celular', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined })
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: undefined })
  })
  await abrirFerramenta(page)
  await prepararUm(page, fx.scanBig)
  await expect(page.getByTestId('share')).toHaveCount(0)
  await expect(page.getByTestId('share-all')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Baixar \(/ })).toBeVisible()
})

test('ícone de tela inicial e manifest respondem com o tipo certo @celular', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest')
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', '/apple-touch-icon.png')
  const manifest = await page.request.get('/manifest.webmanifest')
  expect(manifest.status()).toBe(200)
  expect(manifest.headers()['content-type']).toContain('application/manifest+json')
  const m = await manifest.json()
  for (const src of [...m.icons.map((i: { src: string }) => i.src), '/apple-touch-icon.png']) {
    const r = await page.request.get(src)
    expect(r.status(), src).toBe(200)
    expect(r.headers()['content-type'], src).toContain('image/png')
  }
})
