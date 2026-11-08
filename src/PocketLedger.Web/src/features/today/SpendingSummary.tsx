import { Button } from '@heroui/react'
import { formatTotal } from './today-api'
import type { DailyTotal } from './today-api'

const displayDate = new Intl.DateTimeFormat('en-GB', { dateStyle: 'full', timeZone: 'UTC' })

export type SpendingSummaryState =
  | { status: 'loading' }
  | { status: 'error'; onRetry: () => void; onOpenSettings?: () => void }
  | { status: 'ready'; total: DailyTotal }

export default function SpendingSummary({ state }: { state: SpendingSummaryState }) {
  return (
    <section className="spending-summary" aria-label="Today’s spending summary">
      <h2>Total spent today</h2>
      <div role="status" aria-live="polite" aria-atomic="true">
        {state.status === 'ready' ? <>
          {state.total.totals.map(total => <p key={total.currency} className="money-display">{formatTotal(total.amountMinorUnits, total.currency)}</p>)}
          <p className="summary-date"><time dateTime={state.total.purchaseDate}>{displayDate.format(new Date(state.total.purchaseDate))}</time> · {state.total.timeZone}</p>
          {!state.total.hasExpenses && <p className="empty-day">No expenses recorded today.</p>}
        </> : <p>{state.status === 'error' ? state.onOpenSettings ? 'Your saved time zone is unavailable. Choose a supported time zone in Settings.' : 'We couldn’t load today’s spending.' : 'Loading today’s spending…'}</p>}
      </div>
      {state.status === 'error' && <Button variant="secondary" onPress={state.onOpenSettings ?? state.onRetry}>{state.onOpenSettings ? 'Open Settings' : 'Try again'}</Button>}
    </section>
  )
}
