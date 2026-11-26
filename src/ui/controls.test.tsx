import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { completeHoldCollection, newSession, openBonus, revealRespin, revealSpin, setBankroll, startRespin, startSpin } from '../game/session'
import { calculateOrbPrize } from '../game/orbPrizes'
import { App } from './App'
import { Bankroll } from './Bankroll'
import { OrbSymbol } from './Symbol'
import { dragonPath, dragonPoint, holdCollectionPrizes } from './HoldCollection'
import { createSpinId } from './spinId'

const { current } = vi.hoisted(() => ({ current: { session: null as unknown } }))
vi.mock('../game/useSession', () => ({
  useSession: () => ({ session: current.session, action: vi.fn(), commit: vi.fn() }),
}))
vi.mock('./useRoundAnimation', () => ({
  useRoundAnimation: () => ({ stopped: [], duration: [], landedSymbols: [], stoppedCells: [] }),
}))

it('renders each ordinary face number in the orb and keeps jackpot names', () => {
  for (const [orb, face] of [[calculateOrbPrize(1, 100, 1), '100'], [calculateOrbPrize(50, 800, 100), '1,600'],
    [calculateOrbPrize(100, 800, 1), 'RM8'], [calculateOrbPrize(200, 1600, 1), 'RM16']] as const) {
    const markup = renderToStaticMarkup(<OrbSymbol orb={orb}/>)
    expect(markup).toContain(`aria-label="Gold orb ${face}"`)
    expect(markup).toContain(`>${face}</text>`)
    expect(markup).not.toContain('BONUS')
  }
  expect(renderToStaticMarkup(<OrbSymbol orb={{ tier: 'mini', payoutSen: 50_000 }}/>)).toContain('MINI RM 500.00')
})

it('shows the reset control beside balance and removes the cabinet total win field', () => {
  const session = setBankroll(newSession(), 100_000, 'initial')
  current.session = session
  const cabinet = renderToStaticMarkup(<App/>)
  expect(cabinet).toMatch(/class="bankroll-reset">Reset bankroll/)
  expect(cabinet).toContain('<small>100,000 credits</small>')
  expect(cabinet).toContain('<small>8 credits</small>')
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

it('spins only empty cells and derives one flight per stored orb, with GRAND last', () => {
  const rng = () => 0.99
  const funded = setBankroll(newSession(), 100_000, 'initial')
  const ready = openBonus(revealSpin(startSpin(funded, rng, 'grand', 'grand'), 'grand'), 'grand')
  const turn = startRespin(ready, rng)
  current.session = turn
  const rendered = renderToStaticMarkup(<App/>)
  expect(rendered.match(/class="cell-mini-reel"/g)).toHaveLength(1)
  expect(rendered.match(/data-orb-position=/g)).toHaveLength(14)

  const settled = revealRespin(turn, 'grand', 1)
  if (settled.round.phase !== 'JACKPOT_CELEBRATION' || !settled.round.orbs) throw new Error('Expected GRAND')
  const prizes = holdCollectionPrizes(settled.round.orbs, settled.round.result)
  expect(prizes.slice(0, 5).map(prize => prize.position)).toEqual([0, 3, 6, 9, 12])
  expect(new Set(prizes.map(prize => prize.position)).size).toBe(16)
  expect(prizes.at(-1)).toEqual({ tier: 'grand', position: null, amount: 20_000_000 })
  expect(prizes.reduce((sum, prize) => sum + prize.amount, 0)).toBe(settled.round.result.total)
  current.session = settled
  expect(renderToStaticMarkup(<App/>)).toContain('BONUS WIN <strong>RM 0.00</strong>')
  current.session = completeHoldCollection(settled, settled.round.result.bonusId!)
  const collected = renderToStaticMarkup(<App/>)
  expect(collected).toMatch(/<button type="button" class="spin-button">.*?<\/svg>Continue<\/button>/)
  expect(collected.match(/Continue<\/button>/g)).toHaveLength(1)
  expect(collected).not.toContain('>Skip</button>')
})

it('anchors the curved dragon path to both measured points after a resize', () => {
  for (const [start, counter] of [[{ x: 530, y: 320 }, { x: 670, y: 15 }], [{ x: 270, y: 190 }, { x: 245, y: 28 }]]) {
    const path = dragonPath(start, counter)
    expect(dragonPoint(path, 0)).toEqual(start)
    expect(dragonPoint(path, 1)).toEqual(counter)
    expect(dragonPoint(path, .5).y).toBeLessThan((start.y + counter.y) / 2)
  }
})
