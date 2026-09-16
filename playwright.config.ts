import { defineConfig, devices } from '@playwright/test'

/*
 * Três motores, com escopos diferentes.
 *
 * Chromium roda a suíte inteira. Firefox e WebKit rodam os testes marcados com @navegadores: os que
 * dependem do MOTOR e não da lógica da aplicação — WebAssembly, Web Workers, WebCrypto, download de
 * Blob e layout no celular. Repetir os 32 em três motores triplicaria o tempo de CI para reexecutar
 * regra de negócio que não muda entre navegadores; o que muda entre eles é justamente a camada
 * baixa, e é essa que a marcação cobre.
 *
 * WebKit é o motor do Safari. Está aqui porque §15.1 da especificação pedia Safari e a conferência
 * de assinatura usa WebCrypto, que é onde Safari mais diverge.
 *
 * `npm run test:e2e` roda SÓ o chromium, de propósito: é o que o CI instala (`playwright install
 * chromium`), e um projeto aqui para um motor que não está na máquina falha a execução inteira em
 * vez de pular. Os três motores rodam por `npm run test:e2e:navegadores`, depois de
 * `npx playwright install --with-deps firefox webkit`.
 */
const NAVEGADORES = /@navegadores/

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 300_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  outputDir: 'test-results/output',
  use: {
    baseURL: 'http://localhost:4329',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] }, grep: NAVEGADORES },
    { name: 'webkit', use: { ...devices['Desktop Safari'] }, grep: NAVEGADORES },
  ],
  webServer: {
    command: 'npm run build && node scripts/serve-dist.mjs 4329',
    url: 'http://localhost:4329/',
    reuseExistingServer: false,
    timeout: 300_000,
  },
})
