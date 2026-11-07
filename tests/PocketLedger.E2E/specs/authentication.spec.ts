import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'

const previewHeaders = { 'X-PocketLedger-Auth': 'preview' }

test('legacy backend remains isolated until Phase 6 without browser credential forms', async ({ context }) => {
  const email = `legacy-${randomUUID()}@example.com`
  const password = `Test-${randomUUID()}`
  const registered = await context.request.post('/api/auth/register', { data: { email, password } })
  expect(registered.status()).toBe(201)
  const { accessToken } = await registered.json()
  expect((await context.request.get('/api/expenses/today', { headers: { ...previewHeaders, Authorization: `Bearer ${accessToken}` } })).status()).toBe(401)
  const loggedIn = await context.request.post('/api/auth/login', { data: { email, password } })
  expect(loggedIn.status()).toBe(200)
  expect((await context.request.get('/api/auth/me', { headers: { Authorization: `Bearer ${(await loggedIn.json()).accessToken}` } })).status()).toBe(200)
})

test('seeded preview login owns spending, survives reload, and ends both sessions', async ({ page, context }) => {
  expect((await context.request.get('/api/expenses/today', { headers: previewHeaders })).status()).toBe(401)
  await page.goto('/login')
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
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Warsaw' }).format(new Date())
  const expense = { amountGrosz: 4237, purchaseDate: today, category: 'Food', note: null, qualifiesForAllowance: true }
  expect((await context.request.post('/api/expenses', { headers: previewHeaders, data: expense })).status()).toBe(400)
  expect((await context.request.post('/api/expenses', { headers: { ...previewHeaders, 'X-CSRF-TOKEN': 'invalid-token' }, data: expense })).status()).toBe(400)
  expect((await (await context.request.get('/api/expenses/today', { headers: previewHeaders })).json()).totalGrosz).toBe('0')
  expect((await context.request.post('/api/auth/preview/logout', { maxRedirects: 0 })).status()).toBe(400)
  const csrf = await (await context.request.get('/api/auth/preview/antiforgery')).json()
  const created = await context.request.post('/api/expenses', {
    headers: { ...previewHeaders, 'X-CSRF-TOKEN': csrf.requestToken },
    data: expense,
  })
  expect(created.status()).toBe(201)
  const restarted = await context.request.post(`${process.env.E2E_CONTROL_URL}/restart-api`, { headers: { 'X-E2E-Control': process.env.E2E_CONTROL_TOKEN! } })
  expect(restarted.status()).toBe(200)
  await page.reload()
  await expect(page.getByText('42,37', { exact: false })).toBeVisible()
  expect(await (await context.request.get('/api/auth/me', { headers: previewHeaders })).json()).toEqual(identity)
  expect((await context.request.get('/api/expenses/today')).status()).toBe(401)
  expect(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))).toEqual({ local: {}, session: {} })
  const oldCookies = await context.cookies()
  const sessionCookie = oldCookies.find(cookie => cookie.name === 'PocketLedger.Preview')!
  await context.addCookies([{ ...sessionCookie, value: 'tampered-session-cookie' }])
  expect((await context.request.get('/api/auth/me', { headers: previewHeaders })).status()).toBe(401)
  await context.addCookies([sessionCookie])
  const other = await context.request.post('/api/auth/register', { data: { email: `other-${randomUUID()}@example.com`, password: `Other-${randomUUID()}` } })
  expect(other.status()).toBe(201)
  const { accessToken } = await other.json()
  expect(await (await context.request.get('/api/auth/me', { headers: { ...previewHeaders, Authorization: `Bearer ${accessToken}` } })).json()).toEqual(identity)
  const legacyMe = await context.request.get('/api/auth/me', { headers: { Authorization: `Bearer ${accessToken}` } })
  expect(legacyMe.status()).toBe(200)
  expect((await legacyMe.json()).accountId).not.toBe(identity.accountId)
  await page.getByRole('button', { name: 'Log out', exact: true }).click()
  // Token-free RP logout can require provider-side confirmation.
  const confirm = page.getByRole('button', { name: /^(Yes|Log out)$/ })
  await expect(confirm).toBeVisible()
  await confirm.click()
  await expect(page.getByRole('heading', { name: 'You’re logged out.' })).toBeVisible()
  expect((await context.request.get('/api/auth/me', { headers: previewHeaders })).status()).toBe(401)
  await context.addCookies(oldCookies.filter(cookie => cookie.name.includes('Preview')))
  expect((await context.request.get('/api/auth/me', { headers: previewHeaders })).status()).toBe(401)
  await context.clearCookies({ name: /Preview/ })
  await page.getByRole('link', { name: 'Log in', exact: true }).click()
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible()
})
