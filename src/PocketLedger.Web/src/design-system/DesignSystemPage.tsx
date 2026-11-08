import { useEffect, useRef, useState } from 'react'
import { Button, Description, FieldError, Form, Input, Label, TextField } from '@heroui/react'
import PageShell from '../ui/PageShell'
import Notice from '../ui/Notice'
import SpendingSummary from '../features/today/SpendingSummary'
import type { SpendingSummaryState } from '../features/today/SpendingSummary'
import './reference.css'

const swatches = [
  ['background', 'Page background'], ['surface', 'Card surface'], ['foreground', 'Body text'],
  ['muted', 'Supporting text'], ['accent', 'Primary action'], ['danger', 'Error and destructive action'],
  ['info', 'Information'], ['success', 'Success'],
] as const

const exampleDate = '2026-11-02'
const summaryExamples = {
  spending: { purchaseDate: exampleDate, timeZone: 'Europe/Warsaw', preferencesRevision: '0', defaultCurrency: 'PLN', hasExpenses: true, totals: [{ currency: 'PLN', amountMinorUnits: '4237' }] },
  mixed: { purchaseDate: exampleDate, timeZone: 'America/Los_Angeles', preferencesRevision: '7', defaultCurrency: 'EUR', hasExpenses: true, totals: [{ currency: 'PLN', amountMinorUnits: '1000' }, { currency: 'BYN', amountMinorUnits: '1234' }, { currency: 'USD', amountMinorUnits: '5678' }, { currency: 'EUR', amountMinorUnits: '500' }] },
  empty: { purchaseDate: exampleDate, timeZone: 'Europe/Warsaw', preferencesRevision: '0', defaultCurrency: 'PLN', hasExpenses: false, totals: [{ currency: 'PLN', amountMinorUnits: '0' }] },
  large: { purchaseDate: exampleDate, timeZone: 'Europe/Warsaw', preferencesRevision: '0', defaultCurrency: 'PLN', hasExpenses: true, totals: [{ currency: 'PLN', amountMinorUnits: '9223372036854775808' }] },
} as const

type SummaryExample = keyof typeof summaryExamples | 'loading' | 'error'
type FormExample = 'ready' | 'pending' | 'disabled'

type Props = { onBack: () => void; onEndSession: () => void }

export default function DesignSystemPage({ onBack, onEndSession }: Props) {
  const heading = useRef<HTMLHeadingElement>(null)
  const [summaryExample, setSummaryExample] = useState<SummaryExample>('spending')
  const [formExample, setFormExample] = useState<FormExample>('ready')
  const [category, setCategory] = useState('')
  const [feedback, setFeedback] = useState('')
  const summaryState: SpendingSummaryState = summaryExample === 'loading' ? { status: 'loading' }
    : summaryExample === 'error' ? { status: 'error', onRetry: () => setSummaryExample('spending') }
    : { status: 'ready', total: summaryExamples[summaryExample] }

  useEffect(() => {
    document.title = 'Design reference · PocketLedger'
    heading.current?.focus({ preventScroll: true })
  }, [])

  return (
    <PageShell headerAction={<nav className="header-actions" aria-label="Account">
      <Button variant="outline" onPress={onBack}>Back to today</Button>
      <Button variant="ghost" onPress={() => onEndSession()}>Log out</Button>
    </nav>}>
      <main id="main-content" tabIndex={-1} className="reference-main">
        <span className="eyebrow">DESIGN REFERENCE · DEVELOPMENT ONLY</span>
        <h1 className="page-title" ref={heading} tabIndex={-1}>A little clarity,<br />every day.</h1>
        <p className="reference-lead">The PocketLedger theme and working UI patterns. All examples use local sample data; nothing is sent or saved.</p>
        <nav className="reference-links" aria-label="Design reference sections">
          <a className="account-link" href="#foundations">Foundations</a>
          <a className="account-link" href="#controls">Controls</a>
          <a className="account-link" href="#feedback">Feedback</a>
          <a className="account-link" href="#spending">Spending</a>
        </nav>

        <section id="foundations" className="reference-section" aria-labelledby="foundations-heading">
          <h2 id="foundations-heading">Foundations</h2>
          <p>Calm, clear, practical. Warm surfaces, forest green, native system typography, and generous space.</p>
          <ul className="swatch-grid">
            {swatches.map(([token, label]) => <li key={token}>
              <div className="swatch" style={{ background: `var(--${token})` }} />
              <strong>{label}</strong><code>--{token}</code>
            </li>)}
          </ul>
          <div className="surface-card type-samples">
            <span className="eyebrow">EYEBROW · CONTEXT</span>
            <h3>A clear section heading</h3>
            <p>Body text explains the next useful step. Keep financial language factual and free of judgement.</p>
            <p className="reference-muted">Supporting text provides context without competing with the task.</p>
            <p className="reference-caption">Caption text is for secondary metadata, never essential form instructions.</p>
          </div>
        </section>

        <section id="controls" className="reference-section" aria-labelledby="controls-heading">
          <h2 id="controls-heading">Controls and forms</h2>
          <p>One primary action per task. Visible labels, nearby validation, and controls that remain usable with larger text.</p>
          <div className="reference-grid">
            <div className="surface-card">
              <h3>Action hierarchy</h3>
              <div className="reference-actions">
                <Button onPress={() => setFeedback('Primary action selected. This is a local example.')}>Primary action</Button>
                <Button variant="secondary" onPress={() => setFeedback('Secondary action selected. This is a local example.')}>Secondary action</Button>
                <Button variant="outline" onPress={() => setFeedback('Outline action selected. This is a local example.')}>Outline action</Button>
                <Button variant="ghost" onPress={() => setFeedback('Ghost action selected. This is a local example.')}>Ghost action</Button>
                <Button variant="danger" onPress={() => setFeedback('Destructive action preview. No records were deleted.')}>Delete example</Button>
                <Button isDisabled>Disabled action</Button>
              </div>
            </div>
            <div className="surface-card">
              <h3>Form states</h3>
              <div className="reference-actions" role="group" aria-label="Form example state">
                {(['ready', 'pending', 'disabled'] as const).map(state => <Button key={state} variant="outline" aria-pressed={formExample === state} onPress={() => { setFormExample(state); setFeedback('') }}>{state === 'ready' ? 'Ready' : state === 'pending' ? 'Pending' : 'Disabled'}</Button>)}
              </div>
              <Form className="ledger-form" onSubmit={event => { event.preventDefault(); setFeedback(`Example saved locally: ${category.trim()}. No data was sent.`) }}>
                <TextField isRequired name="exampleCategory" value={category} onChange={setCategory} isDisabled={formExample !== 'ready'} validate={value => value.trim() ? null : 'Enter a category.'}>
                  <Label>Example category</Label>
                  <Input className="ledger-input" placeholder="For example, groceries" />
                  <Description>Sample text only. Try submitting an empty field.</Description>
                  <FieldError />
                </TextField>
                <Button className="primary-action" type="submit" isPending={formExample === 'pending'} isDisabled={formExample !== 'ready'}>{formExample === 'pending' ? 'Saving example…' : 'Save example'}</Button>
              </Form>
              <div className="ledger-form reference-invalid">
                <TextField isInvalid name="invalidExample" defaultValue="">
                  <Label>Invalid field example</Label>
                  <Input className="ledger-input" aria-describedby="invalid-example-help" />
                  <FieldError id="invalid-example-help">Enter an amount greater than zero.</FieldError>
                </TextField>
              </div>
            </div>
          </div>
          {feedback && <Notice tone="info">{feedback}</Notice>}
        </section>

        <section id="feedback" className="reference-section" aria-labelledby="feedback-heading">
          <h2 id="feedback-heading">Feedback</h2>
          <p>State what happened and offer a useful next step. Messages communicate meaning through words as well as color.</p>
          <div className="reference-stack">
            <Notice tone="info" announce={false}>Information: Your session has ended. Log in again to see today’s spending.</Notice>
            <Notice tone="danger" announce={false}>Error: We couldn’t save your changes. Check your connection and try again.</Notice>
            <Notice tone="success" announce={false}>Success: Your account has been created.</Notice>
          </div>
        </section>

        <section id="spending" className="reference-section" aria-labelledby="spending-heading">
          <h2 id="spending-heading">Spending summary</h2>
          <p>Spending is a recorded total. Loading and errors never appear as zero. These dated examples do not represent an available allowance.</p>
          <div className="reference-actions" role="group" aria-label="Spending example state">
            {(['spending', 'mixed', 'empty', 'large', 'loading', 'error'] as const).map(state => <Button key={state} variant="outline" aria-pressed={summaryExample === state} onPress={() => setSummaryExample(state)}>{state === 'mixed' ? 'Separate currencies' : state === 'large' ? 'Large amount' : state === 'empty' ? 'Empty day' : state === 'spending' ? 'Spending' : state === 'loading' ? 'Loading' : 'Error'}</Button>)}
          </div>
          <div className="reference-summary"><SpendingSummary state={summaryState} /></div>
        </section>
      </main>
    </PageShell>
  )
}
