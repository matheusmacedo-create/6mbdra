import { test, expect, type Page } from '@playwright/test'
import { PDFDocument } from 'pdf-lib'
import { readFileSync, statSync } from 'node:fs'
import { ensureFixtures, type Fixtures } from './fixtures'

const MB = 1024 * 1024
let fx: Fixtures

test.beforeAll(async () => {
  fx = await ensureFixtures()
})

async function openApp(page: Page) {
  await page.goto('/')
  await expect(page.getByTestId('engine-status')).toHaveAttribute('data-state', 'ready', { timeout: 120_000 })
}

async function waitJobs(page: Page, n: number) {
  await expect
    .poll(async () => page.locator('[data-testid="job"][data-status="done"], [data-testid="job"][data-status="skipped"], [data-testid="job"][data-status="error"]').count(), {
      timeout: 280_000,
    })
    .toBe(n)
}

async function pageCount(path: string): Promise<number> {
  const doc = await PDFDocument.load(readFileSync(path))
  return doc.getPageCount()
}

test('compacta uma digitalização grande para dentro de 6 MB mantendo as páginas', async ({ page }) => {
  expect(statSync(fx.scanBig).size).toBeGreaterThan(6 * MB)
  await openApp(page)
  await page.getByTestId('file-input').setInputFiles(fx.scanBig)
  await waitJobs(page, 1)
  const job = page.getByTestId('job').first()
  await expect(job).toHaveAttribute('data-status', 'done')
  await expect(job).toContainText('dentro do limite')

  const [download] = await Promise.all([page.waitForEvent('download'), job.getByRole('button', { name: /^Baixar/ }).click()])
  expect(download.suggestedFilename()).toBe('scan_big - compactado.pdf')
  const out = await download.path()
  expect(out).toBeTruthy()
  const size = statSync(out!).size
  expect(size).toBeLessThanOrEqual(6 * MB)
  expect(size).toBeLessThan(statSync(fx.scanBig).size)
  expect(readFileSync(out!).subarray(0, 4).toString()).toBe('%PDF')
  expect(await pageCount(out!)).toBe(3)
})

test('arquivos já dentro do limite são apenas marcados', async ({ page }) => {
  await openApp(page)
  await page.getByTestId('file-input').setInputFiles(fx.text)
  await waitJobs(page, 1)
  await expect(page.getByTestId('job').first()).toHaveAttribute('data-status', 'skipped')
  await expect(page.getByTestId('job').first()).toContainText('já está dentro do limite')
})

test('arquivo corrompido mostra erro amigável e permite remover', async ({ page }) => {
  await openApp(page)
  await page.getByTestId('file-input').setInputFiles(fx.corrupt)
  await waitJobs(page, 1)
  const job = page.getByTestId('job').first()
  await expect(job).toHaveAttribute('data-status', 'error')
  await expect(job).toContainText(/corrompido|não ser um PDF/)
  await job.getByRole('button', { name: /Remover/ }).click()
  await expect(page.getByTestId('job')).toHaveCount(0)
})

test('divide em partes quando nem a compressão máxima cabe no limite', async ({ page }) => {
  await openApp(page)
  await page.locator('#limit').selectOption('custom')
  await page.getByLabel('Limite em megabytes').fill('0.25')
  await page.getByTestId('file-input').setInputFiles(fx.scanHuge)
  await waitJobs(page, 1)
  const job = page.getByTestId('job').first()
  await expect(job).toHaveAttribute('data-status', 'done')
  await expect(job).toContainText(/parte 1 de \d+/)
  const parts = job.locator('.part')
  const n = await parts.count()
  expect(n).toBeGreaterThan(1)
  // Cada parte baixada deve caber no limite e ser um PDF válido; as páginas devem somar 12.
  let pagesTotal = 0
  for (let i = 0; i < n; i++) {
    const [download] = await Promise.all([page.waitForEvent('download'), parts.nth(i).getByRole('button', { name: 'Baixar' }).click()])
    const p = (await download.path())!
    expect(statSync(p).size).toBeLessThanOrEqual(0.25 * MB)
    pagesTotal += await pageCount(p)
  }
  expect(pagesTotal).toBe(12)
})

test('processa vários arquivos em fila e oferece o zip', async ({ page }) => {
  await openApp(page)
  await page.getByTestId('file-input').setInputFiles([fx.scanBig, fx.text, fx.scanBig])
  await waitJobs(page, 3)
  await expect(page.locator('[data-testid="job"][data-status="done"]')).toHaveCount(2)
  await expect(page.locator('[data-testid="job"][data-status="skipped"]')).toHaveCount(1)
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download-all').click()])
  expect(download.suggestedFilename()).toBe('pdfs-compactados.zip')
  const zip = readFileSync((await download.path())!)
  expect(zip.subarray(0, 2).toString()).toBe('PK')
  expect(zip.toString('latin1')).toContain('scan_big - compactado (2).pdf')
})
