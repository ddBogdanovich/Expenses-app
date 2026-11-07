import { useEffect, useRef } from 'react'
import { Button } from '@heroui/react'
import PageShell from '../../ui/PageShell'
import Notice from '../../ui/Notice'
import { hostedEntry, type Destination } from './auth-api'

const failures: Record<string, { title: string; message: string }> = {
  'auth.provider_unavailable': { title: 'Login is temporarily unavailable.', message: 'We couldn’t reach the login service. Please try again in a moment.' },
  'auth.cancelled': { title: 'Login was cancelled.', message: 'You haven’t been logged in. You can start a new login when you’re ready.' },
  'auth.transaction_expired': { title: 'Your login attempt has expired.', message: 'For your security, login attempts last for a limited time. Start a new attempt to continue.' },
  'auth.callback_failed': { title: 'We couldn’t complete login.', message: 'Start a new login attempt to continue safely.' },
}

type Props = { state: 'logging-out' | 'checking' | 'unavailable' | 'expired' | 'logged-out' | 'logout-failed' | 'recovery'; destination: Destination; onRetry: () => void }

export default function SessionNotice({ state, destination, onRetry }: Props) {
  const heading = useRef<HTMLHeadingElement>(null)
  const code = new URLSearchParams(window.location.search).get('code') ?? ''
  const failure = Object.hasOwn(failures, code) ? failures[code] : failures['auth.callback_failed']
  const title = state === 'logging-out' ? 'Logging out…' : state === 'recovery' ? failure.title : state === 'logged-out' ? 'You’re logged out.'
    : state === 'expired' ? 'Your session has ended.' : state === 'logout-failed' ? 'Logout is incomplete.'
      : state === 'unavailable' ? 'We couldn’t verify your session.' : 'Checking your session…'
  useEffect(() => { heading.current?.focus({ preventScroll: true }) }, [title])
  return <PageShell>
    <main id="main-content" className="today-main" tabIndex={-1}>
      <h1 className="page-title" tabIndex={-1} ref={heading}>{title}</h1>
      {state === 'checking' || state === 'logging-out' ? <p role="status">{state === 'logging-out' ? 'Please wait while we log you out.' : 'Please wait while we check your session.'}</p> : <>
        <Notice tone={state === 'unavailable' || state === 'logout-failed' || state === 'recovery' ? 'danger' : 'info'}>
          {state === 'recovery' ? failure.message : state === 'logged-out' ? 'Your spending is hidden. Log in when you’re ready to return.'
            : state === 'expired' ? 'Log in again to continue. Your spending is hidden.'
              : state === 'logout-failed' ? 'We couldn’t complete logout. Your spending is hidden, but your sessions may still be active. Try logging out again.'
                : 'Check your connection and try again. Your spending is hidden until we can verify your session.'}
        </Notice>
        <div className="header-actions">
          {state === 'unavailable' || state === 'logout-failed' ? <Button onPress={onRetry}>{state === 'logout-failed' ? 'Try logout again' : 'Try again'}</Button>
            : <a className="account-link" href={hostedEntry('login', destination)}>{state === 'recovery' ? 'Try again' : 'Log in'}</a>}
          {state === 'recovery' && <a className="account-link" href="/auth/signed-out">Return to PocketLedger</a>}
        </div>
      </>}
    </main>
  </PageShell>
}
