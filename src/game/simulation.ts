import { BONUS, holdBoardMoments } from './bonusConfig'
import { LANTERN } from './lanternConfig'
import { baseOrbChance, evaluateLines, evaluateScatter, generateBoard, lanternCountOdds, legacyLinePayout,
  orbTypeProbabilities, respin, seededRandom, settleBonus, startingOrbs, triggersBonus } from './engine'
import type { Slots } from './engine'
import { CELLS, calculateJackpots } from './config'
import type { SymbolId } from './config'
import { calculateOrbPrize, orbMultiplierWeights } from './orbPrizes'

export function expectedHoldPayout(denominationSen: number, betSize: number, grandAddsToOrbs: boolean = BONUS.grandAddsToOrbs) {
  const paidEntry = lanternCountOdds(false).slice(3).reduce((sum, chance) => sum + chance, 0)
  const retrigger = lanternCountOdds(true).slice(3).reduce((sum, chance) => sum + chance, 0)
  const boardsPerPaidSpin = 1 + paidEntry * LANTERN.initialSpins / (1 - retrigger * LANTERN.extraSpins)
  const { full, orbs } = holdBoardMoments(CELLS, baseOrbChance)
  const paidOrbs = (orbs - (grandAddsToOrbs ? 0 : CELLS * full)) * boardsPerPaidSpin
  const prizes = calculateJackpots(denominationSen)
  const multiplierWeight = orbMultiplierWeights.reduce((sum, [, weight]) => sum + weight, 0)
  const ordinaryMean = orbMultiplierWeights.reduce((sum, [multiplier, weight]) =>
    sum + calculateOrbPrize(denominationSen, betSize, multiplier).payoutSen * weight / multiplierWeight, 0)
  let ordinaryOrbs = 0
  let jackpots = full * boardsPerPaidSpin * prizes.grand
  for (const [type, chance] of orbTypeProbabilities) {
    if (type === 'ordinary') ordinaryOrbs = paidOrbs * chance * ordinaryMean
    else jackpots += paidOrbs * chance * prizes[type]
  }
  return { ordinaryOrbs, jackpots, grandAwards: full * boardsPerPaidSpin }
}

export function simulate({ spins, denominationSen, betSize = 1, bet, perLine, lines, seed, legacy = false }: {
  spins: number; denominationSen: number; betSize?: number; bet: number; perLine: number; lines: number; seed: number; legacy?: boolean
}) {
  const rng = seededRandom(seed)
  const jackpotPrizes = calculateJackpots(denominationSen)
  const wager = { denominationSen, betSize, jackpotPrizes }
  const jackpotCounts = { grand: 0, major: 0, minor: 0, mini: 0 }
  const jackpotHits = { grand: 0, major: 0, minor: 0, mini: 0 }
  const lastJackpotSpin = { grand: -1, major: -1, minor: -1, mini: -1 }
  let won = 0
  let bonusWon = 0
  const components = { line: 0, scatter: 0, freeLinesAndScatter: 0, ordinaryOrbs: 0, jackpots: 0 }
  let triggers = 0
  let holdTriggers = 0
  let holdFinalOrbs = 0
  let sixOrbStarts = 0
  let sixOrbFinalOrbs = 0
  let sixOrbStartsReachingEight = 0
  let hits = 0
  let lineHits = 0
  const paidLanternCounts = [0, 0, 0, 0, 0, 0]
  const freeLanternCounts = [0, 0, 0, 0, 0, 0]
  let lanternTriggers = 0
  let freeRetriggers = 0
  let freePlayed = 0
  let freeGoldOrbs = 0
  let freeLineHits = 0
  let freeHoldTriggers = 0
  let freeWon = 0
  let freeZeroPayouts = 0

  const lineWin = (board: SymbolId[]) => {
    const raw = evaluateLines(board, perLine, lines).amount
    return legacy ? legacyLinePayout(raw, lines) : raw
  }
  function holdWin(held: Slots, paidSpin: number) {
    holdTriggers++
    let orbs = held
    let remaining: number = BONUS.respins
    while (remaining && !orbs.every(Boolean)) {
      const next = respin(orbs, remaining, rng, wager)
      remaining = next.remaining
      orbs = next.orbs
    }
    const finalCount = orbs.filter(Boolean).length
    holdFinalOrbs += finalCount
    if (held.filter(Boolean).length === BONUS.triggerCount) {
      sixOrbStarts++
      sixOrbFinalOrbs += finalCount
      if (finalCount >= 8) sixOrbStartsReachingEight++
    }
    const result = settleBonus(orbs, jackpotPrizes)
    const payout = result.bonus + result.jackpot
    bonusWon += payout
    components.ordinaryOrbs += result.bonus
    components.jackpots += result.jackpot
    for (const { tier } of result.awards) {
      jackpotCounts[tier]++
      if (lastJackpotSpin[tier] === paidSpin) continue
      lastJackpotSpin[tier] = paidSpin
      jackpotHits[tier]++
    }
    return payout
  }

  for (let spin = 0; spin < spins; spin++) {
    const board = generateBoard(rng)
    const orbs = startingOrbs(board, rng, wager)
    const hold = triggersBonus(board)
    const scatter = evaluateScatter(board, bet)
    paidLanternCounts[Math.min(scatter.count, 5)]++
    const baseLine = lineWin(board)
    components.line += baseLine
    components.scatter += scatter.amount
    if (baseLine > 0) lineHits++
    let amount = baseLine + scatter.amount
    if (scatter.qualifies) {
      lanternTriggers++
      let remaining: number = LANTERN.initialSpins
      let featureWin = 0
      while (remaining > 0) {
        remaining--
        freePlayed++
        const freeBoard = generateBoard(rng, undefined, true)
        const freeOrbs = startingOrbs(freeBoard, rng, wager)
        freeGoldOrbs += freeOrbs.filter(Boolean).length
        const freeScatter = evaluateScatter(freeBoard, bet)
        freeLanternCounts[Math.min(freeScatter.count, 5)]++
        const freeLine = lineWin(freeBoard)
        if (freeLine > 0) freeLineHits++
        components.freeLinesAndScatter += freeLine + freeScatter.amount
        featureWin += freeLine + freeScatter.amount
        if (freeScatter.qualifies) {
          freeRetriggers++
          remaining += LANTERN.extraSpins
        }
        if (triggersBonus(freeBoard)) {
          freeHoldTriggers++
          featureWin += holdWin(freeOrbs, spin)
        }
      }
      freeWon += featureWin
      if (!featureWin) freeZeroPayouts++
      amount += featureWin
    }
    if (hold) {
      triggers++
      amount += holdWin(orbs, spin)
    }
    won += amount
    if (amount > 0) hits++
  }
  return { spins, won, bonusWon, components, triggers, hits, lineHits, jackpotCounts, jackpotHits, holdTriggers,
    holdFinalOrbs, sixOrbStarts, sixOrbFinalOrbs, sixOrbStartsReachingEight, lanternTriggers,
    freeRetriggers, freePlayed, freeGoldOrbs, freeLineHits, freeHoldTriggers, freeWon, freeZeroPayouts, paidLanternCounts, freeLanternCounts }
}
