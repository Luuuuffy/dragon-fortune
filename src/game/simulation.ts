import { BONUS } from './bonusConfig'
import { LANTERN } from './lanternConfig'
import { evaluateLines, evaluateScatter, generateBoard, legacyLinePayout, respin, seededRandom,
  settleBonus, startingOrbs, triggersBonus } from './engine'
import type { Slots } from './engine'
import { calculateJackpots } from './config'
import type { SymbolId } from './config'

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
  let triggers = 0
  let holdTriggers = 0
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
    const result = settleBonus(orbs, jackpotPrizes)
    const payout = result.bonus + result.jackpot
    bonusWon += payout
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
      amount += featureWin
    }
    if (hold) {
      triggers++
      amount += holdWin(orbs, spin)
    }
    won += amount
    if (amount > 0) hits++
  }
  return { spins, won, bonusWon, triggers, hits, lineHits, jackpotCounts, jackpotHits, holdTriggers, lanternTriggers,
    freeRetriggers, freePlayed, freeGoldOrbs, freeLineHits, freeHoldTriggers, freeWon, paidLanternCounts, freeLanternCounts }
}
