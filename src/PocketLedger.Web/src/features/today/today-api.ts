import { sessionHeaders } from '../authentication/auth-api'

export type DailyTotal = { purchaseDate: string; totalGrosz: string }

export async function getDailyTotal(signal: AbortSignal): Promise<DailyTotal | 'unauthorized'> {
  const response = await fetch('/api/expenses/today', {
    headers: sessionHeaders,
    credentials: 'same-origin',
    cache: 'no-store',
    signal,
  })
  if (response.status === 401) return 'unauthorized'
  if (!response.ok) throw new Error('Daily total unavailable')
  const body = await response.json()
  if (typeof body?.totalGrosz !== 'string' || !/^\d+$/.test(body.totalGrosz) ||
      typeof body.purchaseDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.purchaseDate) ||
      !Number.isFinite(Date.parse(body.purchaseDate))) throw new Error('Invalid daily total')
  return body
}

const pln = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' })
const groszPerZloty = 100n
const fractionDigits = 2

export function formatTotal(digits: string) {
  const total = BigInt(digits)
  const fraction = (total % groszPerZloty).toString().padStart(fractionDigits, '0')
  return pln.formatToParts(total / groszPerZloty)
    .map(part => part.type === 'fraction' ? fraction : part.value).join('')
}
