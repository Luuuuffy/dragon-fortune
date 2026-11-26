import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import {
  BET_SIZES, DENOMINATIONS_SEN, LINE_OPTIONS, PAYLINES, LINE_CREDITS, calculateJackpots, totalBetSen, wagerCredits,
} from '../src/game/config'
import { BONUS } from '../src/game/bonusConfig'
import { LANTERN } from '../src/game/lanternConfig'
import { REEL_SYMBOL_WEIGHTS, REGULAR_SYMBOL_ORDER, WILD_STACK_WEIGHTS, NON_ORB_WEIGHT, DESIGN_B_ORB_TYPES,
  LOW_ORB_WEIGHTS, HIGH_ORB_WEIGHTS, ORB_HIGH_MIX_BPS } from '../src/game/probabilityConfig'
import { orbWeightsForWager } from '../src/game/orbPrizes'
import { expectedHoldPayout } from '../src/game/simulation'

const count = (mask: number) => Number(Boolean(mask & 1)) + Number(Boolean(mask & 2)) + Number(Boolean(mask & 4))
const sum = (numbers: readonly number[]) => numbers.reduce((total, value) => total + value, 0)
function choose(n: number, k: number) {
  let combinations = 1
  for (let i = 0; i < k; i++) combinations = combinations * (n - i) / (i + 1)
  return combinations
}
// Addition combines packed reel states. The field maxima after five reels are 15, 5, 5, 15 and 5.
const key = (open: number, reels: number, lit: number, regular: number, required: number) =>
  open | (reels << 4) | (lit << 7) | (regular << 10) | (required << 14)
const add = (out: Map<number, number>, k: number, value: number) => out.set(k, (out.get(k) ?? 0) + value)
const baseOrbChance = BONUS.baseOrbWeight / (NON_ORB_WEIGHT + BONUS.baseOrbWeight)
const reelCache = new Map<string, [number, number][]>()
const lanternCache = new Map<string, number>()

function lanternFactor(open: number, reels: number, lit: number, isFree: boolean) {
  if (lit > reels) return 0
  const id = [open, reels, lit, isFree].join('/')
  const known = lanternCache.get(id)
  if (known !== undefined) return known
  const chance = (isFree ? LANTERN.freeWeight : LANTERN.paidWeight) / NON_ORB_WEIGHT
  const tiers = isFree ? LANTERN.freeTierWeights : LANTERN.paidTierWeights
  let total = 0
  let match = 0
  for (let k = 0; k <= open; k++) {
    const capped = Math.min(k, reels)
    const mass = choose(open, k) * chance ** k * (1 - chance) ** (open - k) * (capped >= 3 ? tiers[capped - 3] : 1)
    if (capped === lit) match += mass
    total += mass
  }
  const value = match / total / choose(reels, lit)
  lanternCache.set(id, value)
  return value
}
function reelStates(first: boolean, row: number, symbolChance: number, isFree: boolean) {
  const id = [first, row, symbolChance, isFree].join('/')
  const known = reelCache.get(id)
  if (known) return known
  const result = new Map<number, number>()
  const weights = first ? [1] : isFree ? WILD_STACK_WEIGHTS.free : WILD_STACK_WEIGHTS.paid
  const weightsTotal = sum(weights)
  for (let openMask = 0; openMask < 8; openMask++) {
    const open = count(openMask)
    const maskChance = (1 - baseOrbChance) ** open * baseOrbChance ** (3 - open)
    for (let lantern = -1; lantern < 3; lantern++) {
      if (lantern >= 0 && !(openMask & (1 << lantern))) continue
      const lit = Number(lantern >= 0)
      const freeSlots = lit ? openMask & ~(1 << lantern) : openMask
      const cellChance = maskChance / (lit ? open : 1)
      for (let request = 0; request < weights.length; request++) {
        if (!weights[request]) continue
        let stack = 0
        let masks = [0]
        for (let size = Math.min(count(freeSlots), request); size >= 1; size--) {
          const available: number[] = []
          for (let i = 0; i <= 3 - size; i++) {
            const mask = ((1 << size) - 1) << i
            if ((mask & freeSlots) === mask) available.push(mask)
          }
          if (available.length) {
            stack = size
            masks = available
            break
          }
        }
        const regular = open - lit - stack
        for (const mask of masks) {
          let required = 0
          if (row >= 0) {
            const target = 1 << row
            if (!(target & freeSlots)) continue
            required = Number(!(target & mask))
          }
          const probability = cellChance * weights[request] / weightsTotal / masks.length * (required ? symbolChance : 1)
          add(result, key(open, Number(open > 0), lit, isFree ? regular : 0, isFree ? required : 0), probability)
        }
      }
    }
  }
  const resultArray = [...result]
  reelCache.set(id, resultArray)
  return resultArray
}
const prefixCache = new Map<string, number>()
function prefix(path: readonly number[], symbolChance: number, isFree: boolean) {
  if (!symbolChance) return 0
  const symmetric = path.map(row => row === 1 ? 1 : 0)
  const id = [symmetric.join(''), symbolChance, isFree].join('/')
  const known = prefixCache.get(id)
  if (known !== undefined) return known
  let totals = new Map([[0, 1]])
  for (let reel = 0; reel < 5; reel++) {
    const localMass = reelStates(reel === 0, symmetric[reel] ?? -1, symbolChance, isFree)
    const next = new Map<number, number>()
    for (const [state, weight] of totals) {
      for (const [increment, localWeight] of localMass) add(next, state + increment, weight * localWeight)
    }
    totals = next
  }
  let probability = 0
  for (const [state, mass] of totals) {
    const open = state & 15
    const reels = (state >> 4) & 7
    const lit = (state >> 7) & 7
    const regular = (state >> 10) & 15
    const required = (state >> 14) & 7
    const survivesExtraOrb = isFree && open >= 11 && regular > 0 ? 1 - BONUS.freeExtraOrbChance * required / regular : 1
    probability += mass * lanternFactor(open, reels, lit, isFree) * survivesExtraOrb
  }
  prefixCache.set(id, probability)
  return probability
}
for (const isFree of [false, true]) {
  assert(Math.abs(prefix([], 1, isFree) - 1) < 1e-11, 'Invalid unconditional board mass')
}
const creditTable: Record<string, Readonly<Partial<Record<number, number>>>> = LINE_CREDITS
const paths = LINE_OPTIONS.map(lines => {
  const lineCredits = [false, true].map(isFree => {
    const weights = REEL_SYMBOL_WEIGHTS[isFree ? 'free' : 'paid']
    assert(weights.every(w => w.every((p, i) => p === weights[0][i])), 'Reel-specific paying weights require local odds')
    let total = 0
    for (const [index, symbol] of REGULAR_SYMBOL_ORDER.entries()) {
      const chance = weights[0][index] / sum(weights[0])
      for (let length = symbol === 'tiger' ? 2 : 3; length <= 5; length++) {
        for (const path of PAYLINES.slice(0, lines)) {
          const atLeast = prefix(path.slice(0, length), chance, isFree)
          const longer = length < 5 ? prefix(path.slice(0, length + 1), chance, isFree) : 0
          total += (atLeast - longer) * (creditTable[symbol][length] ?? 0)
        }
      }
    }
    return total
  })
  return { lines, paidCredit: lineCredits[0], freeCredit: lineCredits[1] }
})

// Independently sum Lantern count odds over the original orb masks. The conditional factor
// is for one subset of reels, so multiply by the number of equivalent subsets.
function scatterOdds(isFree: boolean) {
  const odds = Array<number>(6).fill(0)
  for (let mask = 0; mask < 1 << 15; mask++) {
    let open = 0
    let reels = 0
    for (let reel = 0; reel < 5; reel++) {
      const positions = (mask >> (reel * 3)) & 7
      if (positions) reels++
      open += count(positions)
    }
    const mass = (1 - baseOrbChance) ** open * baseOrbChance ** (15 - open)
    for (let lit = 0; lit <= reels; lit++) {
      odds[lit] += mass * lanternFactor(open, reels, lit, isFree) * choose(reels, lit)
    }
  }
  assert(Math.abs(sum(odds) - 1) < 1e-10)
  return odds
}

// Memoize the terminal distribution after hits reset the counter and misses consume one turn.
const endings = new Map<string, number[]>()
function endCounts(held: number, remaining: number): number[] {
  const id = `${held}/${remaining}`
  const cached = endings.get(id)
  if (cached) return cached
  if (!remaining || held === 15) return Array.from({ length: 16 }, (_, i) => Number(i === held))
  const chance = BONUS.respinLandingRates.find(([limit]) => held < limit)![1]
  const empty = 15 - held
  const result = Array<number>(16).fill(0)
  for (let added = 0; added <= empty; added++) {
    const mass = choose(empty, added) * chance ** added * (1 - chance) ** (empty - added)
    endCounts(held + added, added ? BONUS.respins : remaining - 1)
      .forEach((p, i) => { result[i] += p * mass })
  }
  endings.set(id, result)
  return result
}

const paidOdds = scatterOdds(false)
const freeOdds = scatterOdds(true)
const paidEntry = sum(paidOdds.slice(3))
const freeEntry = sum(freeOdds.slice(3))
const freeBoards = paidEntry * LANTERN.initialSpins / (1 - freeEntry * LANTERN.extraSpins)
const scatter = (odds: number[]) => sum(odds.map((p, i) => p * (LANTERN.payouts[i as 3 | 4 | 5] ?? 0)))
const paidScatter = scatter(paidOdds)
const freeScatter = scatter(freeOdds) * freeBoards
const boardCounts = Array<number>(16).fill(0)
for (let held = BONUS.triggerCount; held <= 15; held++) {
  const initial = choose(15, held) * baseOrbChance ** held * (1 - baseOrbChance) ** (15 - held)
  endCounts(held, BONUS.respins).forEach((p, i) => { boardCounts[i] += p * initial })
}
assert(BONUS.grandAddsToOrbs, 'Grand should add to orb awards')
const holdEntry = sum(boardCounts)
const nOrbs = sum(boardCounts.map((p, i) => p * i)) * (1 + freeBoards)
const grandRate = boardCounts[15] * (1 + freeBoards)
const totalTypeWeight = sum(Object.values(DESIGN_B_ORB_TYPES))
const types = {
  ordinary: DESIGN_B_ORB_TYPES.ordinary / totalTypeWeight,
  mini: DESIGN_B_ORB_TYPES.mini / totalTypeWeight,
  minor: DESIGN_B_ORB_TYPES.minor / totalTypeWeight,
  major: DESIGN_B_ORB_TYPES.major / totalTypeWeight,
}
const mean = (distribution: readonly (readonly [number, number])[]) =>
  sum(distribution.map(([pay, weight]) => pay * weight)) / sum(distribution.map(([, weight]) => weight))

const rows = DENOMINATIONS_SEN.flatMap(denominationSen => BET_SIZES.flatMap(betSize => paths.map(path => {
  const betting = { denominationSen, betSize, lines: path.lines }
  const bet = totalBetSen(betting)
  const totalCredits = wagerCredits(betting)
  const prizes = calculateJackpots(denominationSen)
  const fixedSen = 5_000_000 * nOrbs * types.major + 20_000_000 * grandRate
  const targetMean = (0.92 - 0.393 - paidScatter - freeScatter -
    (nOrbs * (5_000 * types.mini + 20_000 * types.minor) + 0.5025 * fixedSen) / totalCredits) /
    (nOrbs * types.ordinary)
  const approvedMix = Math.round(10_000 * (targetMean - 1.147) / (2.634 - 1.147))
  assert.equal(ORB_HIGH_MIX_BPS[totalCredits], approvedMix)
  const weights = orbWeightsForWager({ denominationSen, bet })
  assert.equal(weights.length, 9)
  weights.forEach(([, weight], index) => {
    assert(weight > 0)
    assert(Math.abs(weight - (LOW_ORB_WEIGHTS[index] * (1 - approvedMix / 10_000) +
      HIGH_ORB_WEIGHTS[index] * approvedMix / 10_000)) < 1e-10)
  })
  const components = {
    paidLine: path.paidCredit / path.lines,
    paidScatter,
    freeLine: path.freeCredit * freeBoards / path.lines,
    freeScatter,
    ordinary: nOrbs * types.ordinary * mean(weights),
    mini: nOrbs * types.mini * prizes.mini / bet,
    minor: nOrbs * types.minor * prizes.minor / bet,
    major: nOrbs * types.major * prizes.major / bet,
    grand: grandRate * prizes.grand / bet,
  }
  const expected = expectedHoldPayout(denominationSen, bet)
  assert(Math.abs(expected.ordinaryOrbs / bet - components.ordinary) < 1e-11)
  for (const tier of ['mini', 'minor', 'major', 'grand'] as const) {
    assert(Math.abs(expected.jackpotPayouts[tier] / bet - components[tier]) < 1e-11)
  }
  const rtp = sum(Object.values(components))
  assert(rtp >= 0.91 && rtp <= 0.93)
  return { ...betting, bet, totalCredits, components, rtp }
})))

const published = readFileSync(new URL('../RTP_SCALING_DESIGN.md', import.meta.url), 'utf8')
  .split('### Full 200-preset theoretical RTP matrix')[1]
const approvedRows = [...published.matchAll(/^\| (\d+) \| (\d+) \| ([\d,.]+) \| ([\d.]+%) \| ([\d.]+%) \| ([\d.]+%) \| ([\d.]+%) \| ([\d.]+)% \| ([\d.]+%) \| ([\d.]+%) \| (\d+) \|$/gm)]
assert.equal(rows.length, 200)
assert.equal(approvedRows.length, rows.length)
let maxDisplayedDifference = 0
rows.forEach((row, index) => {
  const [, size, lines, wager, , , , , predicted] = approvedRows[index]
  assert.equal(row.betSize, Number(size))
  assert.equal(row.lines, Number(lines))
  assert.equal(row.bet, Math.round(Number(wager.replaceAll(',', '')) * 100))
  const difference = Math.abs(row.rtp * 100 - Number(predicted))
  assert(difference <= 0.00050001)
  maxDisplayedDifference = Math.max(difference, maxDisplayedDifference)
})
const minimum = rows.reduce((a, b) => a.rtp < b.rtp ? a : b)
const maximum = rows.reduce((a, b) => a.rtp > b.rtp ? a : b)
const result = { minimum, maximum, maxDisplayedDifference, holdEntry, paidEntry, freeEntry, freeBoards,
  finalOrbs: nOrbs / (1 + freeBoards) / holdEntry, sixOrbFinal: sum(endCounts(6, BONUS.respins).map((p, i) => p * i)),
  nOrbs, grandRate, types, rows }
const output = process.argv[2]
if (output) writeFileSync(output, JSON.stringify(result, null, 2) + '\n')
console.log(`Verified ${rows.length} wagers and nine payout components per wager. RTP ${(minimum.rtp * 100).toFixed(7)}–${(maximum.rtp * 100).toFixed(7)}%.`)
console.log(`Maximum difference from the published three-decimal estimates is ${maxDisplayedDifference.toFixed(7)} percentage points.`)

