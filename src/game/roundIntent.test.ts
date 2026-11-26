import { expect, it, vi } from 'vitest'
import { applyRoundIntent, roundIntent, stampGameplayRevision } from './roundIntent'
import { newSession, openBonus, revealRespin, revealSpin, selectBetting, setBankroll, startRespin, startSpin } from './session'
import { parseSession } from './storage'

const funded = () => setBankroll(newSession(), 100_000, 'initial')
const rng = () => 0.99

it('rejects a second tab’s stale Continue after the first tab dismisses the result', () => {
  const collected = revealSpin(startSpin(funded(), rng, 'original', 'line'), 'original')
  const intentA = roundIntent(collected)!
  const intentB = roundIntent(parseSession(JSON.stringify(collected))!)!
  const createId = vi.fn(() => 'next')
  const draw = vi.fn(rng)
  const idle = stampGameplayRevision(collected, applyRoundIntent(collected, intentA, draw, createId))
  const savedIdle = parseSession(JSON.stringify(idle))!
  expect(savedIdle.round.phase).toBe('IDLE')
  expect(applyRoundIntent(savedIdle, intentB, draw, createId)).toBe(savedIdle)
  expect(savedIdle.stats).toMatchObject({ spins: 1, wagered: 8, won: 200 })
  expect(draw).not.toHaveBeenCalled()
  expect(createId).not.toHaveBeenCalled()
  const deliberate = applyRoundIntent(savedIdle, roundIntent(savedIdle)!, draw, createId, 'none')
  expect(deliberate.stats).toMatchObject({ spins: 2, wagered: 16, won: 200 })
})

it('rejects a pinned Respin after the other tab completes that turn', () => {
  const ready = openBonus(revealSpin(startSpin(funded(), rng, 'bonus', 'six'), 'bonus'), 'bonus')
  const intent = roundIntent(ready)!
  const turn = applyRoundIntent(ready, intent, rng, () => 'unused')
  const next = revealRespin(turn, 'bonus', 1)
  const draw = vi.fn(rng)
  expect(next.round).toMatchObject({ phase: 'BONUS_READY', bonus: { turn: 1, remaining: 2 } })
  expect(applyRoundIntent(next, intent, draw, () => 'unused')).toBe(next)
  expect(draw).not.toHaveBeenCalled()
  expect(next.stats).toMatchObject({ spins: 1, wagered: 8 })
})

it('rejects an idle Spin even after the saved wager changes away and back', () => {
  const start = funded()
  const intent = roundIntent(start)!
  const higher = stampGameplayRevision(start, selectBetting(start, { betSize: 2 }))
  const original = stampGameplayRevision(higher, selectBetting(higher, { betSize: 1 }))
  const saved = parseSession(JSON.stringify(original))!
  const id = vi.fn(() => 'stale')
  expect(saved.betting).toEqual(start.betting)
  expect(saved.gameplayRevision).toBe(2)
  expect(applyRoundIntent(saved, intent, rng, id)).toBe(saved)
  expect(id).not.toHaveBeenCalled()
})

it('fast-stops a saved spin once and leaves later spins protected from the stale Stop', () => {
  const rolling = parseSession(JSON.stringify(startSpin(funded(), rng, 'first', 'line')))!
  const stop = roundIntent(rolling)!
  const draw = vi.fn(rng)
  const id = vi.fn(() => 'third')
  const result = applyRoundIntent(rolling, stop, draw, id)
  expect(result).toEqual(revealSpin(rolling, 'first'))
  expect(result.stats).toMatchObject({ spins: 1, wagered: 8, won: 200 })
  expect(applyRoundIntent(result, stop, draw, id)).toBe(result)
  const idle = applyRoundIntent(result, roundIntent(result)!, draw, id)
  const later = startSpin(idle, rng, 'second', 'none')
  expect(applyRoundIntent(later, stop, draw, id)).toBe(later)
  expect(draw).not.toHaveBeenCalled()
  expect(id).not.toHaveBeenCalled()
})

it('fast-stops only the requested respin and preserves the committed orb landing', () => {
  const ready = openBonus(revealSpin(startSpin(funded(), rng, 'bonus', 'sixThenHit'), 'bonus'), 'bonus')
  const rolling = parseSession(JSON.stringify(startRespin(ready, rng)))!
  const stop = roundIntent(rolling)!
  const draw = vi.fn(rng)
  const next = applyRoundIntent(rolling, stop, draw, () => 'unused')
  expect(next).toEqual(revealRespin(rolling, 'bonus', 1))
  expect(next.round).toMatchObject({ phase: 'BONUS_READY', bonus: { turn: 1, remaining: 3 } })
  const later = startRespin(next, rng)
  expect(applyRoundIntent(later, stop, draw, () => 'unused')).toBe(later)
  expect(draw).not.toHaveBeenCalled()
})
