import { randomUUID } from 'node:crypto'
import { expect, test, type BrowserContext, type Page } from '@playwright/test'

async function control(context: BrowserContext, route: string, data?: object) {
  const response = await context.request.post(`${process.env.E2E_CONTROL_URL}/${route}`, {
    headers: { 'X-E2E-Control': process.env.E2E_CONTROL_TOKEN! }, data, timeout: 180_000,
  })
  expect(response.status()).toBe(200)
  return response
}

async function account(context: BrowserContext) {
  const response = await context.request.get('/api/auth/me')
  expect(response.status()).toBe(200)
  return response.json()
}

async function credentials(page: Page, email: string, password: string, register: boolean) {
  await page.goto(register ? '/register' : '/login')
  await page.getByLabel('Email address', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: register ? 'Create account' : 'Log in', exact: true }).click()
  if (register) {
    await expect(page.getByRole('heading', { name: 'You’re all set.' })).toBeVisible()
    await page.getByRole('button', { name: 'View today’s spending' }).click()
  }
  await expect(page.getByRole('heading', { name: 'Today’s spending' })).toBeVisible()
}

test('clean setup and full stack restart preserve two new identities, credentials, expenses and ownership', async ({ browser }) => {
  test.setTimeout(240_000)
  const owners = await Promise.all([browser.newContext(), browser.newContext()])
  const emails = owners.map(() => `persistent-${randomUUID()}@example.com`)
  const passwords = owners.map(() => `Persistent-${randomUUID()}`)
  const pages = await Promise.all(owners.map(owner => owner.newPage()))
  const purchaseDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Warsaw' }).format(new Date())
  const purchases = [1234, 5678].map(amountGrosz => ({
    amountGrosz, purchaseDate, category: 'Food', note: 'Restart acceptance', qualifiesForAllowance: true,
  }))
  try {
    const layout = await (await control(owners[0], 'persistence-layout')).json()
    expect(layout.application).not.toBe(layout.identity)
    const identities = []
    const subjects = []
    const expenses = []
    for (const [index, owner] of owners.entries()) {
      await credentials(pages[index], emails[index], passwords[index], true)
      identities.push(await account(owner))
      const provider = await (await control(owner, 'identity-subjects', { email: emails[index] })).json()
      expect(provider.subjects).toHaveLength(1)
      subjects.push(provider)
      const csrf = await (await owner.request.get('/api/auth/preview/antiforgery')).json()
      const created = await owner.request.post('/api/expenses', {
        headers: { 'X-CSRF-TOKEN': csrf.requestToken }, data: purchases[index],
      })
      expect(created.status()).toBe(201)
      const { id } = await created.json()
      const saved = await owner.request.get(`/api/expenses/${id}`)
      expect(saved.status()).toBe(200)
      expenses.push(await saved.json())
    }
    expect(identities[0].accountId).not.toBe(identities[1].accountId)
    expect(subjects[0]).not.toEqual(subjects[1])
    await control(owners[0], 'restart-stack')
    expect(await (await control(owners[0], 'persistence-layout')).json()).toEqual(layout)
    for (const [index, owner] of owners.entries()) {
      // Restore the same protected session, then force a new credential-based login.
      await pages[index].reload()
      await expect(pages[index].getByRole('heading', { name: 'Today’s spending' })).toBeVisible()
      expect(await account(owner)).toEqual(identities[index])
      await owner.clearCookies()
      expect((await owner.request.get('/api/auth/me')).status()).toBe(401)
      await credentials(pages[index], emails[index], passwords[index], false)
      expect(await account(owner)).toEqual(identities[index])
      expect(await (await control(owner, 'identity-subjects', { email: emails[index] })).json()).toEqual(subjects[index])
      const own = await owner.request.get(`/api/expenses/${expenses[index].id}`)
      expect(own.status()).toBe(200)
      expect(await own.json()).toEqual(expenses[index])
      expect(await (await owner.request.get('/api/expenses')).json()).toEqual([expenses[index]])
      expect((await (await owner.request.get('/api/expenses/today')).json()).totalGrosz).toBe(String(purchases[index].amountGrosz))
      const foreign = `/api/expenses/${expenses[1 - index].id}`
      const csrf = await (await owner.request.get('/api/auth/preview/antiforgery')).json()
      const headers = { 'X-CSRF-TOKEN': csrf.requestToken }
      expect((await owner.request.get(foreign)).status()).toBe(404)
      expect((await owner.request.put(foreign, { headers, data: purchases[index] })).status()).toBe(404)
      expect((await owner.request.delete(foreign, { headers })).status()).toBe(404)
    }
    // Rejected foreign writes must leave both owners' exact data intact.
    for (const [index, owner] of owners.entries()) {
      expect(await (await owner.request.get('/api/expenses')).json()).toEqual([expenses[index]])
    }
  } finally {
    await Promise.all(owners.map(owner => owner.close()))
  }
})
