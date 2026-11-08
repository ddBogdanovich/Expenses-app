// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SettingsPage from './SettingsPage'
import { SettingsMemory } from './settings-memory'
import { loadSettings, saveSettings, SettingsFailure } from './settings-api'

vi.mock('./settings-api', async importOriginal => {
  const original = await importOriginal<typeof import('./settings-api')>()
  return { ...original, loadSettings: vi.fn(), saveSettings: vi.fn() }
})
const saved = { timeZone: 'Europe/Warsaw', defaultCurrency: 'PLN' as const, recentCurrencies: [], revision: '0', purchaseDate: '2026-11-08' }
const load = vi.mocked(loadSettings)
const save = vi.mocked(saveSettings)
afterEach(() => { cleanup(); vi.resetAllMocks() })
function mount() {
  const onBack = vi.fn(), onEndSession = vi.fn()
  render(<SettingsPage onBack={onBack} onEndSession={onEndSession} />)
  return { onBack, onEndSession }
}

it('loads defaults, saves with pending protection, confirms persistence and permits cancellation', async () => {
  load.mockResolvedValue({ saved, zones: ['Europe/Warsaw', 'America/Los_Angeles'] })
  let finish!: (value: typeof saved) => void
  save.mockImplementation(() => new Promise(resolve => { finish = resolve }))
  const { onBack } = mount()
  const user = userEvent.setup()
  const zone = await screen.findByRole('combobox', { name: /^Time zone/ })
  expect((zone as HTMLInputElement).value).toBe('Europe/Warsaw')
  await user.click(screen.getByRole('button', { name: 'Save settings' }))
  expect(screen.getByRole('button', { name: 'Saving settings…' }).hasAttribute('disabled')).toBe(true)
  await act(async () => finish({ ...saved, revision: '1' }))
  expect(await screen.findByText('Settings saved.')).toBeTruthy()
  expect(save).toHaveBeenCalledTimes(1)
  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(onBack).toHaveBeenCalledOnce()
})

it('retains a selected zone after failed save, then reloads after an explicit conflict', async () => {
  load.mockResolvedValue({ saved, zones: ['Europe/Warsaw'] })
  save.mockRejectedValueOnce(new TypeError('offline')).mockRejectedValueOnce(new SettingsFailure('conflict'))
  mount()
  const user = userEvent.setup()
  await screen.findByRole('combobox')
  await user.click(screen.getByRole('button', { name: 'Save settings' }))
  expect((await screen.findByRole('alert')).textContent).toContain('We couldn’t confirm')
  expect((screen.getByRole('combobox') as HTMLInputElement).value).toBe('Europe/Warsaw')
  await user.click(screen.getByRole('button', { name: 'Save settings' }))
  expect((await screen.findByRole('alert')).textContent).toContain('Settings changed')
  await user.click(screen.getByRole('button', { name: 'Reload settings' }))
  await screen.findByRole('combobox')
  expect(load).toHaveBeenCalledTimes(2)
})

it('retries unavailable initial settings and fails closed on session expiry', async () => {
  load.mockRejectedValueOnce(new TypeError('offline')).mockResolvedValueOnce({ saved, zones: ['Europe/Warsaw'] })
  save.mockRejectedValueOnce(new SettingsFailure('unauthorized'))
  const { onEndSession } = mount()
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Try again' }))
  await screen.findByRole('combobox')
  await user.click(screen.getByRole('button', { name: 'Save settings' }))
  expect(onEndSession).toHaveBeenCalledWith(expect.stringContaining('session has ended'))
})

it('rejects unauthenticated context and ignores a load that finishes after leaving Settings', async () => {
  load.mockRejectedValueOnce(new SettingsFailure('unauthorized'))
  const { onEndSession } = mount()
  await act(async () => {})
  expect(onEndSession).toHaveBeenCalledOnce()
  cleanup()
  let finish!: (value: Awaited<ReturnType<typeof loadSettings>>) => void
  load.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const view = render(<SettingsPage onBack={vi.fn()} onEndSession={vi.fn()} />)
  view.unmount()
  await act(async () => finish({ saved, zones: ['Europe/Warsaw'] }))
  expect(screen.queryByRole('combobox')).toBeNull()
})

it('lets an unavailable saved zone be repaired without silently substituting Warsaw', async () => {
  load.mockResolvedValue({ saved: { ...saved, timeZone: 'Unavailable/Zone', purchaseDate: null }, zones: ['Europe/Warsaw'] })
  mount()
  expect((await screen.findByRole('alert')).textContent).toContain('Your saved time zone is unavailable')
  expect((screen.getByRole('combobox') as HTMLInputElement).value).toBe('Unavailable/Zone')
})

it('retains a restored draft through catalogue failure and offers a usable loading retry', async () => {
  const memory = new SettingsMemory()
  memory.write({ saved, selected: 'America/Los_Angeles', input: 'America/Los_Angeles', pending: false, message: null })
  load.mockRejectedValueOnce(new TypeError('offline')).mockResolvedValueOnce({ saved, zones: ['Europe/Warsaw', 'America/Los_Angeles'] })
  render(<SettingsPage memory={memory} onBack={vi.fn()} onEndSession={vi.fn()} />)
  expect(await screen.findByRole('alert')).toBeTruthy()
  expect(screen.queryByRole('combobox')).toBeNull()
  expect(screen.queryByText(/Your saved time zone is unavailable/)).toBeNull()
  await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }))
  expect((await screen.findByRole('combobox') as HTMLInputElement).value).toBe('America/Los_Angeles')
})
