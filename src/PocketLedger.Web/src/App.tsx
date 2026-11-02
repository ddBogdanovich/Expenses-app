import { useCallback, useEffect, useState } from 'react'
import AccountPage from './features/authentication/AccountPage'
import TodayPage from './features/today/TodayPage'

export default function App() {
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const mode = window.location.pathname === '/register' ? 'register' : 'login'

  useEffect(() => {
    if (!accessToken && mode === 'login') window.history.replaceState(null, '', '/login')
    document.title = `${accessToken ? 'Today' : mode === 'register' ? 'Create your account' : 'Log in'} · PocketLedger`
  }, [accessToken, mode])

  const endSession = useCallback((message = '') => {
    window.history.replaceState(null, '', '/login')
    setNotice(message)
    setAccessToken(null)
  }, [])

  function startSession(token: string) {
    window.history.replaceState(null, '', '/')
    setAccessToken(token)
    setNotice('')
  }

  return accessToken
    ? <TodayPage token={accessToken} onEndSession={endSession} />
    : <AccountPage mode={mode} onAuthenticated={startSession} notice={notice} />
}
