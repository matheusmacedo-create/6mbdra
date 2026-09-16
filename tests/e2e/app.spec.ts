import { test, expect, type Page } from '@playwright/test'
import { PDFDocument } from 'pdf-lib'
import { unzipSync } from 'fflate'
import { readFileSync, statSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { ensureFixtures, type Fixtures } from './fixtures'

const MB = 1_000_000
let fx: Fixtures

test.beforeAll(async () => {
  fx = await ensureFixtures()
})

async function openApp(page: Page) {
  await page.goto('/?view=tool')
  await expect(page.getByTestId('engine-status')).toHaveAttribute('data-state', 'ready', { timeout: 120_000 })
  // Divulgação progressiva: antes de existir arquivo, a tela não mostra tribunal, limite nem opções.
  await expect(page.locator('#regra')).toHaveCount(0)
  await expect(page.locator('.toggles')).toHaveCount(0)
}

/** O destino do protocolo só aparece depois dos arquivos: adiciona, espera a análise e então ajusta. */
async function addAndPrepare(page: Page, files: string[], limitMb?: number) {
  await page.getByTestId('file-input').setInputFiles(files)
  // Espera a análise prévia terminar (nenhum job "analyzing")
  await expect.poll(async () => page.locator('[data-testid="job"][data-kind="analyzing"]').count(), { timeout: 60_000 }).toBe(0)
  if (limitMb !== undefined) {
    await page.locator('#regra').selectOption('custom')
    await page.getByTestId('custom-limit').fill(String(limitMb).replace('.', ','))
  }
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

test('fluxo completo: revisar, preparar e baixar um scan grande dentro da meta @navegadores', async ({ page }) => {
  expect(statSync(fx.scanBig).size).toBeGreaterThan(6 * MB)
  await openApp(page)
  await addAndPrepare(page, [fx.scanBig], 6)
  const job = page.getByTestId('job').first()
  await expect(job).toHaveAttribute('data-kind', 'ready')
  await expect(page.getByTestId('summary')).toContainText('1 para otimizar')
  await expect(page.getByTestId('start'), 'o CTA da etapa 2').toHaveText('Preparar PDFs')
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
  await openApp(page)
  await addAndPrepare(page, [fx.text, fx.scanBig], 6)
  await expect(page.locator('[data-testid="job"][data-kind="unchanged"]')).toHaveCount(1)
  await page.getByTestId('start').click()
  await waitFinished(page, 2)
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download-all').click()])
  expect(download.suggestedFilename()).toMatch(/^PDFs_preparados_\d{4}-\d{2}-\d{2}\.zip$/)
  const zip = readFileSync((await download.path())!).toString('latin1')
  expect(zip.slice(0, 2)).toBe('PK')
  const root = download.suggestedFilename().replace(/\.zip$/, '')
  expect(zip).toContain(`${root}/LEIA-ME.txt`)
  expect(zip).toContain('mantido como estava')
  /*
   * A numeração do ZIP segue a ordem da lista na tela, não a ordem em que os arquivos foram
   * escolhidos: ao entrar, o lote é posto em ordem de protocolo (ver ordenarPorNome). Conferir a
   * relação, e não nomes fixos, é o que continua valendo se a heurística de ordem mudar.
   */
  const naTela = await page.getByTestId('job').locator('.job-name').allTextContents()
  naTela.forEach((nome, i) => {
    const esperado = `${root}/${String(i + 1).padStart(2, '0')}_${nome}`
    expect(zip, `posição ${i + 1} do ZIP`).toContain(esperado)
  })
})

test('arquivo corrompido é apontado na análise, sem bloquear os demais', async ({ page }) => {
  await openApp(page)
  await addAndPrepare(page, [fx.corrupt, fx.scanBig], 6)
  await expect(page.locator('[data-testid="job"][data-kind="invalid"]')).toHaveCount(1)
  await expect(page.locator('[data-testid="job"][data-kind="invalid"]')).toContainText(/não foi possível ler/i)
  await page.getByTestId('start').click()
  await waitFinished(page, 2)
  await expect(page.locator('[data-testid="job"][data-kind="done"]')).toHaveCount(1)
  await page.locator('[data-testid="job"][data-kind="invalid"]').getByRole('button', { name: /Remover/ }).click()
  await expect(page.getByTestId('job')).toHaveCount(1)
})

test('PDF assinado fica de fora por padrão e pode ser liberado', async ({ page }) => {
  await openApp(page)
  await addAndPrepare(page, [fx.signedBig], 6)
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

test('divide em partes quando nem a compressão máxima cabe @navegadores', async ({ page }) => {
  await openApp(page)
  await addAndPrepare(page, [fx.scanHuge], 0.5)
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
  await openApp(page)
  await addAndPrepare(page, [fx.scanHuge, fx.scanBig], 6)
  await page.getByTestId('start').click()
  await expect(page.getByTestId('cancel')).toBeVisible()
  await page.getByTestId('cancel').click()
  await expect(page.locator('[data-testid="job"][data-kind="processing"]')).toHaveCount(0, { timeout: 30_000 })
  await expect(page.locator('[data-testid="job"][data-kind="queued"]')).toHaveCount(0)
  await expect(page.getByTestId('start')).toBeVisible()
})

/** Campos que a medição de uso pode mandar (espelha TEXTOS/NUMEROS em src/worker/index.ts). */
const CAMPOS_DE_MEDICAO = new Set([
  'caminho', 'origem', 'tribunal', 'sistema', 'situacao', 'categoria', 'faixa', 'tipo',
  'quantidade', 'nivel', 'partes', 'segundos', 'paginas', 'meta_mb',
])

interface Medicao {
  url: string
  corpo: string
}

test('nenhuma requisição de rede transporta os documentos (RF06) @navegadores', async ({ page }) => {
  const requests: { url: string; method: string; body: string | null; headers: Record<string, string> }[] = []
  const sockets: string[] = []
  page.on('request', (r) => requests.push({ url: r.url(), method: r.method(), body: r.postData() ?? null, headers: r.headers() }))
  page.on('websocket', (ws) => sockets.push(ws.url()))
  /*
   * A medição de uso viaja por sendBeacon, e o corpo de um beacon não chega ao Playwright pelo
   * evento de rede. Então guardamos o que o próprio navegador manda: é exatamente o que sai daqui.
   */
  await page.addInitScript(() => {
    const janela = window as unknown as { __medicoes: Medicao[] }
    janela.__medicoes = []
    const original = navigator.sendBeacon?.bind(navigator)
    navigator.sendBeacon = (url: string | URL, data?: BodyInit | null) => {
      const guardar = (corpo: string) => janela.__medicoes.push({ url: String(url), corpo })
      if (data instanceof Blob) void data.text().then(guardar)
      else guardar(String(data))
      return original ? original(url, data) : true
    }
  })
  await openApp(page)
  await addAndPrepare(page, [fx.scanBig], 6)
  await page.getByTestId('start').click()
  await waitFinished(page, 1)
  // Dá tempo de a medição de uso sair (ela viaja em lote, alguns segundos depois dos eventos).
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await page.waitForTimeout(5_000)

  const origin = new URL(page.url()).origin
  const fileBytes = readFileSync(fx.scanBig)
  const size = String(fileBytes.length)
  const sha = createHash('sha256').update(fileBytes).digest('hex')
  const allowed = /^\/(\?[a-z0-9=&%_-]*)?$|^\/_astro\/[\w.-]+\.(js|css|wasm|woff2)$|^\/favicon\.svg$/
  expect(sockets, 'nenhum WebSocket').toHaveLength(0)
  for (const r of requests) {
    const rota = new URL(r.url).pathname
    expect(r.url.startsWith(origin), `origem externa: ${r.url}`).toBe(true)
    if (rota === '/api/e') {
      // Único POST do site: a medição de uso. O conteúdo é conferido logo abaixo.
      expect(r.method, 'medição usa POST').toBe('POST')
    } else {
      expect(r.method, `método em ${r.url}`).toBe('GET')
      expect(r.body, `corpo em ${r.url}`).toBeNull()
      expect(rota + new URL(r.url).search, `URL fora da lista permitida: ${r.url}`).toMatch(allowed)
    }
    // Vale para toda requisição, medição incluída: nada do documento sai daqui.
    const tudo = r.url + JSON.stringify(r.headers) + (r.body ?? '')
    expect(tudo).not.toMatch(/scan_big/)
    expect(tudo).not.toContain(sha)
    expect(tudo).not.toContain(sha.slice(0, 16))
    expect(tudo).not.toContain(size)
  }
  // E a medição precisa mesmo ter saído, senão o teste acima não provou nada.
  expect(requests.filter((r) => new URL(r.url).pathname === '/api/e').length, 'a medição de uso não foi enviada').toBeGreaterThan(0)

  // Agora o conteúdo da medição: só contagens e categorias da lista permitida, nada do documento.
  const medicoes = await page.evaluate(() => (window as unknown as { __medicoes: Medicao[] }).__medicoes)
  expect(medicoes.length, 'nenhum beacon de medição capturado').toBeGreaterThan(0)
  for (const m of medicoes) {
    expect(new URL(m.url, origin).pathname).toBe('/api/e')
    const corpo = JSON.parse(m.corpo) as { eventos?: { nome?: string; props?: Record<string, unknown> }[] }
    expect(Array.isArray(corpo.eventos), `corpo da medição: ${m.corpo.slice(0, 200)}`).toBe(true)
    for (const e of corpo.eventos ?? []) {
      expect(typeof e.nome).toBe('string')
      for (const [chave, valor] of Object.entries(e.props ?? {})) {
        expect([...CAMPOS_DE_MEDICAO], `campo inesperado na medição: ${chave}`).toContain(chave)
        expect(String(valor).length, `valor longo demais em ${chave}`).toBeLessThanOrEqual(40)
      }
    }
    expect(m.corpo).not.toMatch(/scan_big/)
    expect(m.corpo).not.toContain(sha.slice(0, 16))
    expect(m.corpo).not.toContain(size)
  }
})

test('a área de upload inteira é o controle: clique, teclado e arrastar', async ({ page }) => {
  await page.goto('/')
  const area = page.locator('.dropzone.zone-hero')
  await expect(area).toBeVisible()
  await expect(area).toHaveAttribute('role', 'button')
  await expect(area).toHaveAttribute('aria-label', 'Selecionar arquivos PDF')
  const caixa = (await area.boundingBox())!
  expect(caixa.height, 'altura mínima da área').toBeGreaterThanOrEqual(260)

  // 1. Clique num canto da área (longe do botão) abre o seletor de arquivos.
  const cantoSuperior = page.waitForEvent('filechooser')
  await area.click({ position: { x: 12, y: 12 } })
  expect((await cantoSuperior).isMultiple(), 'aceita vários arquivos').toBe(true)

  // 2. O botão de dentro faz a mesma coisa, sem abrir duas vezes.
  const peloBotao = page.waitForEvent('filechooser')
  await page.locator('.upload-button').click()
  await peloBotao

  // 3. Teclado: a área recebe foco e responde a Enter e a Espaço.
  await area.focus()
  await expect(area).toBeFocused()
  const porEnter = page.waitForEvent('filechooser')
  await area.press('Enter')
  await porEnter
  const porEspaco = page.waitForEvent('filechooser')
  await area.press(' ')
  await porEspaco
})

test('arrastar e soltar entrega os PDFs e "Limpar lista" volta para a etapa 1', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('engine-status')).toHaveAttribute('data-state', 'ready', { timeout: 120_000 })
  const bytes = [...readFileSync(fx.text)]
  // Soltar de verdade na área: monta um DataTransfer com dois PDFs e dispara o evento "drop".
  await page.evaluate(async (dados) => {
    const dt = new DataTransfer()
    for (const nome of ['a.pdf', 'b.pdf']) dt.items.add(new File([new Uint8Array(dados)], nome, { type: 'application/pdf' }))
    const area = document.querySelector('.dropzone.zone-hero')!
    area.dispatchEvent(new DragEvent('dragover', { bubbles: true, dataTransfer: dt }))
    area.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: dt }))
  }, bytes)
  await expect(page.getByTestId('job')).toHaveCount(2)
  await expect(page.locator('.tool-page')).toBeVisible()
  await expect.poll(async () => page.locator('[data-testid="job"][data-kind="analyzing"]').count(), { timeout: 60_000 }).toBe(0)
  // A etapa 2 apareceu com o destino do protocolo e o CTA.
  await expect(page.locator('.destino')).toBeVisible()
  await expect(page.locator('#regra')).toBeVisible()
  // Estes dois PDFs já cabem no limite, então a etapa 2 diz isso em vez de oferecer o preparo.
  await expect(page.getByTestId('nothing-to-prepare')).toContainText(/já cabem/)
  await expect(page.locator('.avancadas')).toBeVisible()
  await expect(page.locator('.avancadas .toggles')).toBeHidden()
  await page.locator('.avancadas summary').click()
  await expect(page.locator('.avancadas .toggles')).toBeVisible()

  // Voltar para a etapa inicial: sem arquivos, some tudo que é ajuste.
  await page.getByTestId('clear').click()
  await expect(page.getByTestId('job')).toHaveCount(0)
  await expect(page.locator('#regra')).toHaveCount(0)
  await expect(page.locator('.dropzone.zone-hero')).toBeVisible()
  await expect(page.getByTestId('step-hint')).toHaveText('1 de 4 — Selecionar PDFs')
})

test('a medição do Google só entra depois do aceite (LGPD)', async ({ page }) => {
  const externas: string[] = []
  page.on('request', (r) => {
    const u = new URL(r.url())
    if (u.hostname !== 'localhost' && u.hostname !== '127.0.0.1') externas.push(r.url())
  })
  await page.goto('/')
  const faixa = page.locator('.consentimento')
  await expect(faixa, 'a faixa de consentimento precisa aparecer na primeira visita').toBeVisible()
  await expect(faixa).toContainText(/cookies de medição/i)

  // 1. Antes de responder: nenhum contato com o Google e nenhum cookie.
  await page.waitForTimeout(1500)
  expect(externas, `saiu requisição para fora sem aceite: ${externas.join(', ')}`).toHaveLength(0)
  expect(await page.context().cookies()).toHaveLength(0)

  // 2. Recusar: a faixa some, a escolha fica guardada e continua sem contato nenhum.
  await faixa.getByRole('button', { name: 'Recusar' }).click()
  await expect(faixa).toHaveCount(0)
  await page.reload()
  await expect(page.locator('.consentimento'), 'a faixa não volta depois da escolha').toHaveCount(0)
  await page.waitForTimeout(1500)
  expect(externas, `saiu requisição para fora após recusar: ${externas.join(', ')}`).toHaveLength(0)
  expect(await page.context().cookies()).toHaveLength(0)

  // 3. Aceitar: aí sim a tag do Google é baixada.
  await page.evaluate(() => localStorage.removeItem('brpdf.consentimento'))
  await page.reload()
  await page.locator('.consentimento').getByRole('button', { name: 'Aceitar' }).click()
  await expect.poll(() => externas.filter((u) => u.includes('googletagmanager.com')).length, { timeout: 15_000 }).toBeGreaterThan(0)
  // E o consentimento foi concedido na dataLayer, não só no visual. O gtag empilha o objeto
  // `arguments`, que é parecido com array mas não é um: a checagem vai por índice.
  const concedido = await page.evaluate(() => {
    const camadas = (window as unknown as { dataLayer?: unknown[] }).dataLayer ?? []
    return camadas.some((entrada) => {
      const args = entrada as Record<number, unknown>
      return args?.[0] === 'consent' && args?.[1] === 'update' && (args?.[2] as Record<string, string>)?.analytics_storage === 'granted'
    })
  })
  expect(concedido, 'o consentimento precisa ser propagado para a dataLayer').toBe(true)
})

test('arquivos que já cabem não viram beco sem saída: o lote continua baixável', async ({ page }) => {
  await openApp(page)
  // Limite folgado de propósito: os dois arquivos cabem e não há nada a comprimir.
  await addAndPrepare(page, [fx.text, fx.text], 50)
  await expect(page.getByTestId('nothing-to-prepare')).toContainText(/nada a comprimir/i)
  await expect(page.getByTestId('start'), 'não existe o que preparar').toHaveCount(0)
  // E, ainda assim, dá para levar o lote embora.
  const zip = page.getByTestId('download-all')
  await expect(zip).toBeVisible()
  await expect(zip).toHaveText(/Baixar lote em ZIP \(2\)/)
  const [download] = await Promise.all([page.waitForEvent('download'), zip.click()])
  const bytes = readFileSync((await download.path())!)
  expect(bytes.subarray(0, 2).toString()).toBe('PK')
  const conteudo = bytes.toString('latin1')
  const raiz = download.suggestedFilename().replace(/\.zip$/, '')
  expect(conteudo).toContain(`${raiz}/LEIA-ME.txt`)
  expect(conteudo).toContain(`${raiz}/01_text.pdf`)
  expect(conteudo).toContain(`${raiz}/02_text.pdf`)
})

test('juntar documentos: vira um PDF só, na ordem da lista @navegadores', async ({ page }) => {
  await openApp(page)
  await addAndPrepare(page, [fx.text, fx.text, fx.text], 50)
  const paginasPorArquivo = await pageCount(fx.text)

  // A opção só existe porque há mais de um documento aproveitável.
  const juntar = page.getByTestId('juntar')
  await expect(juntar).toBeVisible()
  await expect(juntar).not.toBeChecked()
  await juntar.check()
  await expect(page.getByTestId('aviso-juntar')).toContainText(/ordem da lista/i)

  await page.getByTestId('start').click()
  await waitFinished(page, 1)
  // Três viraram um.
  await expect(page.getByTestId('job')).toHaveCount(1)
  await expect(page.getByTestId('job')).toContainText('documentos_juntados.pdf')
  // A análise do arquivo juntado já mostra a soma das páginas na própria lista.
  await expect(page.getByTestId('job').locator('.job-meta')).toContainText(`${paginasPorArquivo * 3} páginas`)

  // Com limite folgado nada é comprimido, então o arquivo sai pelo ZIP do lote.
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download-all').click()])
  const zip = unzipSync(readFileSync((await download.path())!))
  const juntado = Object.entries(zip).find(([nome]) => nome.endsWith('documentos_juntados.pdf'))
  expect(juntado, `o PDF juntado precisa estar no ZIP: ${Object.keys(zip).join(', ')}`).toBeDefined()
  const bytes = Buffer.from(juntado![1])
  expect(bytes.subarray(0, 4).toString()).toBe('%PDF')
  const doc = await PDFDocument.load(bytes)
  expect(doc.getPageCount(), 'soma das páginas dos três documentos').toBe(paginasPorArquivo * 3)
})

test('juntar nunca engole documento assinado', async ({ page }) => {
  await openApp(page)
  await addAndPrepare(page, [fx.text, fx.text, fx.signedBig], 50)
  await expect(page.getByTestId('job')).toHaveCount(3)

  await page.getByTestId('juntar').check()
  // O aviso precisa dizer o que fica de fora e por quê — é o ponto em que se perde validade jurídica.
  await expect(page.getByTestId('aviso-juntar')).toContainText(/assinatura digital não sobrevive/i)

  await page.getByTestId('start').click()
  await expect.poll(async () => page.locator('[data-testid="job"][data-kind="done"], [data-testid="job"][data-kind="signed"], [data-testid="job"][data-kind="unchanged"]').count(), { timeout: 280_000 }).toBe(2)
  // Sobraram dois: o juntado e o assinado, intocado.
  await expect(page.getByTestId('job')).toHaveCount(2)
  const nomes = await page.getByTestId('job').locator('.job-name').allTextContents()
  expect(nomes).toContain('documentos_juntados.pdf')
  expect(nomes.some((n) => n.includes('signed'))).toBe(true)
  await expect(page.locator('[data-testid="job"]', { hasText: 'signed' })).toContainText(/Assinado digitalmente|Já cabe/)
})

test('as setas mudam a ordem e a ordem manda no arquivo juntado', async ({ page }) => {
  await openApp(page)
  await addAndPrepare(page, [fx.text, fx.scanBig], 50)
  const antes = await page.getByTestId('job').locator('.job-name').allTextContents()
  // Desce o primeiro: a lista inverte.
  await page.getByTestId('job').first().getByTestId('descer').click()
  const depois = await page.getByTestId('job').locator('.job-name').allTextContents()
  expect(depois).toEqual([antes[1], antes[0]])
  // Nos extremos as setas ficam desabilitadas, sem sumir.
  await expect(page.getByTestId('job').first().getByTestId('subir')).toBeDisabled()
  await expect(page.getByTestId('job').last().getByTestId('descer')).toBeDisabled()
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

test('no celular a ferramenta não rola na horizontal, nas duas etapas @navegadores', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/?view=tool')
  await expect(page.getByTestId('engine-status')).toHaveAttribute('data-state', 'ready', { timeout: 120_000 })
  const rolaNaHorizontal = () => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
  // Etapa 1: só a área de upload, e ela precisa caber na tela.
  expect(await rolaNaHorizontal(), 'etapa 1 rola na horizontal').toBe(false)
  const upload = await page.locator('.dropzone.zone-hero').boundingBox()
  expect(upload!.width).toBeLessThanOrEqual(390)
  expect(upload!.height, 'área de upload no celular').toBeGreaterThanOrEqual(190)
  // Etapa 2: aí sim aparecem tribunal e opções.
  await page.getByTestId('file-input').setInputFiles([fx.text])
  await expect.poll(async () => page.locator('[data-testid="job"][data-kind="analyzing"]').count(), { timeout: 60_000 }).toBe(0)
  await page.locator('#regra').selectOption({ index: 1 })
  const widths = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth, select: document.querySelector('#regra')!.getBoundingClientRect().width }))
  expect(widths.scroll, 'largura rolável').toBeLessThanOrEqual(widths.inner)
  expect(widths.select).toBeLessThanOrEqual(widths.inner)
})

test('limite manual inválido bloqueia o botão Preparar e explica o erro', async ({ page }) => {
  await openApp(page)
  await addAndPrepare(page, [fx.scanBig], 6)
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
  await openApp(page)
  await addAndPrepare(page, [fx.restricted], 6)
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
  await openApp(page)
  await addAndPrepare(page, [fx.userPassword, fx.scanBig], 6)
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
  await expect(page.locator('.tool-page')).toHaveCount(0)
  // A primeira tela não pede tribunal, limite nem opções: só o upload.
  await expect(page.locator('#regra')).toHaveCount(0)
  await expect(page.locator('[data-testid="custom-limit"]')).toHaveCount(0)
  await expect(page.locator('.toggles')).toHaveCount(0)
  await expect(page.getByTestId('step-hint')).toHaveText('1 de 4 — Selecionar PDFs')
  await expect(page.locator('#ferramentas')).toBeVisible()
  await expect(page.getByTestId('engine-status')).toHaveAttribute('data-state', 'ready', { timeout: 120_000 })
  await page.getByTestId('file-input').setInputFiles([fx.text])
  await expect(page.locator('.tool-page')).toBeVisible()
  await expect(page.locator('#ferramentas')).toBeHidden()
  await expect(page).toHaveURL(/view=tool/)
  await expect.poll(async () => page.locator('[data-testid="job"][data-kind="analyzing"]').count(), { timeout: 60_000 }).toBe(0)
  await page.getByRole('link', { name: '← Voltar às ferramentas' }).click()
  await expect(page.locator('#ferramentas')).toBeVisible()
  await expect(page.getByText(/no lote/)).toBeVisible()
  await page.getByRole('link', { name: 'Preparar PDFs' }).first().click()
  await expect(page.locator('.tool-page')).toBeVisible()
  await expect(page.getByTestId('job')).toHaveCount(1)
})

test('cabeçalho: âncora, CTA e ferramenta se comportam sem recarregar a página', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('engine-status')).toHaveAttribute('data-state', 'ready', { timeout: 120_000 })
  /*
   * O que importa aqui é a DECISÃO, não a contagem: "Segurança" saiu do menu principal e foi para o
   * rodapé. A versão anterior afirmava `toHaveCount(3)` e quebrou ao entrar a segunda ferramenta na
   * barra — um teste que reprova crescimento legítimo em vez do erro que existia para pegar.
   */
  await expect(page.locator('.site-nav').getByRole('link', { name: 'Segurança' })).toHaveCount(0)
  await expect(page.locator('.site-footer').getByRole('link', { name: 'Segurança' })).toBeVisible()
  // Âncora de seção rola para a própria seção.
  await page.getByRole('link', { name: 'Ferramentas' }).first().click()
  await expect(page.locator('#ferramentas')).toBeInViewport()
  // Sem arquivos, "Preparar PDFs" não troca de tela: leva o foco para a área de upload.
  await page.getByRole('link', { name: 'Preparar PDFs' }).first().click()
  await expect(page.locator('.dropzone.zone-hero')).toBeFocused()
  await expect(page.locator('.dropzone.zone-hero')).toBeInViewport()
  await expect(page.locator('.tool-page')).toHaveCount(0)
  // "Compactar PDF" abre a bancada sem recarregar.
  await page.getByRole('link', { name: 'Compactar PDF' }).first().click()
  await expect(page.locator('.tool-page')).toBeVisible()
  await expect(page).toHaveURL(/view=tool/)
})

test('no celular o menu abre em hambúrguer acessível', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  const menu = page.locator('.nav-toggle')
  await expect(menu.locator('.panel')).toBeHidden()
  await menu.locator('summary').click()
  await expect(menu.locator('.panel')).toBeVisible()
  await expect(menu.getByRole('link', { name: 'Limites por tribunal' })).toBeVisible()
  await expect(menu.getByRole('link', { name: 'Segurança' })).toHaveCount(0)
  await menu.locator('summary').press('Enter')
  await expect(menu.locator('.panel')).toBeHidden()
})

test('o cabeçalho cabe em toda largura, do celular ao monitor grande @navegadores', async ({ page }) => {
  /*
   * Este teste existe por causa de um estrago concreto: acrescentar "Verificar assinatura" à barra
   * fez o cabeçalho estourar entre ~900 e 1120 px, e a PÁGINA INTEIRA passava a rolar na horizontal
   * — numa faixa que é exatamente a de notebook com janela não maximizada. Não apareceu em nenhum
   * teste existente porque os dois que mediam rolagem horizontal olhavam 390 px e 1280 px, e o
   * problema morava no meio.
   *
   * Item novo na barra passa a ter que provar que cabe.
   */
  const larguras = [1440, 1280, 1120, 1040, 960, 901, 900, 820, 700, 560, 390, 360]
  const ruins: string[] = []
  for (const w of larguras) {
    await page.setViewportSize({ width: w, height: 760 })
    await page.goto('/conferir-assinatura/')
    const r = await page.evaluate(() => {
      const inner = document.querySelector('.site-header .inner') as HTMLElement
      return {
        cabecalho: inner.scrollWidth > inner.clientWidth + 1,
        pagina: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      }
    })
    if (r.cabecalho) ruins.push(`${w}px: cabeçalho estoura`)
    if (r.pagina) ruins.push(`${w}px: página rola na horizontal`)
  }
  expect(ruins, 'larguras em que o cabeçalho não cabe').toEqual([])
})

test('a barra leva às duas ferramentas prontas, e marca a página atual', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/conferir-assinatura/')
  const barra = page.locator('.site-nav')
  await expect(barra.getByRole('link', { name: 'Verificar assinatura' })).toBeVisible()
  await expect(barra.getByRole('link', { name: 'Verificar assinatura' })).toHaveAttribute('aria-current', 'page')
  // E leva a alguma parte: do verificador dá para chegar na bancada sem passar pela home.
  await barra.getByRole('link', { name: 'Compactar PDF' }).click()
  await expect(page).toHaveURL(/view=tool/)

  // No celular a barra some, mas o item tem que continuar alcançável pelo hambúrguer.
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/conferir-assinatura/')
  const menu = page.locator('.nav-toggle')
  await menu.locator('summary').click()
  await expect(menu.getByRole('link', { name: 'Verificar assinatura' })).toBeVisible()
})
