import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Button, Description, FieldError, Form, Input, Label, TextField } from '@heroui/react'
import type { RegistrationError } from './registration-api'
import { passwordPolicy, registerAccount } from './registration-api'

export default function RegistrationPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<RegistrationError | null>(null)
  const fieldErrors = error?.field ? { [error.field]: error.message } : {}

  function clearEditedFieldError(field: 'email' | 'password') {
    setError((current) => current?.field && current.field !== field ? current : null)
  }
  // Tokens stay in memory; a future authenticated screen can consume this session.
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const submitting = useRef(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current) return
    submitting.current = true
    setPending(true)
    setError(null)
    try {
      const result = await registerAccount({ email, password })
      if (result.success) {
        setPassword('')
        setAccessToken(result.accessToken)
        document.title = 'Account created · PocketLedger'
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
      <header className="brand"><span className="brand-mark" aria-hidden="true">p<span>•</span></span>PocketLedger</header>
      <main className="registration-layout">
        <section className="intro" aria-labelledby="intro-heading">
          <span className="eyebrow">A LITTLE CLARITY, EVERY DAY</span>
          <h1 id="intro-heading">More life.<br />Less money<br /> <span>on your mind.</span></h1>
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
              <p>Your everyday budget starts here. Budget screens are coming next.</p>
            </div>
          ) : (
            <>
              <span className="eyebrow">WELCOME TO POCKETLEDGER</span>
              <h2 id="form-heading">Make room for clarity.</h2>
              <p className="form-intro">Create your account to get started.</p>
              <Form className="registration-form" onSubmit={submit} validationErrors={fieldErrors}>
                <TextField isRequired name="email" type="email" value={email} onChange={(value) => { setEmail(value); clearEditedFieldError('email') }} isDisabled={pending}>
                  <Label>Email address</Label>
                  <Input autoComplete="email" placeholder="you@example.com" className="registration-input" />
                  <FieldError />
                </TextField>
                <TextField isRequired name="password" type={showPassword ? 'text' : 'password'} value={password} onChange={(value) => { setPassword(value); clearEditedFieldError('password') }}
                  minLength={passwordPolicy.minimumLength} maxLength={passwordPolicy.maximumLength} isDisabled={pending}
                  validate={(value) => {
                    if (value.trim().length === 0) return 'Enter a password.'
                    if (value.length < passwordPolicy.minimumLength || value.length > passwordPolicy.maximumLength) {
                      return `Use ${passwordPolicy.minimumLength}–${passwordPolicy.maximumLength} characters.`
                    }
                    return null
                  }}>
                  <Label>Password</Label>
                  <div className="password-input">
                    <Input autoComplete="new-password" placeholder="Create a password" className="registration-input" />
                    <Button type="button" variant="ghost" size="sm" className="password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} isDisabled={pending} onPress={() => setShowPassword(!showPassword)}>
                      {showPassword ? 'Hide' : 'Show'}
                    </Button>
                  </div>
                  <Description>Use {passwordPolicy.minimumLength}–{passwordPolicy.maximumLength} characters. A few words work well.</Description>
                  <FieldError />
                </TextField>
                {error ? <p className="form-error" role="alert">{error.message}</p> : null}
                <Button type="submit" className="register-button" isPending={pending} isDisabled={pending}>
                  {pending ? 'Creating your account…' : 'Create account'}<span aria-hidden="true">↗</span>
                </Button>
              </Form>
              <p className="form-footnote">A simple start. Just your email and a password.</p>
            </>
          )}
        </section>
      </main>
      <footer className="page-footer"><span>Your everyday budget, one day at a time.</span><span>Made for a little more peace of mind.</span></footer>
    </div>
  )
}
