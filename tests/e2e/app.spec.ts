import { test, expect, type Page } from '@playwright/test'
import { PDFDocument } from 'pdf-lib'
import { readFileSync, statSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { ensureFixtures, type Fixtures } from './fixtures'

const MB = 1_000_000
let fx: Fixtures

test.beforeAll(async () => {
  fx = await ensureFixtures()
})

async function openApp(page: Page, limitMb?: number) {
  await page.goto('/?view=tool')
  await expect(page.getByTestId('engine-status')).toHaveAttribute('data-state', 'ready', { timeout: 120_000 })
  if (limitMb !== undefined) {
    await page.locator('#regra').selectOption('custom')
    await page.getByTestId('custom-limit').fill(String(limitMb).replace('.', ','))
  }
}

async function addAndPrepare(page: Page, files: string[]) {
  await page.getByTestId('file-input').setInputFiles(files)
  // Espera a análise prévia terminar (nenhum job "analyzing")
  await expect.poll(async () => page.locator('[data-testid="job"][data-kind="analyzing"]').count(), { timeout: 60_000 }).toBe(0)
}

async function waitFinished(page: Page, n: number) {
  await expect
    .poll(async () => page.locator('[data-testid="job"][data-kind="done"], [data-testid="job"][data-kind="error"], [data-testid="job"][data-kind="unchanged"], [data-testid="job"][data-kind="invalid"], [data-testid="job"][data-kind="signed"], [data-testid="job"][data-kind="protected"], [data-testid="job"][data-kind="restricted"]').count(), {
      timeout: 280_000,
    })
    .toBe(n)
  await expect(page.locator('[data-testid="job"][data-kind="processing"]')).toHaveCount(0)
  await expect(page.locator('[data-testid="job"][data-kind="queued"]')).toHaveCount(0)
}

async function pageCount(path: string): Promise<number> {
  const doc = await PDFDocument.load(readFileSync(path))
  return doc.getPageCount()
}

test('fluxo completo: revisar, preparar e baixar um scan grande dentro da meta', async ({ page }) => {
  expect(statSync(fx.scanBig).size).toBeGreaterThan(6 * MB)
  await openApp(page, 6)
  await addAndPrepare(page, [fx.scanBig])
  const job = page.getByTestId('job').first()
  await expect(job).toHaveAttribute('data-kind', 'ready')
  await expect(page.getByTestId('summary')).toContainText('1 para otimizar')
  await page.getByTestId('start').click()
  await waitFinished(page, 1)
  await expect(job).toHaveAttribute('data-kind', 'done')
  await expect(job).toContainText('dentro da meta')

  const [download] = await Promise.all([page.waitForEvent('download'), job.getByRole('button', { name: /^Baixar \(/ }).click()])
  expect(download.suggestedFilename()).toBe('scan_big_otimizado.pdf')
  const out = (await download.path())!
  const size = statSync(out).size
  expect(size).toBeLessThanOrEqual(5.7 * MB)
  expect(size).toBeLessThan(statSync(fx.scanBig).size)
  expect(readFileSync(out).subarray(0, 4).toString()).toBe('%PDF')
  expect(await pageCount(out)).toBe(3)
})

test('arquivos já dentro da meta são mantidos e entram no zip como originais', async ({ page }) => {
  await openApp(page, 6)
  await addAndPrepare(page, [fx.text, fx.scanBig])
  await expect(page.locator('[data-testid="job"][data-kind="unchanged"]')).toHaveCount(1)
  await page.getByTestId('start').click()
  await waitFinished(page, 2)
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download-all').click()])
  expect(download.suggestedFilename()).toMatch(/^PDFs_preparados_\d{4}-\d{2}-\d{2}\.zip$/)
  const zip = readFileSync((await download.path())!).toString('latin1')
  expect(zip.slice(0, 2)).toBe('PK')
  const root = download.suggestedFilename().replace(/\.zip$/, '')
  expect(zip).toContain(`${root}/LEIA-ME.txt`)
  expect(zip).toContain(`${root}/01_text.pdf`)
  expect(zip).toContain(`${root}/02_scan_big.pdf`)
  expect(zip).toContain('mantido como estava')
})

test('arquivo corrompido é apontado na análise, sem bloquear os demais', async ({ page }) => {
  await openApp(page, 6)
  await addAndPrepare(page, [fx.corrupt, fx.scanBig])
  await expect(page.locator('[data-testid="job"][data-kind="invalid"]')).toHaveCount(1)
  await expect(page.locator('[data-testid="job"][data-kind="invalid"]')).toContainText(/não foi possível ler/i)
  await page.getByTestId('start').click()
  await waitFinished(page, 2)
  await expect(page.locator('[data-testid="job"][data-kind="done"]')).toHaveCount(1)
  await page.locator('[data-testid="job"][data-kind="invalid"]').getByRole('button', { name: /Remover/ }).click()
  await expect(page.getByTestId('job')).toHaveCount(1)
})

test('PDF assinado fica de fora por padrão e pode ser liberado', async ({ page }) => {
  await openApp(page, 6)
  await addAndPrepare(page, [fx.signedBig])
  const job = page.getByTestId('job').first()
  await expect(job).toHaveAttribute('data-kind', 'signed')
  await expect(page.getByTestId('start')).toHaveCount(0)
  await expect(page.getByTestId('nothing-to-prepare')).toContainText(/avisos/)
  await page.getByTestId('allow-signed').click()
  await expect(page.getByTestId('start')).toBeVisible()
  await expect(job).toHaveAttribute('data-kind', 'ready')
  await page.getByTestId('start').click()
  await waitFinished(page, 1)
  await expect(job).toHaveAttribute('data-kind', 'done')
})

test('divide em partes quando nem a compressão máxima cabe', async ({ page }) => {
  await openApp(page, 0.5)
  await addAndPrepare(page, [fx.scanHuge])
  await page.getByTestId('start').click()
  await waitFinished(page, 1)
  const job = page.getByTestId('job').first()
  await expect(job).toHaveAttribute('data-kind', 'done')
  await expect(job).toContainText(/_parte_01_de_\d+\.pdf/)
  const parts = job.locator('.part')
  const n = await parts.count()
  expect(n).toBeGreaterThan(1)
  let pagesTotal = 0
  for (let i = 0; i < n; i++) {
    const [download] = await Promise.all([page.waitForEvent('download'), parts.nth(i).getByRole('button', { name: 'Baixar' }).click()])
    const p = (await download.path())!
    expect(statSync(p).size).toBeLessThanOrEqual(0.5 * MB * 0.95)
    pagesTotal += await pageCount(p)
  }
  expect(pagesTotal).toBe(12)
})

test('cancelar interrompe o lote e devolve os arquivos ao estado revisado', async ({ page }) => {
  await openApp(page, 6)
  await addAndPrepare(page, [fx.scanHuge, fx.scanBig])
  await page.getByTestId('start').click()
  await expect(page.getByTestId('cancel')).toBeVisible()
  await page.getByTestId('cancel').click()
  await expect(page.locator('[data-testid="job"][data-kind="processing"]')).toHaveCount(0, { timeout: 30_000 })
  await expect(page.locator('[data-testid="job"][data-kind="queued"]')).toHaveCount(0)
  await expect(page.getByTestId('start')).toBeVisible()
})

test('nenhuma requisição de rede transporta os documentos (RF06)', async ({ page }) => {
  const requests: { url: string; method: string; hasBody: boolean; headers: Record<string, string> }[] = []
  const sockets: string[] = []
  page.on('request', (r) => requests.push({ url: r.url(), method: r.method(), hasBody: r.postData() !== null && r.postData() !== undefined, headers: r.headers() }))
  page.on('websocket', (ws) => sockets.push(ws.url()))
  await openApp(page, 6)
  await addAndPrepare(page, [fx.scanBig])
  await page.getByTestId('start').click()
  await waitFinished(page, 1)
  const origin = new URL(page.url()).origin
  const fileBytes = readFileSync(fx.scanBig)
  const size = String(fileBytes.length)
  const sha = createHash('sha256').update(fileBytes).digest('hex')
  const allowed = /^\/(\?[a-z0-9=&%_-]*)?$|^\/_astro\/[\w.-]+\.(js|css|wasm|woff2)$|^\/favicon\.svg$/
  expect(sockets, 'nenhum WebSocket').toHaveLength(0)
  for (const r of requests) {
    expect(r.method, `método em ${r.url}`).toBe('GET')
    expect(r.hasBody, `corpo em ${r.url}`).toBe(false)
    expect(r.url.startsWith(origin), `origem externa: ${r.url}`).toBe(true)
    expect(new URL(r.url).pathname + new URL(r.url).search, `URL fora da lista permitida: ${r.url}`).toMatch(allowed)
    const all = r.url + JSON.stringify(r.headers)
    expect(all).not.toMatch(/scan_big/)
    expect(all).not.toContain(sha)
    expect(all).not.toContain(sha.slice(0, 16))
    expect(all).not.toContain(size)
  }
})

test('páginas públicas respondem e apontam para a ferramenta', async ({ page }) => {
  for (const path of ['/tribunais/', '/tribunais/trt2-pje-jt/', '/tribunais/tjsp-esaj/', '/guias/', '/metodologia/', '/privacidade/', '/termos/', '/contato/']) {
    const res = await page.goto(path)
    expect(res?.status(), path).toBe(200)
    await expect(page.locator('main h1')).toBeVisible()
  }
  await page.goto('/guias/')
  const links = page.locator('.grid-cards a')
  expect(await links.count()).toBeGreaterThanOrEqual(8)
})

test('no celular a ferramenta não rola na horizontal e o seletor cabe na tela', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/?view=tool')
  await expect(page.getByTestId('engine-status')).toHaveAttribute('data-state', 'ready', { timeout: 120_000 })
  await page.locator('#regra').selectOption({ index: 1 })
  await page.getByTestId('file-input').setInputFiles([fx.text])
  await expect.poll(async () => page.locator('[data-testid="job"][data-kind="analyzing"]').count(), { timeout: 60_000 }).toBe(0)
  const widths = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth, select: document.querySelector('#regra')!.getBoundingClientRect().width }))
  expect(widths.scroll, 'largura rolável').toBeLessThanOrEqual(widths.inner)
  expect(widths.select).toBeLessThanOrEqual(widths.inner)
})

test('limite manual inválido bloqueia o botão Preparar e explica o erro', async ({ page }) => {
  await openApp(page, 6)
  await addAndPrepare(page, [fx.scanBig])
  await expect(page.getByTestId('start')).toBeEnabled()
  await page.getByTestId('custom-limit').fill('600')
  await expect(page.getByTestId('custom-limit')).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByTestId('custom-limit-error')).toContainText(/entre 0,5 e 500/)
  await expect(page.getByTestId('start')).toBeDisabled()
  await page.getByTestId('custom-limit').fill('6')
  await expect(page.getByTestId('custom-limit')).not.toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByTestId('start')).toBeEnabled()
})

test('PDF só com restrições de edição fica de fora por padrão; liberado, sai legível e sem criptografia', async ({ page }) => {
  await openApp(page, 6)
  await addAndPrepare(page, [fx.restricted])
  const job = page.getByTestId('job').first()
  await expect(job).toHaveAttribute('data-kind', 'restricted')
  await expect(job).toContainText(/restrições de edição/)
  await expect(page.getByTestId('summary')).toContainText('1 com aviso')
  await expect(page.getByTestId('start')).toHaveCount(0)
  await page.getByTestId('allow-restricted').click()
  await expect(job).toHaveAttribute('data-kind', 'ready')
  await page.getByTestId('start').click()
  await waitFinished(page, 1)
  await expect(job).toHaveAttribute('data-kind', 'done')
  await expect(job).toContainText(/sai sem elas/)
  const [download] = await Promise.all([page.waitForEvent('download'), job.getByRole('button', { name: /^Baixar \(/ }).click()])
  const out = readFileSync((await download.path())!)
  expect(out.length).toBeLessThanOrEqual(5.7 * MB)
  const doc = await PDFDocument.load(out) // sem ignoreEncryption: precisa abrir como PDF comum
  expect(doc.isEncrypted).toBe(false)
  expect(doc.getPageCount()).toBe(3)
})

test('PDF que exige senha de abertura é recusado na análise, sem pedir senha', async ({ page }) => {
  await openApp(page, 6)
  await addAndPrepare(page, [fx.userPassword, fx.scanBig])
  const locked = page.locator('[data-testid="job"][data-kind="protected"]')
  await expect(locked).toHaveCount(1)
  await expect(locked).toContainText(/exige senha/i)
  await expect(page.locator('input[type="password"]')).toHaveCount(0)
  await page.getByTestId('start').click()
  await waitFinished(page, 2)
  await expect(page.locator('[data-testid="job"][data-kind="done"]')).toHaveCount(1)
  await expect(locked).toHaveCount(1)
})

test('a página inicial abre a ferramenta ao receber arquivos e volta com "Ferramentas"', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('#regra')).toHaveCount(0)
  await expect(page.locator('#ferramentas')).toBeVisible()
  await expect(page.getByTestId('engine-status')).toHaveAttribute('data-state', 'ready', { timeout: 120_000 })
  await page.getByTestId('file-input').setInputFiles([fx.text])
  await expect(page.locator('#regra')).toBeVisible()
  await expect(page.locator('#ferramentas')).toBeHidden()
  await expect(page).toHaveURL(/view=tool/)
  await expect.poll(async () => page.locator('[data-testid="job"][data-kind="analyzing"]').count(), { timeout: 60_000 }).toBe(0)
  await page.getByRole('link', { name: '← Ferramentas' }).click()
  await expect(page.locator('#ferramentas')).toBeVisible()
  await expect(page.getByText(/no lote/)).toBeVisible()
  await page.getByRole('link', { name: 'Preparar PDFs' }).click()
  await expect(page.locator('#regra')).toBeVisible()
  await expect(page.getByTestId('job')).toHaveCount(1)
})
