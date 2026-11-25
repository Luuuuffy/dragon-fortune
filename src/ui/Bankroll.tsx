import { useState } from 'react'
import type { FormEvent } from 'react'
import { MAX_INITIAL_BANKROLL, START_BALANCE, money, parseBankroll } from '../game/config'
import { setBankroll } from '../game/session'
import type { Session } from '../game/session'
import { Modal } from './Panels'

export function Bankroll({ session, action, close, onSaved, quickReset = false }: {
  session: Session
  action: (update: (session: Session) => Session) => Promise<boolean>
  close?: () => void
  onSaved?: () => void
  quickReset?: boolean
}) {
  const initial = session.initialBankroll === null
  const [input, setInput] = useState(money(session.initialBankroll ?? START_BALANCE).slice(3))
  const [error, setError] = useState('')
  const [confirmation, setConfirmation] = useState<number | null>(null)
  const [editing, setEditing] = useState(!quickReset)
  const [saving, setSaving] = useState(false)
  const busy = session.round.phase !== 'IDLE'

  async function apply(amount: number) {
    setSaving(true)
    try {
      if (await action(previous => setBankroll(previous, amount, initial ? 'initial' : 'reset'))) onSaved?.()
      else setError('The bankroll could not be updated. Finish the active round and try again.')
    } finally {
      setSaving(false)
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || saving) return
    const amount = parseBankroll(input)
    if (amount === null) {
      setError(`Enter an amount from RM 0.00 to ${money(MAX_INITIAL_BANKROLL)} with up to two decimal places.`)
      return
    }
    setError('')
    if (initial) void apply(amount)
    else setConfirmation(amount)
  }

  const choosingReset = quickReset && !editing
  const resetAmount = choosingReset ? session.initialBankroll : confirmation
  return <Modal title={initial ? 'Set initial bankroll' : quickReset ? 'Reset bankroll' : 'Set bankroll'} close={close}>
    {!initial && <dl className="stats-list">
      <div><dt>Current bankroll</dt><dd>{money(session.balance)}</dd></div>
      <div><dt>{quickReset ? 'Saved initial bankroll' : 'Initial bankroll'}</dt><dd>{money(session.initialBankroll!)}</dd></div>
      {resetAmount !== null && <div><dt>Reset amount</dt><dd>{money(resetAmount)}</dd></div>}
    </dl>}
    {choosingReset ? <>
      <p>Resetting the bankroll starts a new session and clears session statistics.</p>
      <div className="modal-actions">
        <button disabled={saving} onClick={close}>Cancel</button>
        <button disabled={busy || saving} onClick={() => { setEditing(true); setError('') }}>Change initial bankroll</button>
        <button className="danger" disabled={busy || saving}
          onClick={() => { if (resetAmount !== null) void apply(resetAmount) }}>Reset to initial bankroll</button>
      </div>
    </> : confirmation === null ? <form className="bankroll-form" onSubmit={submit}>
      <label htmlFor="bankroll-amount">{initial ? 'Initial bankroll (MYR)' : 'New initial bankroll (MYR)'}</label>
      <div className="bankroll-input">
        <span aria-hidden="true">RM</span>
        <input id="bankroll-amount" inputMode="decimal" autoComplete="off" value={input} disabled={busy || saving}
          aria-invalid={Boolean(error)} aria-describedby={error ? 'bankroll-error' : undefined}
          onChange={event => { setInput(event.target.value); setError('') }}/>
      </div>
      <div className="modal-actions">
        {quickReset && <button type="button" onClick={() => { setEditing(false); setError('') }}>Back</button>}
        <button type="submit" disabled={busy || saving}>{initial ? 'Start game' : quickReset ? 'Review reset' : 'Reset bankroll'}</button>
      </div>
    </form> : <>
      <p>Replace your current virtual balance with {money(confirmation)} and clear session statistics and the last result?</p>
      <div className="modal-actions">
        <button disabled={saving} onClick={() => { setConfirmation(null); setError('') }}>Cancel</button>
        <button className="danger" disabled={busy || saving} onClick={() => void apply(confirmation)}>Confirm reset</button>
      </div>
    </>}
    {busy && <p role="status">Finish the active round before resetting the bankroll.</p>}
    {error && <p id="bankroll-error" role="alert">{error}</p>}
  </Modal>
}
