import { Button } from '@heroui/react'
import { formatTotal } from './today-api'
import type { DailyTotal } from './today-api'

const displayDate = new Intl.DateTimeFormat('en-GB', { dateStyle: 'full', timeZone: 'UTC' })

export type SpendingSummaryState =
  | { status: 'loading' }
  | { status: 'error'; onRetry: () => void }
  | { status: 'ready'; total: DailyTotal }

export default function SpendingSummary({ state }: { state: SpendingSummaryState }) {
  return (
    <section className="spending-summary" aria-label="Today’s spending summary">
      <h2>Total spent today</h2>
      <div role="status" aria-live="polite" aria-atomic="true">
        {state.status === 'ready' ? <>
          <p className="money-display">{formatTotal(state.total.totalGrosz)}</p>
          <p className="summary-date"><time dateTime={state.total.purchaseDate}>{displayDate.format(new Date(state.total.purchaseDate))}</time> · Warsaw</p>
          {state.total.totalGrosz === '0' && <p className="empty-day">No expenses recorded today.</p>}
        </> : <p>{state.status === 'error' ? 'We couldn’t load today’s spending.' : 'Loading today’s spending…'}</p>}
      </div>
      {state.status === 'error' && <Button variant="secondary" onPress={state.onRetry}>Try again</Button>}
    </section>
  )
}
