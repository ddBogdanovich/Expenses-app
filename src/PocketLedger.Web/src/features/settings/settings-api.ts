import { isDateOnly } from '../today/today-api'

export type Preferences = {
  timeZone: string; defaultCurrency: 'PLN'; recentCurrencies: string[]; revision: string; purchaseDate: string | null
}
export class SettingsFailure extends Error {
  readonly reason: 'unauthorized' | 'conflict' | 'unavailable' | 'invalid'
  constructor(reason: SettingsFailure['reason']) { super(reason); this.reason = reason }
}

async function read(response: Response) {
  if (response.status === 401) throw new SettingsFailure('unauthorized')
  if (response.status === 409) throw new SettingsFailure('conflict')
  if (response.status === 400) throw new SettingsFailure('invalid')
  if (!response.ok) throw new SettingsFailure('unavailable')
  return response.json()
}

function preferences(body: Preferences): Preferences {
  if (!body || typeof body.timeZone !== 'string' || !body.timeZone || body.defaultCurrency !== 'PLN' ||
      !Array.isArray(body.recentCurrencies) || body.recentCurrencies.length !== 0 ||
      typeof body.revision !== 'string' || !/^\d+$/.test(body.revision) ||
      body.purchaseDate !== null && !isDateOnly(body.purchaseDate)) throw new SettingsFailure('unavailable')
  return body
}

export async function loadSettings(signal: AbortSignal) {
  const options = { credentials: 'same-origin', cache: 'no-store', signal } as const
  const [saved, zones] = await Promise.all([
    fetch('/api/preferences', options).then(read).then(preferences),
    fetch('/api/preferences/time-zones', options).then(read),
  ])
  if (!Array.isArray(zones) || !zones.length || zones.some(zone => typeof zone !== 'string' || !zone) ||
      new Set(zones).size !== zones.length) throw new SettingsFailure('unavailable')
  return { saved, zones: zones as string[] }
}

export async function saveSettings(timeZone: string, expectedRevision: string, signal: AbortSignal) {
  const token = await read(await fetch('/api/auth/preview/antiforgery', {
    credentials: 'same-origin', cache: 'no-store', signal,
  }))
  if (typeof token?.requestToken !== 'string' || !token.requestToken) throw new SettingsFailure('unavailable')
  return preferences(await read(await fetch('/api/preferences', {
    method: 'PATCH', credentials: 'same-origin', cache: 'no-store', signal,
    headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': token.requestToken },
    body: JSON.stringify({ timeZone, expectedRevision }),
  })))
}
