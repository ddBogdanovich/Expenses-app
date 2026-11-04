import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './specs',
  outputDir: '../../output/playwright/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL,
    viewport: { width: 1440, height: 1000 },
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
})
