import { describe, expect, it, vi } from 'vitest'
import { BET_SIZES, CELLS, DENOMINATIONS_SEN, LINE_OPTIONS, PAYLINES, REELS, ROWS, SYMBOLS,
  betPerLineSen, calculateJackpots, cellAt, money, totalBetSen } from './config'
import { BONUS, bonusEntryChance, grandBoardChance, holdBoardMoments, respinLandingChance } from './bonusConfig'
import { calculateOrbPrize, configureOrbMultipliers, orbMultiplierWeights } from './orbPrizes'
import { REGULAR_SYMBOL_ORDER } from './probabilityConfig'
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
      expect(result.amount).toBe(lines * 60 * 22)
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
    expect(evaluateLines(board, 80, 1)).toMatchObject({ amount: 800, wins: [{ symbol: 'tiger', multiplier: 10 }] })
    for (const first of ['wild', 'lantern', 'orb'] as const) {
      board[cellAt(0, 1)] = first
      expect(evaluateLines(board, 80, 1).amount).toBe(0)
    }
  })

  it.each([false, true])('lands standard symbols equally often per reel (Free Spins: %s)', free => {
    const rng = seededRandom(2026)
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
      for (const count of reel.values()) {
        expect(Math.abs(count / total - 1 / REGULAR_SYMBOL_ORDER.length)).toBeLessThan(0.01)
      }
    }
  })

  it('uses the new paytable hierarchy and keeps older payouts available to committed spins', () => {
    const ranks = ['9', '10', 'J', 'Q', 'K', 'chicken', 'boat', 'lotus', 'tiger'] as const
    expect(Object.keys(SYMBOLS).filter(symbol => SYMBOLS[symbol as keyof typeof SYMBOLS].pays).sort()).toEqual([...ranks].sort())
    ranks.slice(1).forEach((rank, index) => expect(SYMBOLS[rank].pays[2]).toBeGreaterThan(SYMBOLS[ranks[index]].pays[2]))
    expect(evaluateLines(Array<SymbolId>(CELLS).fill('J'), 1, 1, true).amount).toBe(35)
  })
})

describe('Hold & Spin', () => {
  const rng = () => 0.5
  const jackpotPrizes = calculateJackpots(10)
  const wager = { denominationSen: 10, betSize: 1, jackpotPrizes }

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
    expect(startingOrbs(six, () => 0, wager).filter(Boolean)).toEqual(Array(5).fill(calculateOrbPrize(10, 1, 1)))
  })

  it('resets on any new orb and decrements on misses, ending at zero', () => {
    const orbs = Array<null>(CELLS).fill(null) as Slots
    orbs[0] = calculateOrbPrize(10, 1, 10)
    const first = respin(orbs, 2, () => 0.99, wager)
    expect(first).toMatchObject({ remaining: 1, landed: 0, done: false })
    expect(respin(first.orbs, 1, () => 0.99, wager).done).toBe(true)
    const draws = [0, 0.5, 0.99]
    const hit = respin(orbs, 1, () => draws.shift() ?? 0.99, wager)
    expect(hit).toMatchObject({ remaining: BONUS.respins, landed: 1, done: false })
    expect(hit.orbs[0]).toBe(orbs[0])
    expect(hit.orbs[1]).toEqual(calculateOrbPrize(10, 1, 10))
  })

  it('normalizes jackpot types in one draw, with no GRAND orb', () => {
    const counts = { ordinary: 0, mini: 0, minor: 0, major: 0 }
    for (let sample = 0; sample < 100_000; sample++) {
      const orb = drawOrb(() => (sample + 0.5) / 100_000, true, wager)
      counts['tier' in orb ? orb.tier : 'ordinary']++
    }
    expect(counts).toEqual({ ordinary: 99_830, mini: 150, minor: 20, major: 0 })
    const random = vi.fn(() => 0.99999999)
    expect(drawOrb(random, true, wager)).toEqual({ tier: 'major', payoutSen: 5_000_000 })
    expect(random).toHaveBeenCalledTimes(1)
  })

  it.each([[10, 1, 1, 8, 80], [50, 1, 1, 8, 400], [100, 1, 5, 40, 4000], [200, 3, 5, 120, 24000]])(
    'prices denomination %i, size %i and multiplier %i exactly', (denomination, size, multiplier, value, payoutSen) => {
      expect(calculateOrbPrize(denomination, size, multiplier)).toEqual({ multiplier, value, payoutSen })
    },
  )

  it('accepts configurable limits and base units and rejects unsafe or invalid orb configurations', () => {
    expect(calculateOrbPrize(50, 1, 5, 12)).toEqual({ multiplier: 5, value: 60, payoutSen: 3000 })
    expect(configureOrbMultipliers([[1, 5], [350, 1]], 400)).toEqual([[1, 5], [350, 1]])
    expect(configureOrbMultipliers([[1, 5], [350, 1]], 200)).toEqual([[1, 5]])
    expect(() => configureOrbMultipliers([[1, 1], [-2, 1]], 200)).toThrow(RangeError)
    expect(() => configureOrbMultipliers([[1, -1]], 200)).toThrow(RangeError)
    expect(() => calculateOrbPrize(200, 10, Number.MAX_SAFE_INTEGER)).toThrow(RangeError)
    expect(() => calculateOrbPrize(200, 10, -1)).toThrow(RangeError)
  })

  it('normalizes the configured relative orb weights and favors smaller values', () => {
    const totalWeight = orbMultiplierWeights.reduce((sum, [, weight]) => sum + weight, 0)
    const sampleSize = 10_000
    const counts = new Map<number, number>()
    for (let sample = 0; sample < sampleSize; sample++) {
      const orb = drawOrb(() => (sample + 0.5) / sampleSize, false, wager)
      if (!('value' in orb)) throw new Error('Expected an ordinary orb')
      counts.set(orb.multiplier!, (counts.get(orb.multiplier!) ?? 0) + 1)
    }
    orbMultiplierWeights.forEach(([multiplier, weight], index) => {
      expect(Math.abs((counts.get(multiplier) ?? 0) - weight / totalWeight * sampleSize)).toBeLessThanOrEqual(1)
      if (index > 0) expect(weight).toBeLessThan(orbMultiplierWeights[index - 1][1])
    })
    expect(drawOrb(() => 0.99999999, false, wager)).toMatchObject({ multiplier: BONUS.maxOrbMultiplier })
  })

  it.each([[6, 0.072], [7, 0.072], [8, 0.02], [9, 0.02], [10, 0.01], [11, 0.01], [12, 0.003], [14, 0.003]])(
    'uses one %i-orb landing tier for the entire respin at chance %f', (count, chance) => {
      const prize = calculateOrbPrize(10, 1, 2)
      const held = Array.from({ length: CELLS }, (_, index) => index < count ? prize : null)
      const miss = vi.fn(() => chance)
      expect(respinLandingChance(count)).toBe(chance)
      expect(respin(held, 3, miss, wager).landed).toBe(0)
      expect(miss).toHaveBeenCalledTimes(CELLS - count)
      expect(respin(held, 3, () => chance - 0.001, wager).landed).toBe(CELLS - count)
    },
  )

  it('models at least eight final orbs from a six-orb start and keeps GRAND rare and possible', () => {
    const board = holdBoardMoments(CELLS, baseOrbChance)
    expect(board.fromTrigger.orbs).toBeGreaterThanOrEqual(8)
    expect(board.fromTrigger.eightOrMore).toBeGreaterThan(0.70)
    expect(grandBoardChance(CELLS, baseOrbChance)).toBeGreaterThan(0)
    expect(board.full).toBeLessThan(0.000000002)
  })

  it('measures a seeded simulation near the target without changing the six-orb rule', () => {
    const result = simulate({ spins: 100_000, denominationSen: 10, bet: 80, perLine: 10, lines: 8, seed: 2026 })
    expect(Object.values(result.components).reduce((sum, value) => sum + value, 0)).toBe(result.won)
    const { line, scatter, freeLinesAndScatter } = result.components
    const hold = expectedHoldPayout(10, 1)
    const modeledRtp = ((line + scatter + freeLinesAndScatter) / result.spins + hold.ordinaryOrbs + hold.jackpots) / 80
    expect(Math.abs(modeledRtp - 0.92)).toBeLessThan(0.025)
    expect(result.lineHits).toBeGreaterThan(0)
    expect(result.freeZeroPayouts / result.lanternTriggers).toBeLessThan(0.15)
    expect(hold.grandAwards).toBeGreaterThan(0)
    expect(result.sixOrbFinalOrbs / result.sixOrbStarts).toBeGreaterThan(8)
    expect(result.holdFinalOrbs / result.holdTriggers).toBeGreaterThan(8)
    expect(result.spins).toBe(100_000)
    expect(result.triggers / result.spins).toBeGreaterThan(0.018)
    expect(result.triggers / result.spins).toBeLessThan(0.022)
    expect(Math.abs(bonusEntryChance(CELLS, baseOrbChance) - BONUS.targetEntryChance)).toBeLessThan(0.0002)
    expect(result.bonusWon).toBeGreaterThan(0)
    expect(result.won).toBeGreaterThan(result.bonusWon)
  })

  it('uses the same seeded events at different wagers and runs independently of browser saves', () => {
    const storage = { getItem: vi.fn(), setItem: vi.fn() }
    vi.stubGlobal('localStorage', storage)
    try {
      const options = { spins: 10_000, lines: 8, seed: 71 }
      const low = simulate({ ...options, denominationSen: 1, betSize: 1, bet: 8, perLine: 1 })
      const high = simulate({ ...options, denominationSen: 50, betSize: 5, bet: 2000, perLine: 250 })
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
      ...Array.from({ length: 12 }, () => calculateOrbPrize(10, 1, 5)),
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
