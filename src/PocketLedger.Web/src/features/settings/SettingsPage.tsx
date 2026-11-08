import { useEffect, useRef, useState } from 'react'
import { Button, ComboBox, Description, FieldError, Form, Input, Label, ListBox } from '@heroui/react'
import PageShell from '../../ui/PageShell'
import Notice from '../../ui/Notice'
import { requestTimeoutMs } from '../../request-policy'
import { SettingsMemory, type SettingsFeedback } from './settings-memory'
import { loadSettings, saveSettings, SettingsFailure, type Preferences } from './settings-api'

type Props = { onBack: () => void; onEndSession: (message?: string) => void; memory?: SettingsMemory }

export default function SettingsPage({ onBack, onEndSession, memory: externalMemory }: Props) {
  const [memory] = useState(() => externalMemory ?? new SettingsMemory())
  const [initial] = useState(() => memory.read())
  const [saved, setSaved] = useState<Preferences | null>(initial?.saved ?? null)
  const [zones, setZones] = useState<string[]>([])
  const [selected, setSelected] = useState<string | null>(initial?.selected ?? null)
  const [input, setInput] = useState(initial?.input ?? '')
  const [attempt, setAttempt] = useState(0)
  const [loading, setLoading] = useState(true)
  const [catalogueReady, setCatalogueReady] = useState(false)
  const discardDraft = useRef(false)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<SettingsFeedback>(initial?.pending ? 'uncertain' : initial?.message ?? null)
  const [invalid, setInvalid] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const feedback = useRef<HTMLDivElement>(null)
  const lifetime = useRef<AbortController | null>(null)
  const saving = useRef(false)
  const zoneInput = useRef<HTMLInputElement>(null)
  useEffect(() => { heading.current?.focus({ preventScroll: true }) }, [])
  useEffect(() => {
    if (saved) memory.write({ saved, selected, input, pending, message })
  }, [saved, selected, input, pending, message, memory])
  useEffect(() => {
    const controller = new AbortController()
    lifetime.current = controller
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(requestTimeoutMs)])
    void loadSettings(signal).then(({ saved, zones }) => {
      if (controller.signal.aborted) return
      setZones(zones)
      setCatalogueReady(true)
      if (!initial || discardDraft.current) {
        setSaved(saved); setSelected(zones.includes(saved.timeZone) ? saved.timeZone : null); setInput(saved.timeZone)
      }
      setLoading(false)
    }).catch(error => {
      if (controller.signal.aborted) return
      if (error instanceof SettingsFailure && error.reason === 'unauthorized') onEndSession('Your session has ended. Log in again to open Settings.')
      else { setLoading(false); setMessage('error') }
    })
    return () => { controller.abort() }
  }, [attempt, onEndSession, initial])
  useEffect(() => { if (message) feedback.current?.focus({ preventScroll: true }) }, [message])

  function reload() { memory.clear(); discardDraft.current = true; setCatalogueReady(false); setLoading(true); setSaved(null); setMessage(null); setInvalid(false); setAttempt(value => value + 1) }
  function retryLoad() { setLoading(true); setMessage(null); setAttempt(value => value + 1) }
  async function save() {
    if (saving.current || !saved) return
    if (!selected || !zones.includes(selected) || input !== selected) { setInvalid(true); zoneInput.current?.focus(); return }
    saving.current = true; setPending(true); setMessage(null)
    const controller = lifetime.current!
    try {
      const result = await saveSettings(selected, saved.revision,
        AbortSignal.any([controller.signal, AbortSignal.timeout(requestTimeoutMs)]))
      if (!controller.signal.aborted) { setSaved(result); setMessage('success') }
    } catch (error) {
      if (controller.signal.aborted) return
      if (error instanceof SettingsFailure && error.reason === 'unauthorized') onEndSession('Your session has ended. Log in again to save Settings.')
      else setMessage(error instanceof SettingsFailure && error.reason === 'conflict' ? 'conflict' : 'error')
    } finally {
      saving.current = false
      if (!controller.signal.aborted) setPending(false)
    }
  }

  return <PageShell headerAction={<nav className="header-actions" aria-label="Account">
    <Button variant="ghost" isDisabled={pending} onPress={onBack}>Back to today</Button>
    <Button variant="outline" onPress={() => onEndSession()}>Log out</Button>
  </nav>}>
    <main id="main-content" className="today-main settings-main" tabIndex={-1}>
      <span className="eyebrow">YOUR PREFERENCES</span>
      <h1 className="page-title" tabIndex={-1} ref={heading}>Settings</h1>
      <p className="daily-note">Choose the time zone used for today’s spending. Your recorded purchase dates stay the same.</p>
      <section className="surface-card settings-card" aria-label="Financial settings" aria-busy={loading || pending}>
        {loading ? <p role="status">Loading settings…</p> : saved && catalogueReady ? <Form className="ledger-form" onSubmit={event => { event.preventDefault(); void save() }}>
          <p>Currency: <strong>PLN · Polish złoty</strong></p>
          <ComboBox allowsCustomValue selectedKey={selected} inputValue={input} isRequired isDisabled={pending}
            isInvalid={invalid} onInputChange={value => { if (value !== input) { setInput(value); setInvalid(false); setMessage(null) } }}
            onSelectionChange={key => { const zone = key == null ? null : String(key); setSelected(zone); if (zone) { setInput(zone); setInvalid(false); setMessage(null) } }}>
            <Label>Time zone</Label>
            <ComboBox.InputGroup><Input ref={zoneInput} className="ledger-input" placeholder="Search regional time zones" /><ComboBox.Trigger /></ComboBox.InputGroup>
            <Description>Search by region or city, for example Europe/Warsaw.{selected && <span className="zone-selection">Selected: {selected}</span>}</Description>
            <FieldError>Choose a time zone from the list.</FieldError>
            <ComboBox.Popover className="settings-zones"><ListBox>
              {zones.map(zone => <ListBox.Item key={zone} id={zone} textValue={zone}>{zone}<ListBox.ItemIndicator /></ListBox.Item>)}
            </ListBox></ComboBox.Popover>
          </ComboBox>
          {!zones.includes(saved.timeZone) && <Notice tone="danger">Your saved time zone is unavailable. Choose a supported time zone to continue.</Notice>}
          <Button className="primary-action" type="submit" isDisabled={pending || message === 'conflict'}>{pending ? 'Saving settings…' : 'Save settings'}</Button>
          <Button variant="secondary" isDisabled={pending} onPress={onBack}>Cancel</Button>
        </Form> : null}
        <div ref={feedback} tabIndex={-1}>
          {message === 'uncertain' && <Notice tone="info">A save was interrupted. Reload settings to check the saved value, or retry your choice.</Notice>}
          {message === 'success' && <Notice tone="success">Settings saved.</Notice>}
          {message === 'error' && <Notice tone="danger">{catalogueReady ? 'We couldn’t confirm your settings were saved. Your choice is still here. Try saving again; if settings changed, reload and review.' : 'We couldn’t load your settings. Try again.'}</Notice>}
          {message === 'conflict' && <Notice tone="danger">Settings changed in another session. Reload settings, review your choice, and save again.</Notice>}
        </div>
        {!loading && (!catalogueReady || message === 'conflict' || message === 'uncertain') && <Button variant="secondary" onPress={catalogueReady ? reload : retryLoad}>{catalogueReady ? 'Reload settings' : 'Try again'}</Button>}
      </section>
    </main>
  </PageShell>
}
