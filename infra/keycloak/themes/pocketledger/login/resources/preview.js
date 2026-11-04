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
  form.addEventListener('submit', event => {
    if (submitted) { event.preventDefault(); return }
    submitted = true
    form.setAttribute('aria-busy', 'true')
    const button = form.querySelector('[data-pending-label]')
    if (button) { button.textContent = button.dataset.pendingLabel; button.disabled = true }
  })
}
