import { sessionHeaders } from '../authentication/auth-api'

export const currencyCodes = ['PLN', 'BYN', 'USD', 'EUR'] as const
export type CurrencyCode = typeof currencyCodes[number]
export type CurrencyTotal = { currency: CurrencyCode; amountMinorUnits: string }
export type DailyTotal = {
  purchaseDate: string; timeZone: string; preferencesRevision: string
  defaultCurrency: CurrencyCode; hasExpenses: boolean; totals: readonly CurrencyTotal[]
}

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return currencyCodes.some(code => code === value)
}

export function isDateOnly(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
}

export class UnavailableTimeZone extends Error {}

export async function getDailyTotal(signal: AbortSignal): Promise<DailyTotal | 'unauthorized'> {
  const response = await fetch('/api/expenses/today', {
    headers: sessionHeaders, credentials: 'same-origin', cache: 'no-store', signal,
  })
  if (response.status === 401) return 'unauthorized'
  if (response.status === 409 && (await response.json()).code === 'preferences.unavailable_zone') throw new UnavailableTimeZone()
  if (!response.ok) throw new Error('Daily total unavailable')
  const body = await response.json()
  if (!isDateOnly(body?.purchaseDate) || typeof body.timeZone !== 'string' || !body.timeZone ||
      typeof body.preferencesRevision !== 'string' || !/^\d+$/.test(body.preferencesRevision) ||
      !isCurrencyCode(body.defaultCurrency) || typeof body.hasExpenses !== 'boolean' ||
      !Array.isArray(body.totals) || body.totals.length === 0 ||
      body.totals.some((total: CurrencyTotal) => !total || !isCurrencyCode(total.currency) ||
        typeof total.amountMinorUnits !== 'string' || !/^\d+$/.test(total.amountMinorUnits)) ||
      new Set(body.totals.map((total: CurrencyTotal) => total.currency)).size !== body.totals.length ||
      (!body.hasExpenses && (body.totals.length !== 1 || body.totals[0].currency !== body.defaultCurrency ||
        BigInt(body.totals[0].amountMinorUnits) !== 0n))) throw new Error('Invalid daily total')
  return body
}

const minorUnitsPerMajorUnit = 100n
const fractionDigits = 2
const formatters = Object.fromEntries(currencyCodes.map(currency => [currency,
  new Intl.NumberFormat('pl-PL', { style: 'currency', currency, currencyDisplay: 'code' }),
])) as Record<CurrencyCode, Intl.NumberFormat>

export function formatTotal(digits: string, currency: CurrencyCode = 'PLN') {
  const total = BigInt(digits)
  const fraction = (total % minorUnitsPerMajorUnit).toString().padStart(fractionDigits, '0')
  return formatters[currency].formatToParts(total / minorUnitsPerMajorUnit)
    .map(part => part.type === 'fraction' ? fraction : part.value).join('')
}
