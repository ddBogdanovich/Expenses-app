import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'

const previewHeaders = { 'X-PocketLedger-Auth': 'preview' }

test('legacy registration and login remain the default', async ({ page }) => {
  const email = `legacy-${randomUUID()}@example.com`
  const password = `Test-${randomUUID()}`
  await page.goto('/register')
  await page.getByLabel('Email address', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'You’re all set.' })).toBeVisible()
  await page.getByRole('button', { name: 'View today’s spending' }).click()
  await expect(page.getByRole('heading', { name: 'Today’s spending' })).toBeVisible()
  await page.getByRole('button', { name: 'Log out', exact: true }).click()
  await page.getByLabel('Email address', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Today’s spending' })).toBeVisible()
})

test('seeded preview login owns spending, survives reload, and ends both sessions', async ({ page, context }) => {
  await page.goto('/login')
  await page.getByRole('link', { name: 'Try Keycloak preview', exact: true }).click()
  await expect(page).toHaveURL(/\/realms\/pocketledger\//)
  await page.getByLabel('Email address', { exact: true }).fill(process.env.E2E_USER_EMAIL!)
  await page.getByLabel('Password', { exact: true }).fill(process.env.E2E_USER_PASSWORD!)
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Today’s spending' })).toBeVisible()
  const me = await context.request.get('/api/auth/me', { headers: previewHeaders })
  expect(me.status()).toBe(200)
  const identity = await me.json()
  expect(identity.accountId).toMatch(/^[0-9a-f-]{36}$/)
  expect(identity.accountId).not.toBe(process.env.E2E_PROVIDER_SUBJECT)
  const csrf = await (await context.request.get('/api/auth/preview/antiforgery')).json()
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Warsaw' }).format(new Date())
  const created = await context.request.post('/api/expenses', {
    headers: { ...previewHeaders, 'X-CSRF-TOKEN': csrf.requestToken },
    data: { amountGrosz: 4237, purchaseDate: today, category: 'Food', note: null, qualifiesForAllowance: true },
  })
  expect(created.status()).toBe(201)
  await page.reload()
  await expect(page.getByText('42,37', { exact: false })).toBeVisible()
  expect(await (await context.request.get('/api/auth/me', { headers: previewHeaders })).json()).toEqual(identity)
  expect((await context.request.get('/api/expenses/today')).status()).toBe(401)
  expect(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))).toEqual({ local: {}, session: {} })
  const oldCookies = await context.cookies()
  await page.getByRole('button', { name: 'Log out', exact: true }).click()
  // Token-free RP logout can require provider-side confirmation.
  const confirm = page.getByRole('button', { name: /^(Yes|Log out)$/ })
  if (await confirm.isVisible()) await confirm.click()
  await expect(page.getByRole('heading', { name: 'Keycloak preview' })).toBeVisible()
  expect((await context.request.get('/api/auth/me', { headers: previewHeaders })).status()).toBe(401)
  await context.addCookies(oldCookies.filter(cookie => cookie.name.includes('Preview')))
  expect((await context.request.get('/api/auth/me', { headers: previewHeaders })).status()).toBe(401)
  await context.clearCookies({ name: /Preview/ })
  await page.getByRole('link', { name: 'Log in with Keycloak', exact: true }).click()
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible()
})
