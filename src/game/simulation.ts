import { BONUS, holdBoardMoments } from './bonusConfig'
import { LANTERN } from './lanternConfig'
import { baseOrbChance, evaluateLines, evaluateScatter, generateBoard, lanternCountOdds, legacyLinePayout,
  orbTypeProbabilities, respin, seededRandom, settleBonus, startingOrbs, triggersBonus } from './engine'
import type { Slots } from './engine'
import { CELLS, DESIGN_B_VERSION, calculateJackpots } from './config'
import type { PaytableVersion, SymbolId } from './config'
import { orbWeightsForWager, priceWagerOrb } from './orbPrizes'

export function expectedHoldPayout(denominationSen: number, bet: number, legacy = false,
  grandAddsToOrbs: boolean = BONUS.grandAddsToOrbs) {
  const paidEntry = lanternCountOdds(false).slice(3).reduce((sum, chance) => sum + chance, 0)
  const retrigger = lanternCountOdds(true).slice(3).reduce((sum, chance) => sum + chance, 0)
  const boardsPerPaidSpin = 1 + paidEntry * LANTERN.initialSpins / (1 - retrigger * LANTERN.extraSpins)
  const { full, orbs } = holdBoardMoments(CELLS, baseOrbChance)
  const paidOrbs = (orbs - (grandAddsToOrbs ? 0 : CELLS * full)) * boardsPerPaidSpin
  const prizes = calculateJackpots(denominationSen)
  const paytableVersion: PaytableVersion = legacy ? 2 : DESIGN_B_VERSION
  const wager = { denominationSen, bet, paytableVersion, legacyBetSize: legacy ? 1 : undefined }
  const weights = orbWeightsForWager(wager)
  const multiplierWeight = weights.reduce((sum, [, weight]) => sum + weight, 0)
  const ordinaryMean = weights.reduce((sum, [multiplier, weight]) =>
    sum + priceWagerOrb(wager, multiplier).payoutSen * weight / multiplierWeight, 0)
  let ordinaryOrbs = 0
  const jackpotPayouts = { mini: 0, minor: 0, major: 0, grand: full * boardsPerPaidSpin * prizes.grand }
  for (const [type, chance] of orbTypeProbabilities(paytableVersion)) {
    if (type === 'ordinary') ordinaryOrbs = paidOrbs * chance * ordinaryMean
    else jackpotPayouts[type] = paidOrbs * chance * prizes[type]
  }
  return { ordinaryOrbs, jackpots: Object.values(jackpotPayouts).reduce((sum, value) => sum + value, 0), jackpotPayouts,
    grandAwards: full * boardsPerPaidSpin }
}

export function simulate({ spins, denominationSen, bet, lines, seed, legacy = false }: {
  spins: number; denominationSen: number; bet: number; lines: number; seed: number; legacy?: boolean
}) {
  const rng = seededRandom(seed)
  const jackpotPrizes = calculateJackpots(denominationSen)
  const version: PaytableVersion = legacy ? 2 : DESIGN_B_VERSION
  const wager = { denominationSen, bet, jackpotPrizes, paytableVersion: version, legacyBetSize: legacy ? 1 : undefined }
  const jackpotCounts = { grand: 0, major: 0, minor: 0, mini: 0 }
  const jackpotHits = { grand: 0, major: 0, minor: 0, mini: 0 }
  const lastJackpotSpin = { grand: -1, major: -1, minor: -1, mini: -1 }
  let won = 0
  let bonusWon = 0
  const components = { line: 0, scatter: 0, freeLine: 0, freeScatter: 0,
    ordinaryOrbs: 0, mini: 0, minor: 0, major: 0, grand: 0 }
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
    const raw = evaluateLines(board, legacy ? bet : bet / lines, lines, version).amount
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
    for (const { tier, amount } of result.awards) {
      components[tier] += amount
      jackpotCounts[tier]++
      if (lastJackpotSpin[tier] === paidSpin) continue
      lastJackpotSpin[tier] = paidSpin
      jackpotHits[tier]++
    }
    return payout
  }

  for (let spin = 0; spin < spins; spin++) {
    const board = generateBoard(rng, undefined, false, version)
    const orbs = startingOrbs(board, rng, wager)
    const hold = triggersBonus(board)
    const scatter = evaluateScatter(board, bet, version)
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
        const freeBoard = generateBoard(rng, undefined, true, version)
        const freeOrbs = startingOrbs(freeBoard, rng, wager)
        freeGoldOrbs += freeOrbs.filter(Boolean).length
        const freeScatter = evaluateScatter(freeBoard, bet, version)
        freeLanternCounts[Math.min(freeScatter.count, 5)]++
        const freeLine = lineWin(freeBoard)
        if (freeLine > 0) freeLineHits++
        components.freeLine += freeLine
        components.freeScatter += freeScatter.amount
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
