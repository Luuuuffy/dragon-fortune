import { describe, expect, it } from 'vitest'
import { BONUS_REBALANCE_VERSION, CELLS, CURRENT_MATH_VERSION, DESIGN_B_VERSION, EARLY_RESPIN_VERSION, LATE_RESPIN_VERSION,
  ORB_VARIETY_VERSION, calculateJackpots, cellAt,
  legacyJackpots, parseBankroll, START_BALANCE, totalBetSen } from './config'
import { calculateOrbPrize } from './orbPrizes'
import type { Scenario } from './engine'
import { completeHoldCollection, dismissResult, lastWinSen, newSession, openBonus, resetGame, resetStats, revealRespin, revealSpin,
  selectBetting, selectDenomination, setBankroll, startRespin, startSpin } from './session'
import type { Session } from './session'
import { parseSession } from './storage'

const rng = () => 0.99
const funded = () => setBankroll(newSession(), START_BALANCE, 'initial')
const begin = (scenario: Scenario, session = funded()) => startSpin(session, rng, 'test', scenario)
const reload = (state: Session) => {
  const restored = parseSession(JSON.stringify(state))
  expect(restored).toEqual(state)
  return restored!
}

describe('round transitions and persistence', () => {
  it('resets Bet Size to one on a denomination change while preserving active lines', () => {
    const selected = selectBetting(funded(), { betSize: 5, lines: 38 })
    expect(selectDenomination(selected, 1)).toBe(selected)
    const changed = reload(selectDenomination(selected, 10))
    expect(changed.betting).toEqual({ denominationSen: 10, betSize: 1, lines: 38 })
    expect(changed.stats).toEqual(selected.stats)
    expect(changed.balance).toBe(selected.balance)
    expect(changed.boardOrbs.find(Boolean)).toMatchObject({ value: 38, payoutSen: 380 })
    const spinning = begin('none', changed)
    expect(selectDenomination(spinning, 50)).toBe(spinning)
  })

  it('deducts a wager and settles a line win only once across reloads and duplicate callbacks', () => {
    const selected = selectBetting(funded(), { denominationSen: 20, betSize: 3, lines: 8 })
    const active = reload(begin('line', selected))
    expect(active.balance).toBe(START_BALANCE - 480)
    expect(active.stats).toMatchObject({ spins: 1, wagered: 480, won: 0 })
    expect(startSpin(active, rng, 'another')).toBe(active)
    expect(selectBetting(active, { denominationSen: 50, betSize: 10, lines: 18 })).toBe(active)
    expect(setBankroll(active, 999, 'reset')).toBe(active)
    expect(revealSpin(active, 'stale')).toBe(active)
    const settled = reload(revealSpin(active, 'test'))
    expect(settled.last).toMatchObject({ spinId: 'test', bonusId: null, total: 12_000 })
    expect(settled.balance).toBe(START_BALANCE - 480 + 12_000)
    expect(revealSpin(settled, 'test')).toBe(settled)
    expect(dismissResult(settled, 'stale')).toBe(settled)
    const idle = dismissResult(settled, 'test')
    expect(idle.round.phase).toBe('IDLE')
    expect(startSpin(idle, rng, 'test')).toBe(idle)
    expect(reload(selectBetting(idle, { lines: 18 })).betting).toEqual({ denominationSen: 20, betSize: 3, lines: 18 })
  })

  it('retains the original paytable on a spin saved before the symbol update', () => {
    const active = begin('none')
    if (active.round.phase !== 'SPINNING') throw new Error('Expected a pending spin')
    const { paytableVersion, ...previous } = active.round.spin
    expect(paytableVersion).toBe(CURRENT_MATH_VERSION)
    const board = previous.board.map((symbol, position) => position % 3 === 1 ? 'J' as const : symbol)
    const original = reload({ ...active, round: { ...active.round, spin: { ...previous, board } } })
    expect(revealSpin(original, 'test').last?.line).toBe(35)
    const previousV2 = reload({ ...active, round: { ...active.round, spin: { ...previous, paytableVersion: 2, board } } })
    expect(revealSpin(previousV2, 'test').last?.line).toBe(22)
    const previousV3 = reload({ ...active, round: { ...active.round, spin: { ...previous, paytableVersion: 3, board } } })
    expect(revealSpin(previousV3, 'test').last?.line).toBe(100)
    const updated = reload({ ...active, round: { ...active.round, spin: { ...active.round.spin, board } } })
    expect(revealSpin(updated, 'test').last?.line).toBe(55)
  })

  it.each([
    [DESIGN_B_VERSION, 6, 0.10, 0], [ORB_VARIETY_VERSION, 6, 0.10, 0],
    [EARLY_RESPIN_VERSION, 6, 0.10, 1], [EARLY_RESPIN_VERSION, 10, 0.015, 0],
    [LATE_RESPIN_VERSION, 10, 0.0215, 0], [CURRENT_MATH_VERSION, 10, 0.0215, 1],
  ] as const)(
    'keeps profile %i respin odds after reloading with %i held', (paytableVersion, held, landingRoll, landed) => {
      const active = begin('six')
      if (active.round.phase !== 'SPINNING') throw new Error('Expected a pending spin')
      const spin = { ...active.round.spin, scenario: undefined, paytableVersion }
      const pending = reload({ ...active, round: { ...active.round, spin } })
      const opened = reload(openBonus(revealSpin(pending, 'test'), 'test'))
      const firstDraws = Array.from({ length: held - 6 }, () => [0, 0.99, 0.99]).flat()
      const ready = held === 6 ? opened :
        reload(revealRespin(startRespin(opened, () => firstDraws.shift() ?? 0.99), 'test', 1))
      const draws: number[] = [landingRoll, 0.99, 0.99]
      const respinning = reload(startRespin(ready, () => draws.shift() ?? 0.99))
      if (respinning.round.phase !== 'BONUS_RESPIN') throw new Error('Expected a pending respin')
      expect(respinning.round.bonus.next?.orbs.filter(Boolean)).toHaveLength(held + landed)
      expect(respinning.round.bonus.next?.remaining).toBe(landed ? 3 : 2)
    },
  )

  it('persists the two-Tiger credit award and pays it once at a higher bet size', () => {
    const betting = { denominationSen: 100, betSize: 3, lines: 8 }
    const active = begin('none', selectBetting(funded(), betting))
    if (active.round.phase !== 'SPINNING') throw new Error('Expected a pending spin')
    active.round.spin.board[cellAt(0, 1)] = 'tiger'
    active.round.spin.board[cellAt(1, 1)] = 'wild'
    const settled = reload(revealSpin(reload(active), 'test'))
    expect(settled.last).toMatchObject({ line: 900, total: 900, lines: [{ symbol: 'tiger', positions: [1, 4] }] })
    expect(settled.balance).toBe(START_BALANCE - totalBetSen(betting) + 900)
    expect(revealSpin(settled, 'test')).toBe(settled)
  })

  it('continues a committed profile 3 bonus with its old orb odds', () => {
    const active = begin('six', selectBetting(funded(), { denominationSen: 20, betSize: 3, lines: 38 }))
    if (active.round.phase !== 'SPINNING') throw new Error('Expected a pending spin')
    const spin = { ...active.round.spin, scenario: undefined, paytableVersion: 3 as const }
    const pending = reload({ ...active, round: { ...active.round, spin } })
    const ready = reload(openBonus(revealSpin(pending, 'test'), 'test'))
    if (ready.round.phase !== 'BONUS_READY') throw new Error('Expected a ready bonus')
    const draws = [0, 0.9985]
    const respinning = reload(startRespin(ready, () => draws.shift() ?? 0.99))
    if (respinning.round.phase !== 'BONUS_RESPIN') throw new Error('Expected a pending respin')
    expect(respinning.round.bonus.next?.orbs[1]).toEqual({ tier: 'mini', payoutSen: 100_000 })
    expect(respinning.round.bonus.next?.orbs[0]).toEqual(ready.round.bonus.orbs[0])
    expect(respinning.balance).toEqual(ready.balance)
  })

  it.each([[BONUS_REBALANCE_VERSION, true], [CURRENT_MATH_VERSION, false]] as const)(
    'keeps profile %i jackpot odds for respins after a reload', (paytableVersion, mini) => {
      const active = begin('six')
      if (active.round.phase !== 'SPINNING') throw new Error('Expected a pending spin')
      const spin = { ...active.round.spin, scenario: undefined, paytableVersion }
      const pending = reload({ ...active, round: { ...active.round, spin } })
      const ready = reload(openBonus(revealSpin(pending, 'test'), 'test'))
      const draws = [0, 0.999, 0]
      const respinning = reload(startRespin(ready, () => draws.shift() ?? 0.99))
      if (respinning.round.phase !== 'BONUS_RESPIN') throw new Error('Expected a pending respin')
      const orb = respinning.round.bonus.next?.orbs[1]
      if (mini) expect(orb).toEqual({ tier: 'mini', payoutSen: 5000 })
      else expect(orb).toEqual(calculateOrbPrize(1, 8, 1))
    },
  )

  it.each(['six', 'seven', 'mini', 'minor', 'major'] as const)('saves every intermediate %s bonus state', scenario => {
    const revealed = reload(revealSpin(reload(begin(scenario)), 'test'))
    expect(revealed.stats.bonuses).toBe(1)
    expect(openBonus(revealed, 'stale')).toBe(revealed)
    let state = reload(openBonus(revealed, 'test'))
    for (let turn = 1; turn <= 3; turn++) {
      expect(startSpin(state, rng, 'another')).toBe(state)
      expect(selectBetting(state, { denominationSen: 20, betSize: 2, lines: 38 })).toBe(state)
      expect(setBankroll(state, 999, 'reset')).toBe(state)
      expect(resetGame(state)).toBe(state)
      const respinning = reload(startRespin(state, rng))
      expect(startRespin(respinning, rng)).toBe(respinning)
      expect(revealRespin(respinning, 'test', turn - 1)).toBe(respinning)
      state = reload(revealRespin(respinning, 'test', turn))
      expect(revealRespin(state, 'test', turn)).toBe(state)
    }
    expect(state.last?.bonusId).toBe('test:bonus')
    const jackpot = scenario === 'mini' || scenario === 'minor' || scenario === 'major' ? calculateJackpots(1)[scenario] : 0
    expect(state.last?.jackpot).toBe(jackpot)
    expect(state.last?.bonus).toBe(16 * (scenario === 'seven' ? 7 : jackpot ? 5 : 6))
    expect(state.balance).toBe(START_BALANCE - 8 + state.last!.total)
    expect(state.stats).toMatchObject({ won: state.last?.total, biggest: state.last?.total, bonuses: 1 })
  })

  it.each(['grand', 'full'] as const)('awards GRAND once for %s', scenario => {
    let state = openBonus(revealSpin(begin(scenario), 'test'), 'test')
    if (scenario === 'grand') {
      expect('bonus' in state.round && state.round.bonus.orbs.filter(Boolean)).toHaveLength(14)
      state = revealRespin(reload(startRespin(state, rng)), 'test', 1)
    }
    state = reload(state)
    expect(state.round.phase).toBe('JACKPOT_CELEBRATION')
    expect(state.stats.jackpots.grand).toBe(1)
    expect(state.last?.bonus).toBe(15 * 16)
    expect(state.last?.jackpot).toBe(20_000_000)
    expect(setBankroll(state, 999, 'reset')).toBe(state)
    expect(revealRespin(state, 'test', 1)).toBe(state)
    expect(openBonus(state, 'test')).toBe(state)
    expect(dismissResult(state, 'test')).toBe(state)
    expect(completeHoldCollection(state, 'stale')).toBe(state)
    const collected = reload(completeHoldCollection(state, 'test:bonus'))
    expect(completeHoldCollection(collected, 'test:bonus')).toBe(collected)
    expect(collected.balance).toBe(state.balance)
    expect(collected.stats).toEqual(state.stats)
    expect(dismissResult(collected, 'test').round.phase).toBe('IDLE')
  })

  it('replays a seventh orb, resets the counter, and pays seven orbs after three misses', () => {
    const ready = openBonus(revealSpin(begin('sixThenHit'), 'test'), 'test')
    if (ready.round.phase !== 'BONUS_READY') throw new Error('Expected a six-orb bonus')
    const held = ready.round.bonus.orbs
    expect(held.filter(Boolean)).toHaveLength(6)
    const pending = reload(startRespin(ready, rng))
    if (pending.round.phase !== 'BONUS_RESPIN') throw new Error('Expected a pending respin')
    const next = pending.round.bonus.next!
    expect(next).toMatchObject({ landed: 1, remaining: 3, done: false })
    expect(next.orbs.filter(Boolean)).toHaveLength(7)
    held.forEach((orb, position) => { if (orb) expect(next.orbs[position]).toEqual(orb) })
    let state = revealRespin(pending, 'test', 1)
    for (let turn = 2; turn <= 4; turn++) state = revealRespin(startRespin(state, rng), 'test', turn)
    expect(reload(state).last).toMatchObject({ bonus: 7 * 16, jackpot: 0 })
  })

  it('includes any triggering line wins in the same final bonus settlement', () => {
    let draws = 0
    const state = startSpin(funded(), () => draws++ < CELLS || draws % 2 === 1 ? 0.999999 : 0.5, 'test')
    if (state.round.phase !== 'SPINNING') throw new Error('Expected a pending spin')
    // Replace one full row with a paying symbol while retaining ten production orbs.
    state.round.spin.board = state.round.spin.board.map((symbol, i) => i % 3 === 1 ? 'tiger' : symbol)
    state.round.orbs = state.round.orbs!.map((orb, i) => i % 3 === 1 ? null : orb)
    let active = openBonus(revealSpin(reload(state), 'test'), 'test')
    for (let turn = 1; turn <= 3; turn++) active = revealRespin(startRespin(active, rng), 'test', turn)
    expect(active.last).toMatchObject({ line: 200, bonus: 16_000, jackpot: 0, total: 16_200 })
  })

  it('tests forced simultaneous wins, no win, and insufficient funds', () => {
    const multi = revealSpin(begin('multi'), 'test')
    expect(multi.last!.lines.length).toBeGreaterThan(1)
    const none = revealSpin(begin('none'), 'test')
    expect(none.last!.total).toBe(0)
    expect(none.round.phase).toBe('IDLE')
    const poor = { ...funded(), balance: 7 }
    expect(startSpin(poor, rng, 'test')).toBe(poor)
    const normal = funded()
    expect(begin('insufficient', normal)).toBe(normal)
  })

  it('resets stats independently and preserves preferences on a game reset', () => {
    const session = revealSpin(begin('none'), 'test')
    session.settings.muted = true
    expect(resetStats(session).balance).toBe(START_BALANCE - 8)
    expect(resetStats(session).stats.spins).toBe(0)
    expect(resetGame(session)).toMatchObject({ balance: START_BALANCE, last: null, settings: { muted: true } })
  })

  it('rejects corrupt saves and invalid pending data', () => {
    expect(parseSession('broken')).toBeNull()
    expect(parseSession(JSON.stringify({ ...newSession(), balance: -1 }))).toBeNull()
    const active = begin('six')
    if (active.round.phase !== 'SPINNING') throw new Error('Expected a pending spin')
    active.round.orbs[0] = { value: -1, multiplier: 2, payoutSen: 16 }
    expect(parseSession(JSON.stringify(active))).toBeNull()
    active.round.orbs[0] = { value: 16, multiplier: 2, payoutSen: 17 }
    expect(parseSession(JSON.stringify(active))).toBeNull()
  })

  it('requires a first-launch bankroll, accepts zero and preserves a custom amount on reload', () => {
    const fresh = newSession()
    expect(fresh.initialBankroll).toBeNull()
    expect(startSpin(fresh, rng, 'test')).toBe(fresh)
    expect(parseBankroll('1,000.00')).toBe(START_BALANCE)
    expect(reload(setBankroll(fresh, parseBankroll('35.72')!, 'initial')))
      .toMatchObject({ balance: 3572, initialBankroll: 3572 })
    const zero = reload(setBankroll(fresh, 0, 'initial'))
    expect(startSpin(zero, rng, 'test')).toBe(zero)
    expect(setBankroll(zero, 100, 'initial')).toBe(zero)
  })

  it.each(['', '-1', '1.001', 'Infinity', '1e3', 'NaN', '1,00', '1,000,000.01'])('rejects invalid bankroll %s', input => {
    expect(parseBankroll(input)).toBeNull()
  })

  it('resets the session to a confirmed amount and persists betting and audio levels', () => {
    const session = revealSpin(begin('none'), 'test')
    session.settings = { ...session.settings, muted: true, volume: 0.8, musicVolume: 0.28,
      reelVolume: 0.2, orbVolume: 0.4, jackpotVolume: 0.6 }
    const selected = selectBetting(session, { denominationSen: 20, betSize: 3, lines: 38 })
    const reset = reload(setBankroll(selected, 27_525, 'reset'))
    expect(reset).toMatchObject({
      initialBankroll: 27_525, balance: 27_525, last: null, stats: { spins: 0, wagered: 0, won: 0 },
      betting: selected.betting, settings: selected.settings, round: { phase: 'IDLE' },
    })
    expect(resetGame(reset).balance).toBe(27_525)
  })

  it('migrates a legacy pending spin without charging again or changing its payout', () => {
    const state = begin('line')
    if (state.round.phase !== 'SPINNING') throw new Error('Expected a pending spin')
    const { betting: _betting, initialBankroll: _initial, ...old } = state
    const { betting: _wager, jackpotPrizes: _prizes, ...oldSpin } = state.round.spin
    const migrated = parseSession(JSON.stringify({
      ...old, version: 1, bet: 80, lines: 1, balance: START_BALANCE - 80,
      stats: { ...state.stats, wagered: 80 },
      settings: { muted: true, volume: 0.19, speed: 1, reduced: false },
      round: { ...state.round, orbs: null, spin: { ...oldSpin, bet: 80, lines: 1, paytableVersion: 2 } },
    }))!
    expect(migrated).toMatchObject({ version: 5, initialBankroll: START_BALANCE,
      balance: START_BALANCE - 80, settings: { muted: true, musicVolume: 0.35, volume: 0.19, reelVolume: 1 } })
    const paid = revealSpin(reload(migrated), 'test')
    expect(paid.last?.total).toBe(16_000)
    expect(paid.balance).toBe(START_BALANCE - 80 + 16_000)
    expect(revealSpin(paid, 'test')).toBe(paid)
  })

  it('restores already rolled v2 respin prizes at their original MYR value', () => {
    const previous = selectBetting(funded(), { denominationSen: 10, betSize: 5, lines: 18 })
    const active = startRespin(openBonus(revealSpin(begin('grand', previous), 'test'), 'test'), rng)
    if (active.round.phase !== 'BONUS_RESPIN') throw new Error('Expected a pending respin')
    const { bonus } = active.round
    const { jackpotPrizes: _prizes, ...oldSpin } = bonus.spin
    const oldSlots = (orbs: typeof bonus.orbs) => orbs.map(orb => orb ? { multiplier: 2 } : null)
    const migrated = parseSession(JSON.stringify({ ...active, version: 2, boardOrbs: undefined,
      round: { ...active.round, bonus: {
        ...bonus, spin: { ...oldSpin, paytableVersion: 2 }, orbs: oldSlots(bonus.orbs), next: { ...bonus.next, orbs: oldSlots(bonus.next!.orbs) },
      } },
    }))!
    const settled = revealRespin(reload(migrated), 'test', 1)
    expect(settled.last?.bonus).toBe(15 * 2 * 900)
    expect(settled.last?.jackpot).toBe(legacyJackpots(900).grand)
    expect(revealRespin(reload(settled), 'test', 1)).toEqual(settled)
  })

  it('clears the displayed win only when a spin succeeds and keeps it at zero through the bonus', () => {
    const paid = revealSpin(begin('line'), 'test')
    const idle = dismissResult(paid, 'test')
    const selected = selectBetting(idle, { denominationSen: 10 })
    expect(lastWinSen(selected)).toBe(lastWinSen(paid))
    expect(lastWinSen(startSpin({ ...selected, balance: 0 }, rng, 'poor'))).toBe(lastWinSen(paid))
    const miss = startSpin(selected, rng, 'miss', 'oneOrb')
    expect(lastWinSen(reload(miss))).toBe(0)
    const missed = reload(revealSpin(miss, 'miss'))
    expect(lastWinSen(missed)).toBe(0)
    expect(missed.boardOrbs[4]).toEqual(calculateOrbPrize(10, 80, 2))

    function bonusAt(session: Session, id: string) {
      let active = reload(startSpin(session, rng, id, 'six'))
      active = reload(openBonus(revealSpin(active, id), id))
      for (let turn = 1; turn <= 3; turn++) {
        expect(lastWinSen(active)).toBe(0)
        expect(active.boardOrbs.filter(Boolean)).toEqual(Array(6).fill(calculateOrbPrize(
          session.betting.denominationSen, totalBetSen(session.betting), 2)))
        active = reload(revealRespin(startRespin(active, rng), id, turn))
      }
      return active
    }
    const collection = bonusAt(missed, 'first-bonus')
    expect(lastWinSen(collection)).toBe(0)
    const bonus = completeHoldCollection(collection, 'first-bonus:bonus')
    expect(lastWinSen(bonus)).toBe(6 * 16 * 10)
    const changed = selectBetting(dismissResult(bonus, 'first-bonus'), { denominationSen: 20, betSize: 3, lines: 88 })
    expect(lastWinSen(changed)).toBe(lastWinSen(bonus))
    expect(lastWinSen(completeHoldCollection(bonusAt(changed, 'second-bonus'), 'second-bonus:bonus'))).toBe(6 * 2 * 88 * 3 * 20)
  })

  it('prices ordinary orbs from the whole wager and keeps jackpots tied to denomination', () => {
    const initial = selectBetting(funded(), { denominationSen: 50, betSize: 5 })
    const narrow = begin('mini', initial)
    const wide = begin('mini', selectBetting(initial, { lines: 88 }))
    if (narrow.round.phase !== 'SPINNING' || wide.round.phase !== 'SPINNING') throw new Error('Expected pending spins')
    expect(narrow.round.spin.bet).not.toBe(wide.round.spin.bet)
    expect(narrow.round.orbs[2]).toEqual({ multiplier: 2, value: 80, payoutSen: 4000 })
    expect(wide.round.orbs[2]).toEqual({ multiplier: 2, value: 880, payoutSen: 44_000 })
    expect(narrow.round.orbs.filter(Boolean)).toContainEqual({ tier: 'mini', payoutSen: 250_000 })
    expect(wide.round.orbs.filter(Boolean)).toContainEqual({ tier: 'mini', payoutSen: 250_000 })
  })

  it('preserves locked v4 Free Spin board payouts and defaults the new music control on migration', () => {
    const selected = selectBetting(funded(), { denominationSen: 20, betSize: 5, lines: 8 })
    const current = revealSpin(begin('lanternBoth', selected), 'test')
    const { jackpotPrizes: _prizes, ...root } = current.freeSpins!.root
    const faceOnly = current.boardOrbs.map(orb => orb ? { value: 40 } : null)
    const migrated = parseSession(JSON.stringify({ ...current, version: 4, boardOrbs: faceOnly,
      settings: { ...current.settings, musicVolume: undefined },
      freeSpins: { ...current.freeSpins, root: { ...root, paytableVersion: 2 }, paidHold: faceOnly },
    }))!
    expect(migrated.settings.musicVolume).toBe(0.35)
    expect(reload(migrated).freeSpins?.paidHold?.filter(Boolean))
      .toEqual(Array(6).fill({ value: 40, payoutSen: 800, multiplier: null }))
  })
})
