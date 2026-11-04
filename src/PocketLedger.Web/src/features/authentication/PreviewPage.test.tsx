import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PreviewPage from './PreviewPage'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

it('keeps protected content hidden until the selected session is verified', async () => {
  const fetchMock = vi.fn().mockResolvedValue(json({}, 401))
  vi.stubGlobal('fetch', fetchMock)
  render(<PreviewPage />)
  expect(screen.queryByRole('heading', { name: 'Today’s spending' })).toBeNull()
  expect(await screen.findByRole('link', { name: 'Log in with Keycloak' })).toBeTruthy()
  expect(fetchMock).toHaveBeenCalledWith('/api/auth/me', expect.objectContaining({ headers: { 'X-PocketLedger-Auth': 'preview' }, cache: 'no-store' }))
})

it('fails closed on an unavailable session and allows an explicit retry', async () => {
  const fetchMock = vi.fn().mockRejectedValueOnce(new Error('Network unavailable')).mockResolvedValue(json({}, 401))
  vi.stubGlobal('fetch', fetchMock)
  render(<PreviewPage />)
  await userEvent.setup().click(await screen.findByRole('button', { name: 'Try again' }))
  expect(await screen.findByRole('link', { name: 'Log in with Keycloak' })).toBeTruthy()
  expect(screen.queryByRole('heading', { name: 'Today’s spending' })).toBeNull()
})

it('does not claim logout succeeded when its request token is unavailable', async () => {
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Warsaw' }).format(new Date())
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json({ accountId: 'local-account' }))
    .mockResolvedValueOnce(json({ purchaseDate: today, totalGrosz: '4237' })).mockResolvedValueOnce(json({}, 503)))
  render(<PreviewPage />)
  await screen.findByText('42,37 zł')
  await userEvent.setup().click(screen.getByRole('button', { name: 'Log out' }))
  await screen.findByText(/We couldn’t complete logout/)
  expect(screen.queryByText('42,37 zł')).toBeNull()
})
