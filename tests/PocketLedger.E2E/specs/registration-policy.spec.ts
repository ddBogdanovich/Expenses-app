import { randomUUID } from 'node:crypto'
import { expect, test, type Page, type BrowserContext } from '@playwright/test'

const headers = { 'X-PocketLedger-Auth': 'preview' }

async function expectOneIdentity(context: BrowserContext, email: string) {
  const response = await context.request.post(`${process.env.E2E_CONTROL_URL}/identity-count`, {
    headers: { 'X-E2E-Control': process.env.E2E_CONTROL_TOKEN! }, data: { email },
  })
  expect(response.status()).toBe(200)
  expect(await response.json()).toEqual({ count: 1 })
}

async function registration(page: Page) {
  const start = await page.request.get('/api/auth/preview/start', { maxRedirects: 0 })
  expect(start.status()).toBe(302)
  const url = new URL(start.headers().location)
  expect(url.pathname).toContain('/protocol/openid-connect/auth')
  url.pathname = url.pathname.replace(/\/auth$/, '/registrations')
  await page.goto(url.toString())
  await expect(page.locator('#kc-register-form')).toBeVisible()
}

async function submit(page: Page, email: string, password: string) {
  // Policy acceptance bypasses client constraints so the provider remains the authority.
  await page.locator('#kc-register-form').evaluate(form => { form.noValidate = true })
  await page.locator('#password').evaluate(input => { input.removeAttribute('maxlength') })
  // Text input permits whitespace: browser email validation must not hide provider behavior.
  await page.locator('#email').evaluate(element => element.setAttribute('type', 'text'))
  await page.locator('#email').fill(email)
  await page.locator('#password').fill(password)
  await page.locator('#kc-register-form [type=submit]').click()
}

async function continueRegistration(page: Page) {
  await expect(page.getByRole('heading', { name: 'You’re all set.' })).toBeVisible()
  await page.getByRole('button', { name: 'View today’s spending' }).click()
  await expect(page).toHaveURL(/\/preview$/)
}

async function login(page: Page, email: string, password: string) {
  await page.goto('/api/auth/preview/start')
  await page.getByLabel('Email address', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
}

for (const length of [11, 12, 128, 129]) {
  test(`provider registration enforces password length ${length} with email and password only`, async ({ page, context }) => {
    await registration(page)
    await submit(page, `boundary-${randomUUID()}@example.com`, 'a'.repeat(length))
    if (length === 12 || length === 128) {
      await continueRegistration(page)
      expect((await context.request.get('/api/auth/me', { headers })).status()).toBe(200)
    } else {
      await expect(page.locator('#kc-register-form')).toBeVisible()
      await expect(page.locator('#input-error-password')).toBeVisible()
      expect((await context.request.get('/api/auth/me', { headers })).status()).toBe(401)
    }
  })
}

test('trimmed case-insensitive duplicate registration preserves the original password', async ({ browser }) => {
  const owner = await browser.newContext()
  const duplicate = await browser.newContext()
  try {
    const email = `normalized-${randomUUID()}@example.com`
    const password = `Original-${randomUUID()}`
    const first = await owner.newPage()
    await registration(first)
    await submit(first, `  ${email.toUpperCase()}  `, password)
    await continueRegistration(first)
    const identity = await (await owner.request.get('/api/auth/me', { headers })).json()
    const second = await duplicate.newPage()
    await registration(second)
    const rejectedPassword = `Rejected-${randomUUID()}`
    await submit(second, email, rejectedPassword)
    await expect(second.locator('#kc-register-form')).toBeVisible()
    await expect(second.getByText(/already associated with an existing account/i).first()).toBeVisible()
    expect((await duplicate.request.get('/api/auth/me', { headers })).status()).toBe(401)
    await login(second, email, rejectedPassword)
    await expect(second.getByRole('alert')).toBeVisible()
    expect((await duplicate.request.get('/api/auth/me', { headers })).status()).toBe(401)
    await login(second, ` ${email.toUpperCase()} `, password)
    await expect(second).toHaveURL(/\/preview$/)
    expect(await (await duplicate.request.get('/api/auth/me', { headers })).json()).toEqual(identity)
    await expectOneIdentity(owner, email)
  } finally {
    await owner.close()
    await duplicate.close()
  }
})

test('concurrent normalized registrations create one identity and retain the winning credentials', async ({ browser }) => {
  const contexts = await Promise.all([browser.newContext(), browser.newContext()])
  try {
    const pages = await Promise.all(contexts.map(context => context.newPage()))
    const email = `concurrent-${randomUUID()}@example.com`
    const passwords = [`First-${randomUUID()}`, `Second-${randomUUID()}`]
    await Promise.all(pages.map(page => registration(page)))
    await Promise.all(pages.map((page, index) => submit(page, index === 0 ? email : ` ${email.toUpperCase()} `, passwords[index])))
    // The winner sees trusted confirmation before the local session is issued.
    await expect.poll(async () => (await Promise.all(pages.map(page =>
      page.getByRole('heading', { name: 'You’re all set.' }).count()))).reduce((sum, count) => sum + count, 0)).toBe(1)
    for (const page of pages) {
      if (await page.getByRole('heading', { name: 'You’re all set.' }).count()) await continueRegistration(page)
    }
    await expect.poll(async () => (await Promise.all(contexts.map(async context =>
      (await context.request.get('/api/auth/me', { headers })).status()))).sort()).toEqual([200, 401])
    const statuses = await Promise.all(contexts.map(async context => (await context.request.get('/api/auth/me', { headers })).status()))
    const winner = statuses.indexOf(200)
    const loser = 1 - winner
    // A database-level provider race can render Keycloak's generic denial page.
    // Phase 2 asserts rejected ownership and unchanged credentials; branded recovery is Phase 3.
    await expect(pages[loser]).toHaveURL(/\/realms\/pocketledger\//)
    await login(pages[loser], email, passwords[loser])
    await expect(pages[loser].getByRole('alert')).toBeVisible()
    expect((await contexts[loser].request.get('/api/auth/me', { headers })).status()).toBe(401)
    await login(pages[loser], email, passwords[winner])
    await expect(pages[loser]).toHaveURL(/\/preview$/)
    const identities = await Promise.all(contexts.map(async context => (await context.request.get('/api/auth/me', { headers })).json()))
    expect(identities[0]).toEqual(identities[1])
    await expectOneIdentity(contexts[winner], email)
  } finally {
    await Promise.all(contexts.map(context => context.close()))
  }
})

test('two registered preview owners cannot read, replace, delete, or total each other’s purchases', async ({ browser }) => {
  const contexts = await Promise.all([browser.newContext(), browser.newContext()])
  try {
    await Promise.all(contexts.map(async context => {
      const page = await context.newPage()
      await registration(page)
      await submit(page, `owner-${randomUUID()}@example.com`, `Owner-${randomUUID()}`)
      await continueRegistration(page)
    }))
    const csrf = await Promise.all(contexts.map(async context => (await context.request.get('/api/auth/preview/antiforgery')).json()))
    const auth = csrf.map(token => ({ ...headers, 'X-CSRF-TOKEN': token.requestToken }))
    const purchaseDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Warsaw' }).format(new Date())
    const data = { amountGrosz: 1234, purchaseDate, category: 'Food', qualifiesForAllowance: true }
    const created = await contexts[0].request.post('/api/expenses', { headers: auth[0], data })
    expect(created.status()).toBe(201)
    const { id } = await created.json()
    expect((await contexts[1].request.get(`/api/expenses/${id}`, { headers })).status()).toBe(404)
    expect((await contexts[1].request.put(`/api/expenses/${id}`, { headers: auth[1], data })).status()).toBe(404)
    expect((await contexts[1].request.delete(`/api/expenses/${id}`, { headers: auth[1] })).status()).toBe(404)
    expect(await (await contexts[1].request.get('/api/expenses', { headers })).json()).toEqual([])
    expect((await (await contexts[1].request.get('/api/expenses/today', { headers })).json()).totals[0].amountMinorUnits).toBe('0')
    expect((await (await contexts[0].request.get('/api/expenses/today', { headers })).json()).totals[0].amountMinorUnits).toBe('1234')
  } finally {
    await Promise.all(contexts.map(context => context.close()))
  }
})
