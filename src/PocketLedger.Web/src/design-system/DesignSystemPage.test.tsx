import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DesignSystemPage from './DesignSystemPage'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it('demonstrates unavailable spending, retry and zero without calling the API', async () => {
  const fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  const user = userEvent.setup()
  render(<DesignSystemPage onBack={vi.fn()} onEndSession={vi.fn()} />)
  await user.click(screen.getByRole('button', { name: 'Error' }))
  expect(screen.queryByText('42,37 PLN')).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Try again' }))
  expect(screen.getByText('42,37 PLN')).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Loading' }))
  expect(screen.getByText('Loading today’s spending…')).toBeTruthy()
  expect(screen.queryByText('0,00 PLN')).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Empty day' }))
  expect(screen.getByText('0,00 PLN')).toBeTruthy()
  expect(screen.getByText('No expenses recorded today.')).toBeTruthy()
  expect(fetchMock).not.toHaveBeenCalled()
})

it('validates the local form, permits submission, and demonstrates pending/disabled controls', async () => {
  const fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  const user = userEvent.setup()
  render(<DesignSystemPage onBack={vi.fn()} onEndSession={vi.fn()} />)
  await user.click(screen.getByRole('button', { name: 'Save example' }))
  expect(screen.queryByText(/Example saved locally/)).toBeNull()
  const category = screen.getByLabelText('Example category', { exact: false })
  expect(category.getAttribute('aria-invalid')).toBe('true')
  await user.type(category, 'Groceries')
  await user.click(screen.getByRole('button', { name: 'Save example' }))
  expect(screen.getByText(/Example saved locally: Groceries/)).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Pending' }))
  expect(category.hasAttribute('disabled')).toBe(true)
  expect(screen.getByRole('button', { name: 'Saving example…' }).hasAttribute('disabled')).toBe(true)
  await user.click(screen.getByRole('button', { name: 'Disabled' }))
  expect(screen.getByRole('button', { name: 'Save example' }).hasAttribute('disabled')).toBe(true)
  await user.click(screen.getByRole('button', { name: 'Ready' }))
  expect(category.hasAttribute('disabled')).toBe(false)
  expect(fetchMock).not.toHaveBeenCalled()
})
