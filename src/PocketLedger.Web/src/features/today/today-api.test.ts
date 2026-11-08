import { afterEach, expect, it, vi } from 'vitest'
import { formatTotal, getDailyTotal, UnavailableTimeZone } from './today-api'

const summary = { purchaseDate: '2026-11-08', timeZone: 'America/Los_Angeles', preferencesRevision: '9223372036854775808', defaultCurrency: 'PLN', hasExpenses: true, totals: [{ currency: 'PLN', amountMinorUnits: '1000' }, { currency: 'EUR', amountMinorUnits: '500' }] }
afterEach(() => vi.unstubAllGlobals())
it('retains explicit mixed totals and exact context from the server', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(summary))))
  expect(await getDailyTotal(new AbortController().signal)).toEqual(summary)
})
it.each(['PLN', 'BYN', 'USD', 'EUR'] as const)('formats %s exactly above Int64 sum range', currency => {
  const result = formatTotal('9223372036854775808', currency).replace(/\s/g, ' ')
  expect(result).toBe(`92 233 720 368 547 758,08 ${currency}`)
})
it.each([
  { ...summary, purchaseDate: '2026-02-30' }, { ...summary, preferencesRevision: 3 }, { ...summary, timeZone: '' },
  { ...summary, defaultCurrency: 'GBP' }, { ...summary, hasExpenses: 'yes' }, { ...summary, totals: [] },
  { ...summary, totals: [null] }, { ...summary, totals: [{ currency: 'EUR', amountMinorUnits: '1.5' }] },
  { ...summary, totals: [summary.totals[0], summary.totals[0]] }, { ...summary, hasExpenses: false },
  { ...summary, hasExpenses: false, totals: [{ currency: 'EUR', amountMinorUnits: '0' }] },
])('rejects malformed or misleading daily payload %#', async body => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(body))))
  await expect(getDailyTotal(new AbortController().signal)).rejects.toThrow('Invalid daily total')
})

it('preserves the bounded unavailable-zone recovery reason', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 'preferences.unavailable_zone' }), { status: 409 })))
  await expect(getDailyTotal(new AbortController().signal)).rejects.toBeInstanceOf(UnavailableTimeZone)
})
