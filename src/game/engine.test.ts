import { describe, expect, it, vi } from 'vitest'
import { BET_SIZES, BONUS_REBALANCE_VERSION, CELLS, DENOMINATIONS_SEN, LINE_OPTIONS, PAYLINES, REELS, ROWS,
  LATE_RESPIN_VERSION, RICH_BONUS_VERSION, betPerLineSen, calculateJackpots, cellAt, money, totalBetSen } from './config'
import { BONUS, bonusEntryChance, grandBoardChance, holdBoardMoments, respinLandingChance } from './bonusConfig'
import { calculateOrbPrize, configureOrbMultipliers, orbFaceLabel, orbWeightsForWager } from './orbPrizes'
import { FREE_SYMBOL_ORDER, REGULAR_SYMBOL_ORDER } from './probabilityConfig'
import type { SymbolId } from './config'
import { baseOrbChance, drawOrb, evaluateLines, generateBoard, respin, seededRandom,
  settleBonus, startingOrbs, triggersBonus } from './engine'
import type { Slots } from './engine'
import { expectedHoldPayout, simulate } from './simulation'

describe('bets, paylines and jackpot scaling', () => {
  it('calculates every permitted betting combination and scales jackpots exactly', () => {
    expect(DENOMINATIONS_SEN).toEqual([1, 2, 5, 10, 20, 50, 100, 200])
    expect(BET_SIZES).toEqual([1, 2, 3, 5, 10])
    expect(LINE_OPTIONS).toEqual([8, 18, 38, 58, 88])
    for (const denominationSen of DENOMINATIONS_SEN) {
      for (const betSize of BET_SIZES) {
        for (const lines of LINE_OPTIONS) {
          const betting = { denominationSen, betSize, lines }
          expect(betPerLineSen(betting)).toBe(denominationSen * betSize)
          expect(totalBetSen(betting)).toBe(denominationSen * betSize * lines)
          const bet = totalBetSen(betting)
          const weights = orbWeightsForWager({ denominationSen, bet })
          expect(weights.map(([multiplier]) => multiplier)).toEqual([1, 2, 3, 4, 5, 8, 10, 20, 50, 100, 200])
          expect(weights.reduce((sum, [, weight]) => sum + weight, 0)).toBeCloseTo(100, 10)
          expect(weights.every(([multiplier, weight]) => weight > 0 &&
            calculateOrbPrize(denominationSen, bet, multiplier).payoutSen === bet * multiplier)).toBe(true)
          const reference = orbWeightsForWager({ denominationSen: 10, bet: 10 * betSize * lines })
          if (denominationSen === 1 && bet === 8) expect(weights).not.toEqual(reference)
          else expect(weights).toBe(reference)
          expect(evaluateLines(Array<SymbolId>(CELLS).fill('tiger'), betPerLineSen(betting), lines).amount)
            .toBe(200 * bet)
          expect(calculateJackpots(denominationSen)).toEqual({
            mini: denominationSen * 5000, minor: denominationSen * 20000, major: 5_000_000, grand: 20_000_000,
          })
        }
      }
    }
    expect(money(100_000)).toBe('RM 1,000.00')
  })

  it('defines 88 unique five-position paths', () => {
    expect(PAYLINES).toHaveLength(88)
    expect(new Set(PAYLINES.map(line => line.join(''))).size).toBe(88)
    PAYLINES.forEach(line => {
      expect(line).toHaveLength(5)
      expect(line.every(row => row >= 0 && row < 3)).toBe(true)
    })
  })

  it('pays each enabled path independently and excludes all inactive paths', () => {
    const board = Array<SymbolId>(CELLS).fill('J')
    for (const lines of LINE_OPTIONS) {
      const result = evaluateLines(board, 60, lines)
      expect(result.wins.map(win => win.line)).toEqual(Array.from({ length: lines }, (_, line) => line))
      expect(result.amount).toBe(lines * 60 * 55)
    }
    const path88 = Array<SymbolId>(CELLS).fill('orb')
    PAYLINES[87].forEach((row, reel) => { path88[cellAt(reel, row)] = 'boat' })
    expect(evaluateLines(path88, 60, 88).wins).toContainEqual(expect.objectContaining({ line: 87, multiplier: 80 }))
    expect(evaluateLines(path88, 60, 58).wins.some(win => win.line === 87)).toBe(false)
  })

  it('uses Panda substitutions for standard symbols and ignores special symbols', () => {
    const board = Array<SymbolId>(CELLS).fill('orb')
    for (let reel = 0; reel < 5; reel++) board[cellAt(reel, 1)] = reel === 1 || reel === 2 ? 'wild' : 'tiger'
    expect(evaluateLines(board, 80, 1)).toMatchObject({ amount: 16_000, wins: [{ line: 0, symbol: 'tiger', multiplier: 200 }] })
    board[cellAt(3, 1)] = 'orb'
    expect(evaluateLines(board, 80, 1)).toMatchObject({ amount: 1_760, wins: [{ symbol: 'tiger', multiplier: 22 }] })
    for (const first of ['wild', 'lantern', 'orb'] as const) {
      board[cellAt(0, 1)] = first
      expect(evaluateLines(board, 80, 1).amount).toBe(0)
    }
  })

  it.each([false, true])('lands regular symbols at the approved weights per reel (Free Spins: %s)', free => {
    const rng = seededRandom(2026)
    const pool = new Set<SymbolId>(free ? FREE_SYMBOL_ORDER : REGULAR_SYMBOL_ORDER)
    const counts = Array.from({ length: REELS }, () => new Map<SymbolId, number>(
      REGULAR_SYMBOL_ORDER.map(symbol => [symbol, 0]),
    ))
    for (let spin = 0; spin < 10_000; spin++) {
      generateBoard(rng, undefined, free).forEach((symbol, position) => {
        const reel = counts[Math.floor(position / ROWS)]
        const count = reel.get(symbol)
        if (count !== undefined) reel.set(symbol, count + 1)
      })
    }
    for (const reel of counts) {
      const total = [...reel.values()].reduce((sum, count) => sum + count, 0)
      for (const [symbol, count] of reel) {
        if (pool.has(symbol)) {
          const expected = free ? (symbol === 'tiger' ? 0.8 : 1) / 3.8 : 1 / pool.size
          expect(Math.abs(count / total - expected)).toBeLessThan(0.012)
        }
        else expect(count).toBe(0)
      }
    }
  })

  it('pays the requested credits for each consecutive match and keeps older paytables for committed spins', () => {
    for (const symbol of REGULAR_SYMBOL_ORDER) {
      const awards = symbol === 'tiger' ? [3, 22, 55, 200]
        : symbol === 'boat' || symbol === 'chicken' || symbol === 'lotus' ? [0, 8, 20, 80] : [0, 5, 14, 55]
      for (const [i, award] of awards.entries()) {
        const board = Array<SymbolId>(CELLS).fill('orb')
        const count = i + 2
        for (let reel = 0; reel < count; reel++) board[cellAt(reel, 1)] = symbol
        const result = evaluateLines(board, 20, 1)
        expect(result.amount).toBe(award * 20)
        if (award) expect(result.wins[0].positions).toHaveLength(count)
      }
    }
    const board = Array<SymbolId>(CELLS).fill('J')
    expect(evaluateLines(board, 1, 1, 1).amount).toBe(35)
    expect(evaluateLines(board, 1, 1, 2).amount).toBe(22)
    expect(evaluateLines(board, 1, 1, 3).amount).toBe(100)
  })
})

describe('Hold & Spin', () => {
  const rng = () => 0.5
  const jackpotPrizes = calculateJackpots(10)
  const wager = { denominationSen: 10, bet: 80, jackpotPrizes }

  it('triggers at six and preserves all triggering positions', () => {
    const six = generateBoard(rng, 'six')
    const seven = generateBoard(rng, 'seven')
    for (const [board, count] of [[six, 6], [seven, 7]] as const) {
      const orbs = startingOrbs(board, rng, wager)
      expect(triggersBonus(board)).toBe(true)
      expect(orbs.filter(Boolean)).toHaveLength(count)
      expect(orbs.map(Boolean)).toEqual(board.map(symbol => symbol === 'orb'))
    }
    six[six.indexOf('orb')] = 'J'
    expect(triggersBonus(six)).toBe(false)
    expect(startingOrbs(six, () => 0, wager).filter(Boolean)).toEqual(Array(5).fill(calculateOrbPrize(10, 80, 1)))
  })

  it('resets on any new orb and decrements on misses, ending at zero', () => {
    const orbs = Array<null>(CELLS).fill(null) as Slots
    orbs[0] = calculateOrbPrize(10, 80, 10)
    const first = respin(orbs, 2, () => 0.99, wager)
    expect(first).toMatchObject({ remaining: 1, landed: 0, done: false })
    expect(respin(first.orbs, 1, () => 0.99, wager).done).toBe(true)
    const draws = [0, 0.5, 0.99]
    const hit = respin(orbs, 1, () => draws.shift() ?? 0.99, wager)
    expect(hit).toMatchObject({ remaining: BONUS.respins, landed: 1, done: false })
    expect(hit.orbs[0]).toBe(orbs[0])
    expect(hit.orbs[1]).toEqual(calculateOrbPrize(10, 80, 8))
  })

  it('normalizes jackpot types in one draw, with no GRAND orb', () => {
    const counts = { ordinary: 0, mini: 0, minor: 0, major: 0 }
    for (let sample = 0; sample < 100_000; sample++) {
      const orb = drawOrb(() => (sample + 0.5) / 100_000, true, wager)
      counts['tier' in orb ? orb.tier : 'ordinary']++
    }
    expect(counts).toEqual({ ordinary: 99_967, mini: 30, minor: 3, major: 0 })
    const random = vi.fn(() => 0.99999999)
    expect(drawOrb(random, true, wager)).toEqual({ tier: 'major', payoutSen: 5_000_000 })
    expect(random).toHaveBeenCalledTimes(1)
  })

  it.each([[1, 8, 1, 8, 8, '8'], [10, 80, 1, 8, 80, '8'], [10, 160, 1, 16, 160, '16'],
    [1, 100, 1, 100, 100, '100'], [50, 900, 3, 54, 2700, '54'],
    [100, 800, 1, 8, 800, 'RM8'], [200, 1600, 5, 40, 8000, 'RM80']] as const)(
    'prices denomination %i, total wager %i sen and multiplier %i exactly', (denomination, bet, multiplier, value, payoutSen, face) => {
      const orb = calculateOrbPrize(denomination, bet, multiplier)
      expect(orb).toMatchObject({ multiplier, value, payoutSen })
      expect(orbFaceLabel(orb)).toBe(face)
    },
  )

  it('accepts configurable multiplier limits and rejects unsafe or invalid orb configurations', () => {
    expect(configureOrbMultipliers([[1, 5], [350, 1]], 400)).toEqual([[1, 5], [350, 1]])
    expect(configureOrbMultipliers([[1, 5], [350, 1]], 200)).toEqual([[1, 5]])
    expect(() => configureOrbMultipliers([[1, 1], [-2, 1]], 200)).toThrow(RangeError)
    expect(() => configureOrbMultipliers([[1, -1]], 200)).toThrow(RangeError)
    expect(() => calculateOrbPrize(200, 1600, Number.MAX_SAFE_INTEGER)).toThrow(RangeError)
    expect(() => calculateOrbPrize(200, 1600, -1)).toThrow(RangeError)
    expect(() => calculateOrbPrize(50, 81, 1)).toThrow(RangeError)
  })

  it('draws ordinary orbs according to the configured relative weights', () => {
    const orbMultiplierWeights = orbWeightsForWager(wager)
    const totalWeight = orbMultiplierWeights.reduce((sum, [, weight]) => sum + weight, 0)
    const sampleSize = 10_000
    const counts = new Map<number, number>()
    for (let sample = 0; sample < sampleSize; sample++) {
      const orb = drawOrb(() => (sample + 0.5) / sampleSize, false, wager)
      if (!('value' in orb)) throw new Error('Expected an ordinary orb')
      counts.set(orb.multiplier!, (counts.get(orb.multiplier!) ?? 0) + 1)
    }
    orbMultiplierWeights.forEach(([multiplier, weight]) => {
      expect(Math.abs((counts.get(multiplier) ?? 0) - weight / totalWeight * sampleSize)).toBeLessThanOrEqual(1)
    })
    expect(drawOrb(() => 0.99999999, false, wager)).toMatchObject({ multiplier: BONUS.maxOrbMultiplier })
  })

  it('applies the published ordinary schedules at the lightest, reference and heaviest wagers', () => {
    for (const [denominationSen, credits, expected] of [
      [1, 8, 1.8529801], [10, 8, 2.1429637], [10, 440, 2.4808345], [10, 880, 2.4850468],
    ]) {
      const bet = denominationSen * credits
      const distribution = orbWeightsForWager({ denominationSen, bet })
      expect(distribution.reduce((sum, [multiplier, weight]) => sum + multiplier * weight / 100, 0)).toBeCloseTo(expected, 8)
      let cumulative = 0
      for (const [multiplier, weight] of distribution) {
        const rng = () => (cumulative + weight / 2) / 100
        expect(drawOrb(rng, false, { ...wager, denominationSen, bet })).toMatchObject({ multiplier, payoutSen: bet * multiplier })
        cumulative += weight
      }
    }
  })

  it('makes the same qualifying orb rolls more likely in Free Spins than paid spins', () => {
    const rolls = (orbRoll: number) => {
      let cell = 0
      return () => cell++ < 6 ? orbRoll : 0.5
    }
    expect(triggersBonus(generateBoard(rolls(0.82), undefined, true))).toBe(true)
    expect(triggersBonus(generateBoard(rolls(0.80), undefined, true))).toBe(false)
    expect(triggersBonus(generateBoard(rolls(0.812), undefined, true))).toBe(true)
    expect(triggersBonus(generateBoard(rolls(0.81), undefined, true, LATE_RESPIN_VERSION))).toBe(false)
    expect(triggersBonus(generateBoard(rolls(0.84)))).toBe(false)
    expect(triggersBonus(generateBoard(rolls(0.84), undefined, false, LATE_RESPIN_VERSION))).toBe(true)
    expect(triggersBonus(generateBoard(rolls(0.84), undefined, false, BONUS_REBALANCE_VERSION))).toBe(false)
    expect(triggersBonus(generateBoard(rolls(0.855)))).toBe(true)
    expect(triggersBonus(generateBoard(rolls(0.855), undefined, false, RICH_BONUS_VERSION))).toBe(false)
  })

  it.each([[6, 0.07], [7, 0.07], [8, 0.063], [9, 0.058], [10, 0.044], [11, 0.031], [12, 0.004], [13, 0.0009], [14, 0.0009]])(
    'uses one %i-orb landing tier for the entire respin at chance %f', (count, chance) => {
      const prize = calculateOrbPrize(10, 80, 2)
      const held = Array.from({ length: CELLS }, (_, index) => index < count ? prize : null)
      const miss = vi.fn(() => chance)
      expect(respinLandingChance(count)).toBe(chance)
      expect(respin(held, 3, miss, wager).landed).toBe(0)
      expect(miss).toHaveBeenCalledTimes(CELLS - count)
      expect(respin(held, 3, () => chance / 2, wager).landed).toBe(CELLS - count)
    },
  )

  it('models the final orb count from a six-orb start and keeps GRAND rare and possible', () => {
    const board = holdBoardMoments(CELLS, baseOrbChance)
    expect(board.fromTrigger.orbs).toBeCloseTo(8.971, 3)
    expect(board.fromTrigger.eightOrMore).toBeGreaterThan(0.70)
    expect(grandBoardChance(CELLS, baseOrbChance)).toBeGreaterThan(0)
    expect(board.full).toBeLessThan(0.00000005)
  })

  it('accounts for new payouts in a seeded simulation while keeping the six-orb rule', () => {
    const result = simulate({ spins: 100_000, denominationSen: 10, bet: 80, lines: 8, seed: 2026 })
    expect(Object.values(result.components).reduce((sum, value) => sum + value, 0)).toBe(result.won)
    const { line, scatter, freeLine, freeScatter } = result.components
    const hold = expectedHoldPayout(10, 80)
    const modeledRtp = ((line + scatter + freeLine + freeScatter) / result.spins + hold.ordinaryOrbs + hold.jackpots) / 80
    expect(hold.ordinaryOrbs / 80).toBeCloseTo(0.49619, 4)
    expect(Math.abs(modeledRtp - 0.94381)).toBeLessThan(0.025)
    expect(hold.jackpotPayouts.major).toBeGreaterThan(0)
    expect(hold.jackpotPayouts.grand).toBeGreaterThan(0)
    expect(result.lineHits).toBeGreaterThan(0)
    expect(result.freeZeroPayouts / result.lanternTriggers).toBeLessThan(0.15)
    expect(hold.grandAwards).toBeGreaterThan(0)
    expect(result.sixOrbFinalOrbs / result.sixOrbStarts).toBeGreaterThan(8)
    expect(result.holdFinalOrbs / result.holdTriggers).toBeGreaterThan(8)
    expect(result.spins).toBe(100_000)
    const modeledEntry = bonusEntryChance(CELLS, baseOrbChance)
    expect(modeledEntry).toBeCloseTo(0.020020, 6)
    expect(Math.abs(result.triggers / result.spins - modeledEntry)).toBeLessThan(0.002)
    expect(result.bonusWon).toBeGreaterThan(0)
    expect(result.won).toBeGreaterThan(result.bonusWon)
  })

  it('uses the same seeded events at different wagers and runs independently of browser saves', () => {
    const storage = { getItem: vi.fn(), setItem: vi.fn() }
    vi.stubGlobal('localStorage', storage)
    try {
      const options = { spins: 10_000, lines: 8, seed: 71 }
      const low = simulate({ ...options, denominationSen: 1, bet: 8 })
      const high = simulate({ ...options, denominationSen: 50, bet: 2000 })
      expect(low.triggers).toBe(high.triggers)
      expect(low.lanternTriggers).toBe(high.lanternTriggers)
      expect(low.jackpotHits).toEqual(high.jackpotHits)
      expect(low.won).not.toBe(high.won)
      expect(storage.getItem).not.toHaveBeenCalled()
      expect(storage.setItem).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('includes standard and special prizes exactly once, plus GRAND on a full board', () => {
    const orbs: Slots = [
      ...(['mini', 'minor', 'major'] as const).map(tier => ({ tier, payoutSen: jackpotPrizes[tier] })),
      ...Array.from({ length: 12 }, () => calculateOrbPrize(10, 80, 5)),
    ]
    const result = settleBonus(orbs, jackpotPrizes)
    expect(result.bonus).toBe(4800)
    expect(result.awards.map(award => award.tier)).toEqual(['grand', 'major', 'minor', 'mini'])
    expect(result.jackpot).toBe(25_250_000)
    expect(settleBonus(orbs, jackpotPrizes, false)).toEqual({
      jackpot: 20_000_000, bonus: 0, awards: [{ tier: 'grand', amount: 20_000_000 }],
    })
    expect(settleBonus(orbs.slice(0, 14).concat(null), jackpotPrizes).awards.some(award => award.tier === 'grand')).toBe(false)
    expect(settleBonus(orbs.slice(0, 14), jackpotPrizes).awards.some(award => award.tier === 'grand')).toBe(false)
  })

  it('reproduces a stream with the same seed', () => {
    expect(generateBoard(seededRandom(123))).toEqual(generateBoard(seededRandom(123)))
    expect(generateBoard(seededRandom(123))).not.toEqual(generateBoard(seededRandom(124)))
  })
})
