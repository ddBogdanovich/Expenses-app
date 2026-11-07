const toggle = document.querySelector('[data-password-toggle]')
if (toggle) toggle.addEventListener('click', () => {
  const input = document.getElementById('password')
  const reveal = input.type === 'password'
  input.type = reveal ? 'text' : 'password'
  toggle.textContent = reveal ? 'Hide' : 'Show'
  toggle.setAttribute('aria-label', reveal ? 'Hide password' : 'Show password')
  toggle.setAttribute('aria-pressed', String(reveal))
})
for (const form of document.querySelectorAll('form')) {
  let submitted = false
  const button = form.querySelector('[data-pending-label]')
  const originalContent = button?.innerHTML
  form.addEventListener('submit', event => {
    if (submitted) { event.preventDefault(); return }
    submitted = true
    form.setAttribute('aria-busy', 'true')
    if (button) { button.textContent = button.dataset.pendingLabel; button.disabled = true }
    // Readonly inputs retain native POST values; disabled inputs would omit credentials.
    for (const input of form.querySelectorAll('input:not([type="hidden"])')) input.readOnly = true
    for (const toggle of form.querySelectorAll('[data-password-toggle]')) toggle.disabled = true
  })
  window.addEventListener('pageshow', event => {
    if (!event.persisted) return
    submitted = false
    form.removeAttribute('aria-busy')
    if (button) { button.innerHTML = originalContent; button.disabled = false }
    for (const input of form.querySelectorAll('input:not([type="hidden"])')) input.readOnly = false
    for (const toggle of form.querySelectorAll('[data-password-toggle]')) toggle.disabled = false
  })
}

for (const input of document.querySelectorAll('input:not([type="hidden"])')) {
  input.addEventListener('input', () => {
    const error = document.getElementById(`input-error-${input.id}`)
    if (error) {
      error.remove()
      const remaining = (input.getAttribute('aria-describedby') ?? '').split(' ').filter(id => id !== error.id).join(' ')
      if (remaining) input.setAttribute('aria-describedby', remaining)
      else input.removeAttribute('aria-describedby')
    }
    input.removeAttribute('aria-invalid')
    const summary = document.querySelector('[data-form-error]')
    if (summary) summary.hidden = true
  })
}

// Announce a server response once, without scrolling a phone away from the form.
const errorTarget = document.querySelector('[data-confirmation], [data-form-error], input[aria-invalid="true"]')
errorTarget?.focus({ preventScroll: true })
