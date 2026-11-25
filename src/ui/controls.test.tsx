import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { newSession, setBankroll, startSpin } from '../game/session'
import { App } from './App'
import { Bankroll } from './Bankroll'
import { OrbSymbol } from './Symbol'
import { createSpinId } from './spinId'

const { current } = vi.hoisted(() => ({ current: { session: null as unknown } }))
vi.mock('../game/useSession', () => ({
  useSession: () => ({ session: current.session, action: vi.fn(), commit: vi.fn() }),
}))
vi.mock('./useRoundAnimation', () => ({
  useRoundAnimation: () => ({ stopped: [], duration: [], landedSymbols: [] }),
}))

it('renders each ordinary face number in the orb and keeps jackpot names', () => {
  for (const value of [8, 40, 1600]) {
    const markup = renderToStaticMarkup(<OrbSymbol orb={{ value, multiplier: value / 8, payoutSen: value * 10 }}/>)
    expect(markup).toContain(`aria-label="Gold orb ${value}"`)
    expect(markup).toContain(`>${value}</text>`)
    expect(markup).not.toContain('BONUS')
  }
  expect(renderToStaticMarkup(<OrbSymbol orb={{ tier: 'mini', payoutSen: 50_000 }}/>)).toContain('MINI RM 500.00')
})

it('shows the reset control beside balance and removes the cabinet total win field', () => {
  const session = setBankroll(newSession(), 100_000, 'initial')
  current.session = session
  const cabinet = renderToStaticMarkup(<App/>)
  expect(cabinet).toMatch(/class="bankroll-reset">Reset bankroll/)
  expect(cabinet).not.toContain('Total win')

  current.session = startSpin(session, () => 0.8, 'spin')
  expect(renderToStaticMarkup(<App/>)).toMatch(/class="bankroll-reset" disabled="">Reset bankroll/)
})

it('shows the reset confirmation amounts and explicit choices before accepting a change', () => {
  const session = { ...setBankroll(newSession(), 100_000, 'initial'), balance: 32_050 }
  const action = vi.fn()
  const dialog = renderToStaticMarkup(<Bankroll session={session} action={action} quickReset/>)
  expect(dialog).toContain('Current bankroll</dt><dd>RM 320.50')
  expect(dialog).toContain('Saved initial bankroll</dt><dd>RM 1,000.00')
  expect(dialog).toContain('Reset amount</dt><dd>RM 1,000.00')
  expect(dialog).toContain('>Reset to initial bankroll</button>')
  expect(dialog).toContain('>Change initial bankroll</button>')
  expect(dialog).toContain('>Cancel</button>')
  expect(action).not.toHaveBeenCalled()
})
it('can identify a paid spin over local HTTP without the secure-context UUID API', () => {
  const id = createSpinId({
    getRandomValues: values => {
      if (values instanceof Uint32Array) values.set([0, 31, 255, 0xffffffff])
      return values
    },
  })
  const funded = setBankroll(newSession(), 100_000, 'initial')
  expect(id).toBe('000000000000001f000000ffffffffff')
  expect(startSpin(funded, () => 0.8, id).round).toMatchObject({ phase: 'SPINNING', spin: { id } })
})
