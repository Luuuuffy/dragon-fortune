import { describe, expect, it, vi } from 'vitest'
import { BET_SIZES, CELLS, DENOMINATIONS_SEN, LINE_OPTIONS, PAYLINES,
  betPerLineSen, calculateJackpots, cellAt, money, totalBetSen } from './config'
import { BONUS, bonusEntryChance, grandBoardChance } from './bonusConfig'
import { calculateOrbPrize, configureOrbMultipliers, orbMultiplierWeights } from './orbPrizes'
import type { SymbolId } from './config'
import { baseOrbChance, drawOrb, evaluateLines, generateBoard, respin, seededRandom,
  settleBonus, startingOrbs, triggersBonus } from './engine'
import type { Slots } from './engine'
import { simulate } from './simulation'

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
      expect(result.amount).toBe(lines * 60 * 35)
    }
    const path88 = Array<SymbolId>(CELLS).fill('orb')
    PAYLINES[87].forEach((row, reel) => { path88[cellAt(reel, row)] = 'coin' })
    expect(evaluateLines(path88, 60, 88).wins).toContainEqual(expect.objectContaining({ line: 87, multiplier: 65 }))
    expect(evaluateLines(path88, 60, 58).wins.some(win => win.line === 87)).toBe(false)
  })

  it('uses the highest wild interpretation once per line', () => {
    const board = Array<SymbolId>(CELLS).fill('orb')
    for (let reel = 0; reel < 5; reel++) board[cellAt(reel, 1)] = reel < 3 ? 'wild' : 'dragon'
    expect(evaluateLines(board, 80, 1)).toMatchObject({ amount: 16_000, wins: [{ line: 0, symbol: 'dragon', multiplier: 200 }] })
    board[cellAt(3, 1)] = 'orb'
    expect(evaluateLines(board, 80, 1)).toMatchObject({ amount: 2000, wins: [{ symbol: 'wild', multiplier: 25 }] })
    board[cellAt(0, 1)] = 'orb'
    expect(evaluateLines(board, 80, 1).amount).toBe(0)
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
    expect(hit.orbs[1]).toEqual(calculateOrbPrize(10, 1, 100))
  })

  it('normalizes jackpot types in one draw, with no GRAND orb', () => {
    const counts = { ordinary: 0, mini: 0, minor: 0, major: 0 }
    for (let sample = 0; sample < 100_000; sample++) {
      const orb = drawOrb(() => (sample + 0.5) / 100_000, true, wager)
      counts['tier' in orb ? orb.tier : 'ordinary']++
    }
    expect(counts).toEqual({ ordinary: 99_000, mini: 800, minor: 190, major: 10 })
    const random = vi.fn(() => 0.99995)
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
      expect(counts.get(multiplier)).toBeCloseTo(weight / totalWeight * sampleSize)
      if (index > 0) expect(weight).toBeLessThan(orbMultiplierWeights[index - 1][1])
    })
    expect(Math.max(...counts.keys())).toBe(BONUS.maxOrbMultiplier)
  })

  it('uses a separate chance for respins and keeps GRAND possible and rare', () => {
    const held = startingOrbs(generateBoard(rng, 'six'), rng, wager, 'six')
    const miss = vi.fn(() => BONUS.landingChance)
    expect(respin(held, 3, miss, wager).landed).toBe(0)
    expect(miss).toHaveBeenCalledTimes(9)
    expect(respin(held, 3, () => BONUS.landingChance - 0.001, wager).landed).toBe(9)
    expect(baseOrbChance).toBeGreaterThan(BONUS.landingChance)
    expect(grandBoardChance(CELLS, baseOrbChance)).toBeGreaterThan(0)
    expect(grandBoardChance(CELLS, baseOrbChance)).toBeLessThan(0.0001)
  })

  it('measures a seeded simulation near the target without changing the six-orb rule', () => {
    const result = simulate({ spins: 100_000, denominationSen: 10, bet: 80, perLine: 10, lines: 8, seed: 2026 })
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
