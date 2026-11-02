import { useRef, useState } from 'react'
import Brand from '../../Brand'
import type { FormEvent } from 'react'
import { Button, Description, FieldError, Form, Input, Label, TextField } from '@heroui/react'
import type { AuthError, AuthMode } from './auth-api'
import { passwordPolicy, authenticate } from './auth-api'

type AccountPageProps = {
  mode: AuthMode
  onAuthenticated: (accessToken: string) => void
  notice?: string
}

export default function AccountPage({ mode, onAuthenticated, notice }: AccountPageProps) {
  const registering = mode === 'register'
  const IntroTitle = registering ? 'h1' : 'div'
  const FormHeading = registering ? 'h2' : 'h1'
  const submitLabel = registering ? 'Create account' : 'Log in'
  const pendingLabel = registering ? 'Creating your account…' : 'Logging in…'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<AuthError | null>(null)
  const fieldErrors = error?.field ? { [error.field]: error.message } : {}

  function clearEditedFieldError(field: 'email' | 'password') {
    setError((current) => current?.field && current.field !== field ? current : null)
  }
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const submitting = useRef(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current) return
    submitting.current = true
    setPending(true)
    setError(null)
    try {
      const result = await authenticate(mode, { email, password })
      if (result.success) {
        setPassword('')
        if (registering) {
          setAccessToken(result.accessToken)
          document.title = 'Account created · PocketLedger'
        } else {
          onAuthenticated(result.accessToken)
        }
      } else {
        setError(result)
      }
    } finally {
      submitting.current = false
      setPending(false)
    }
  }

  return (
    <div className="registration-shell">
      <header><Brand /></header>
      <main className={registering ? "registration-layout" : "registration-layout login-layout"}>
        <section className="intro" aria-labelledby="intro-heading">
          <span className="eyebrow">A LITTLE CLARITY, EVERY DAY</span>
          <IntroTitle id="intro-heading" className="intro-title">More life.<br />Less money<br /> <span>on your mind.</span></IntroTitle>
          <p>A calmer place for your everyday spending.<br className="desktop-break" /> Start with a little clarity. Build from there.</p>
          <div className="intro-rule" />
          <p className="intro-note"><span aria-hidden="true">↗</span> Small steps. A clearer picture.</p>
        </section>
        <section className="registration-card" aria-labelledby="form-heading">
          {accessToken ? (
            <div className="success-content" role="status" tabIndex={-1} ref={(element) => element?.focus()}>
              <span className="success-mark" aria-hidden="true">✓</span>
              <span className="eyebrow">A FRESH START</span>
              <h2 id="form-heading">You’re all set.</h2>
              <p>Your account has been created for <strong>{email.trim()}</strong>.</p>
              <Button className="register-button" onPress={() => onAuthenticated(accessToken)}>View today’s spending <span aria-hidden="true">→</span></Button>
            </div>
          ) : (
            <>
              <span className="eyebrow">{registering ? 'WELCOME TO POCKETLEDGER' : 'YOUR ACCOUNT'}</span>
              <FormHeading id="form-heading">{registering ? 'Make room for clarity.' : 'Log in'}</FormHeading>
              <p className="form-intro">{registering ? 'Create your account to get started.' : 'See what you’ve spent today.'}</p>
              {notice && <p className="form-error" role="status">{notice}</p>}
              <Form className="registration-form" onSubmit={submit} validationErrors={fieldErrors}>
                <TextField isRequired name="email" type={registering ? 'email' : 'text'} value={email} onChange={(value) => { setEmail(value); clearEditedFieldError('email') }} isDisabled={pending}>
                  <Label>Email address</Label>
                  <Input inputMode="email" autoCapitalize="none" spellCheck={false} autoComplete={registering ? 'email' : 'username'} placeholder="you@example.com" className="registration-input" />
                  <FieldError />
                </TextField>
                <TextField isRequired name="password" type={showPassword ? 'text' : 'password'} value={password} onChange={(value) => { setPassword(value); clearEditedFieldError('password') }}
                  minLength={registering ? passwordPolicy.minimumLength : undefined} maxLength={passwordPolicy.maximumLength} isDisabled={pending}
                  validate={(value) => {
                    if (value.trim().length === 0) return 'Enter a password.'
                    if (registering && (value.length < passwordPolicy.minimumLength || value.length > passwordPolicy.maximumLength)) {
                      return `Use ${passwordPolicy.minimumLength}–${passwordPolicy.maximumLength} characters.`
                    }
                    return null
                  }}>
                  <Label>Password</Label>
                  <div className="password-input">
                    <Input autoComplete={registering ? 'new-password' : 'current-password'} placeholder={registering ? 'Create a password' : 'Enter your password'} className="registration-input" />
                    <Button type="button" variant="ghost" size="sm" className="password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} isDisabled={pending} onPress={() => setShowPassword(!showPassword)}>
                      {showPassword ? 'Hide' : 'Show'}
                    </Button>
                  </div>
                  {registering && <Description>Use {passwordPolicy.minimumLength}–{passwordPolicy.maximumLength} characters. A few words work well.</Description>}
                  <FieldError />
                </TextField>
                {error ? <p className="form-error" role="alert">{error.message}</p> : null}
                <Button type="submit" className="register-button" isPending={pending} isDisabled={pending}>
                  {pending ? pendingLabel : submitLabel}<span aria-hidden="true">↗</span>
                </Button>
              </Form>
              <p className="form-footnote">{registering ? 'Already have an account? ' : 'New to PocketLedger? '}
                <a className="account-link" href={registering ? '/login' : '/register'}>{registering ? 'Log in' : 'Create an account'}</a></p>
            </>
          )}
        </section>
      </main>
      <footer className="page-footer"><span>Your everyday budget, one day at a time.</span><span>Made for a little more peace of mind.</span></footer>
    </div>
  )
}
