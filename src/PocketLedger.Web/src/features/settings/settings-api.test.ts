import { afterEach, expect, it, vi } from 'vitest'
import { loadSettings, saveSettings, SettingsFailure } from './settings-api'

const saved = { timeZone: 'Europe/Warsaw', defaultCurrency: 'PLN', recentCurrencies: [], revision: '0', purchaseDate: '2026-11-08' }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
afterEach(() => vi.unstubAllGlobals())

it('loads saved preferences and catalogue concurrently without caching', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(json(saved)).mockResolvedValueOnce(json(['Europe/Warsaw']))
  vi.stubGlobal('fetch', fetch)
  expect(await loadSettings(new AbortController().signal)).toEqual({ saved, zones: ['Europe/Warsaw'] })
  expect(fetch).toHaveBeenCalledTimes(2)
  expect(fetch.mock.calls[0][1]).toMatchObject({ credentials: 'same-origin', cache: 'no-store' })
})

it('saves only explicit zone intent with a request-bound antiforgery token and exact revision', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(json({ requestToken: 'csrf' })).mockResolvedValueOnce(json({ ...saved, revision: '1' }))
  vi.stubGlobal('fetch', fetch)
  expect((await saveSettings('Europe/Warsaw', '0', new AbortController().signal)).revision).toBe('1')
  expect(fetch.mock.calls[1][1]).toMatchObject({ method: 'PATCH', headers: { 'X-CSRF-TOKEN': 'csrf' }, body: '{"timeZone":"Europe/Warsaw","expectedRevision":"0"}' })
})

it.each([[401, 'unauthorized'], [409, 'conflict'], [400, 'invalid'], [503, 'unavailable']])('classifies %s without exposing server messages', async (status, reason) => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ secret: 'Never display' }, Number(status))))
  await expect(loadSettings(new AbortController().signal)).rejects.toMatchObject({ reason })
})

it.each([
  { ...saved, defaultCurrency: 'BOGUS' }, { ...saved, revision: 0 }, { ...saved, timeZone: '' },
  { ...saved, recentCurrencies: ['PLN'] }, { ...saved, purchaseDate: '2026-02-30' }, null,
])('rejects malformed saved context %#', async body => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json(body)).mockResolvedValueOnce(json(['Europe/Warsaw'])))
  await expect(loadSettings(new AbortController().signal)).rejects.toBeInstanceOf(SettingsFailure)
})

it.each([[], ['Europe/Warsaw', 'Europe/Warsaw'], [''], [42], null])('rejects malformed catalogue %#', async zones => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json(saved)).mockResolvedValueOnce(json(zones)))
  await expect(loadSettings(new AbortController().signal)).rejects.toBeInstanceOf(SettingsFailure)
})

it('keeps unavailable saved zones readable for repair and rejects malformed tokens', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json({ ...saved, purchaseDate: null })).mockResolvedValueOnce(json(['Europe/Warsaw'])))
  expect((await loadSettings(new AbortController().signal)).saved.purchaseDate).toBeNull()
  const fetch = vi.fn().mockResolvedValueOnce(json({ requestToken: '' }))
  vi.stubGlobal('fetch', fetch)
  await expect(saveSettings('Europe/Warsaw', '0', new AbortController().signal)).rejects.toBeInstanceOf(SettingsFailure)
  expect(fetch).toHaveBeenCalledTimes(1)
})
