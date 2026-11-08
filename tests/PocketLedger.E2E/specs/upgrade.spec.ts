import { randomUUID } from 'node:crypto'
import { expect, test, type BrowserContext } from '@playwright/test'

async function subjects(context: BrowserContext, email: string) {
  const response = await context.request.post(`${process.env.E2E_CONTROL_URL}/identity-subjects`, {
    headers: { 'X-E2E-Control': process.env.E2E_CONTROL_TOKEN! }, data: { email },
  })
  expect(response.status()).toBe(200)
  return response.json()
}

test('retained realm reconciliation preserves the seeded credentials and provider identity', async ({ browser }) => {
  expect(process.env.E2E_REALM_BASELINE).toBe('phase1')
  const identities = []
  // The harness reconciles the retained realm twice before these real code-flow logins.
  for (let attempt = 0; attempt < 2; attempt++) {
    const context = await browser.newContext()
    try {
      const page = await context.newPage()
      await page.goto('/login')
      await page.getByLabel('Email address', { exact: true }).fill(process.env.E2E_USER_EMAIL!)
      await page.getByLabel('Password', { exact: true }).fill(process.env.E2E_USER_PASSWORD!)
      await page.getByRole('button', { name: 'Log in', exact: true }).click()
      await expect(page.getByRole('heading', { name: 'Today’s spending' })).toBeVisible()
      const me = await context.request.get('/api/auth/me')
      expect(me.status()).toBe(200)
      identities.push(await me.json())
      expect(await subjects(context, process.env.E2E_USER_EMAIL!)).toEqual({ subjects: [process.env.E2E_PROVIDER_SUBJECT] })
    } finally {
      await context.close()
    }
  }
  expect(identities[1]).toEqual(identities[0])
})

test('retained realm gains working registration and new credentials after reconciliation', async ({ browser }) => {
  expect(process.env.E2E_REALM_BASELINE).toBe('phase1')
  const email = `upgrade-${randomUUID()}@example.com`
  const password = `Upgrade-${randomUUID()}`
  const context = await browser.newContext()
  let identity
  let providerIdentity
  try {
    const page = await context.newPage()
    await page.goto('/register')
    await page.getByLabel('Email address', { exact: true }).fill(email)
    await page.getByLabel('Password', { exact: true }).fill(password)
    await page.getByRole('button', { name: 'Create account', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'You’re all set.' })).toBeVisible()
    await page.getByRole('button', { name: 'View today’s spending' }).click()
    await expect(page.getByRole('heading', { name: 'Today’s spending' })).toBeVisible()
    const me = await context.request.get('/api/auth/me')
    expect(me.status()).toBe(200)
    identity = await me.json()
    providerIdentity = await subjects(context, email)
    expect(providerIdentity.subjects).toHaveLength(1)
  } finally {
    await context.close()
  }
  const returning = await browser.newContext()
  try {
    const page = await returning.newPage()
    await page.goto('/login')
    await page.getByLabel('Email address', { exact: true }).fill(email)
    await page.getByLabel('Password', { exact: true }).fill(password)
    await page.getByRole('button', { name: 'Log in', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Today’s spending' })).toBeVisible()
    const me = await returning.request.get('/api/auth/me')
    expect(me.status()).toBe(200)
    expect(await me.json()).toEqual(identity)
    expect(await subjects(returning, email)).toEqual(providerIdentity)
  } finally {
    await returning.close()
  }
})
