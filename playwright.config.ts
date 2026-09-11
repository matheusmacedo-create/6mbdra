import { defineConfig } from '@playwright/test'

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
  webServer: {
    command: 'npm run build && node scripts/serve-dist.mjs 4329',
    url: 'http://localhost:4329/',
    reuseExistingServer: false,
    timeout: 300_000,
  },
})
