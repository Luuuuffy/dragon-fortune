import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import {
  BET_SIZES, BONUS_REBALANCE_VERSION, CURRENT_MATH_VERSION, DENOMINATIONS_SEN, DESIGN_B_VERSION, LINE_OPTIONS, PAYLINES, LINE_CREDITS,
  EARLY_RESPIN_VERSION, LATE_RESPIN_VERSION, ORB_VARIETY_VERSION, calculateJackpots, totalBetSen, wagerCredits,
} from '../src/game/config'
import { BONUS } from '../src/game/bonusConfig'
import { LANTERN } from '../src/game/lanternConfig'
import { REEL_SYMBOL_WEIGHTS, REGULAR_SYMBOL_ORDER, WILD_STACK_WEIGHTS, NON_ORB_WEIGHT, DESIGN_B_ORB_TYPES,
  LOW_ORB_WEIGHTS, HIGH_ORB_WEIGHTS, ORB_HIGH_MIX_BPS, BONUS_REBALANCE_WILD_WEIGHTS, BONUS_REBALANCE_ORB_TYPES,
  BONUS_REBALANCE_LOW_WEIGHTS, BONUS_REBALANCE_HIGH_WEIGHTS, BONUS_REBALANCE_HIGH_MIX_BPS, BONUS_REBALANCE_RESPIN_RATES,
  CURRENT_ORB_TYPES, CURRENT_LOW_ORB_WEIGHTS, CURRENT_HIGH_ORB_WEIGHTS, CURRENT_ORB_HIGH_MIX_BPS, CURRENT_ORB_MULTIPLIERS,
  BONUS_REBALANCE_FREE_ORB_CHANCE, CURRENT_RESPIN_RATES, EARLY_RESPIN_HIGH_MIX_BPS, EARLY_RESPIN_RATES, FREE_ORB_CHANCE,
  LATE_RESPIN_HIGH_MIX_BPS, LATE_RESPIN_MINIMUM_MIX_BPS, LATE_RESPIN_RATES, MINIMUM_WAGER_ORB_HIGH_MIX_BPS,
  ORB_VARIETY_HIGH_MIX_BPS, ORB_VARIETY_HIGH_WEIGHTS, ORB_VARIETY_LOW_WEIGHTS, ORB_VARIETY_PAID_ORB_CHANCE,
  PAID_ORB_CHANCE } from '../src/game/probabilityConfig'
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
const previousOrbChance = BONUS.baseOrbWeight / (NON_ORB_WEIGHT + BONUS.baseOrbWeight)
const versionFlags = {
  '--design-b': DESIGN_B_VERSION,
  '--profile-5': BONUS_REBALANCE_VERSION,
  '--profile-6': ORB_VARIETY_VERSION,
  '--profile-7': EARLY_RESPIN_VERSION,
  '--profile-8': LATE_RESPIN_VERSION,
} as const
const versionFlag = Object.keys(versionFlags).find(flag => process.argv.includes(flag)) as keyof typeof versionFlags | undefined
const version = versionFlag ? versionFlags[versionFlag] : CURRENT_MATH_VERSION
const designB = version === DESIGN_B_VERSION
const current = version === CURRENT_MATH_VERSION
const expandedOrbs = version >= ORB_VARIETY_VERSION
function boardChance(isFree: boolean) {
  if (current) return isFree ? FREE_ORB_CHANCE : PAID_ORB_CHANCE
  if (isFree) return designB ? previousOrbChance : BONUS_REBALANCE_FREE_ORB_CHANCE
  return expandedOrbs ? ORB_VARIETY_PAID_ORB_CHANCE : previousOrbChance
}
const respinRates = {
  [DESIGN_B_VERSION]: BONUS.respinLandingRates,
  [BONUS_REBALANCE_VERSION]: BONUS_REBALANCE_RESPIN_RATES,
  [ORB_VARIETY_VERSION]: BONUS_REBALANCE_RESPIN_RATES,
  [EARLY_RESPIN_VERSION]: EARLY_RESPIN_RATES,
  [LATE_RESPIN_VERSION]: LATE_RESPIN_RATES,
  [CURRENT_MATH_VERSION]: CURRENT_RESPIN_RATES,
}[version]
const wildWeights = designB ? WILD_STACK_WEIGHTS : BONUS_REBALANCE_WILD_WEIGHTS
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
  const orbChance = boardChance(isFree)
  const id = [first, row, symbolChance, isFree].join('/')
  const known = reelCache.get(id)
  if (known) return known
  const result = new Map<number, number>()
  const weights = first ? [1] : isFree ? wildWeights.free : wildWeights.paid
  const weightsTotal = sum(weights)
  for (let openMask = 0; openMask < 8; openMask++) {
    const open = count(openMask)
    const maskChance = (1 - orbChance) ** open * orbChance ** (3 - open)
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
  const orbChance = boardChance(isFree)
  let withHold = 0
  for (let mask = 0; mask < 1 << 15; mask++) {
    let open = 0
    let reels = 0
    for (let reel = 0; reel < 5; reel++) {
      const positions = (mask >> (reel * 3)) & 7
      if (positions) reels++
      open += count(positions)
    }
    const mass = (1 - orbChance) ** open * orbChance ** (15 - open)
    for (let lit = 0; lit <= reels; lit++) {
      const probability = mass * lanternFactor(open, reels, lit, isFree) * choose(reels, lit)
      odds[lit] += probability
      if (lit >= 3 && 15 - open >= BONUS.triggerCount) withHold += probability
    }
  }
  assert(Math.abs(sum(odds) - 1) < 1e-10)
  return { odds, withHold }
}

// Memoize the terminal distribution after hits reset the counter and misses consume one turn.
const endings = new Map<string, number[]>()
function endCounts(held: number, remaining: number): number[] {
  const id = `${held}/${remaining}`
  const cached = endings.get(id)
  if (cached) return cached
  if (!remaining || held === 15) return Array.from({ length: 16 }, (_, i) => Number(i === held))
  const chance = respinRates.find(([limit]) => held < limit)![1]
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

const { odds: paidOdds } = scatterOdds(false)
const { odds: freeOdds, withHold: freeScatterWithHold } = scatterOdds(true)
const paidEntry = sum(paidOdds.slice(3))
const freeEntry = sum(freeOdds.slice(3))
const freeBoards = paidEntry * LANTERN.initialSpins / (1 - freeEntry * LANTERN.extraSpins)
const scatter = (odds: number[]) => sum(odds.map((p, i) => p * (LANTERN.payouts[i as 3 | 4 | 5] ?? 0)))
const paidScatter = scatter(paidOdds)
const freeScatter = scatter(freeOdds) * freeBoards
function boardCounts(orbChance: number) {
  const counts = Array<number>(16).fill(0)
  for (let held = BONUS.triggerCount; held <= 15; held++) {
    const initial = choose(15, held) * orbChance ** held * (1 - orbChance) ** (15 - held)
    endCounts(held, BONUS.respins).forEach((p, i) => { counts[i] += p * initial })
  }
  return counts
}
assert(BONUS.grandAddsToOrbs, 'Grand should add to orb awards')
const paidCounts = boardCounts(boardChance(false))
const freeCounts = boardCounts(boardChance(true))
const holdEntry = sum(paidCounts)
const freeHoldEntry = sum(freeCounts)
const awardedOrbs = (counts: number[]) => sum(counts.map((p, i) => p * i))
const paidOrbs = awardedOrbs(paidCounts)
const freeOrbs = awardedOrbs(freeCounts)
const nOrbs = paidOrbs + freeBoards * freeOrbs
const grandRate = paidCounts[15] + freeBoards * freeCounts[15]
// A free spin with no Hold trigger either ends that branch or awards three more spins.
let noHoldBranch = 1
for (let step = 0; step < 40; step++) {
  noHoldBranch = 1 - freeHoldEntry - freeEntry + freeScatterWithHold +
    (freeEntry - freeScatterWithHold) * noHoldBranch ** LANTERN.extraSpins
}
const freeFeatureWithHold = 1 - noHoldBranch ** LANTERN.initialSpins
if (current) assert(Math.abs(freeFeatureWithHold - 1 / 3) < 0.00001, 'Expected Hold & Spin in one-third of Lantern features')
const typeWeights = expandedOrbs ? CURRENT_ORB_TYPES : designB ? DESIGN_B_ORB_TYPES : BONUS_REBALANCE_ORB_TYPES
const totalTypeWeight = sum(Object.values(typeWeights))
const types = {
  ordinary: typeWeights.ordinary / totalTypeWeight,
  mini: typeWeights.mini / totalTypeWeight,
  minor: typeWeights.minor / totalTypeWeight,
  major: typeWeights.major / totalTypeWeight,
}
const mean = (distribution: readonly (readonly [number, number])[]) =>
  sum(distribution.map(([pay, weight]) => pay * weight)) / sum(distribution.map(([, weight]) => weight))

const wagers = DENOMINATIONS_SEN.flatMap(denominationSen => BET_SIZES.flatMap(betSize => paths.map(path => {
  const betting = { denominationSen, betSize, lines: path.lines }
  const bet = totalBetSen(betting)
  const totalCredits = wagerCredits(betting)
  const prizes = calculateJackpots(denominationSen)
  const fixed = {
    paidLine: path.paidCredit / path.lines,
    paidScatter,
    freeLine: path.freeCredit * freeBoards / path.lines,
    freeScatter,
    mini: nOrbs * types.mini * prizes.mini / bet,
    minor: nOrbs * types.minor * prizes.minor / bet,
    major: nOrbs * types.major * prizes.major / bet,
    grand: grandRate * prizes.grand / bet,
  }
  return { ...betting, bet, totalCredits, fixed }
})))

const low = current ? CURRENT_LOW_ORB_WEIGHTS : expandedOrbs ? ORB_VARIETY_LOW_WEIGHTS
  : designB ? LOW_ORB_WEIGHTS : BONUS_REBALANCE_LOW_WEIGHTS
const high = current ? CURRENT_HIGH_ORB_WEIGHTS : expandedOrbs ? ORB_VARIETY_HIGH_WEIGHTS
  : designB ? HIGH_ORB_WEIGHTS : BONUS_REBALANCE_HIGH_WEIGHTS
const multipliers = expandedOrbs ? CURRENT_ORB_MULTIPLIERS : BONUS.orbMultiplierWeights.map(([multiplier]) => multiplier)
const publishedMix = {
  [DESIGN_B_VERSION]: ORB_HIGH_MIX_BPS,
  [BONUS_REBALANCE_VERSION]: BONUS_REBALANCE_HIGH_MIX_BPS,
  [ORB_VARIETY_VERSION]: ORB_VARIETY_HIGH_MIX_BPS,
  [EARLY_RESPIN_VERSION]: EARLY_RESPIN_HIGH_MIX_BPS,
  [LATE_RESPIN_VERSION]: LATE_RESPIN_HIGH_MIX_BPS,
  [CURRENT_MATH_VERSION]: CURRENT_ORB_HIGH_MIX_BPS,
}[version]
const average = (weights: readonly number[]) => mean(multipliers.map((multiplier, i) => [multiplier, weights[i]]))
const minimumCredits = BET_SIZES[0] * LINE_OPTIONS[0]
const minimumDenomination = DENOMINATIONS_SEN[0]
const rows = wagers.map(({ fixed, ...wager }) => {
  const { denominationSen, bet, totalCredits } = wager
  const separateMinimum = version >= LATE_RESPIN_VERSION && totalCredits === minimumCredits
  const minimumWager = separateMinimum && denominationSen === minimumDenomination
  const fixedReturns = wagers.filter(row => row.totalCredits === totalCredits &&
    (!separateMinimum || (row.denominationSen === minimumDenomination) === minimumWager))
    .map(row => sum(Object.values(row.fixed)))
  const fixedSen = 5_000_000 * nOrbs * types.major + 20_000_000 * grandRate
  const targetMean = ((current ? 0.985 : 0.92) - (designB ? 0.393 + paidScatter + freeScatter +
    (nOrbs * (5_000 * types.mini + 20_000 * types.minor) + 0.5025 * fixedSen) / totalCredits :
    (Math.min(...fixedReturns) + Math.max(...fixedReturns)) / 2)) / (nOrbs * types.ordinary)
  const mix = Math.round(10_000 * (targetMean - average(low)) / (average(high) - average(low)))
  const minimumMix = current ? MINIMUM_WAGER_ORB_HIGH_MIX_BPS : LATE_RESPIN_MINIMUM_MIX_BPS
  assert.equal(minimumWager ? minimumMix : publishedMix[totalCredits], mix)
  const weights = orbWeightsForWager({ denominationSen, bet, paytableVersion: version })
  assert.equal(weights.length, multipliers.length)
  weights.forEach(([multiplier, weight], index) => {
    assert.equal(multiplier, multipliers[index])
    assert(weight > 0)
    assert(Math.abs(weight - (low[index] * (1 - mix / 10_000) + high[index] * mix / 10_000)) < 1e-10)
  })
  const components = { ...fixed, ordinary: nOrbs * types.ordinary * mean(weights) }
  const expected = expectedHoldPayout(denominationSen, bet, false, BONUS.grandAddsToOrbs, version)
  assert(Math.abs(expected.ordinaryOrbs / bet - components.ordinary) < 1e-11)
  for (const tier of ['mini', 'minor', 'major', 'grand'] as const) {
    assert(Math.abs(expected.jackpotPayouts[tier] / bet - components[tier]) < 1e-11)
  }
  const rtp = sum(Object.values(components))
  assert(current ? rtp < 1 : rtp >= 0.91 && rtp <= 0.93)
  return { ...wager, components, rtp }
})

assert.equal(rows.length, 200)
if (designB) {
  const published = readFileSync(new URL('../RTP_SCALING_DESIGN.md', import.meta.url), 'utf8')
    .split('### Full 200-preset theoretical RTP matrix')[1]
  const approvedRows = [...published.matchAll(/^\| (\d+) \| (\d+) \| ([\d,.]+) \| (?:[\d.]+% \| ){4}([\d.]+)% \| (?:[\d.]+% \| ){2}(\d+) \|$/gm)]
  assert.equal(approvedRows.length, rows.length)
  rows.forEach((row, index) => {
    const [, size, lines, wager, predicted] = approvedRows[index]
    assert.equal(row.betSize, Number(size))
    assert.equal(row.lines, Number(lines))
    assert.equal(row.bet, Math.round(Number(wager.replaceAll(',', '')) * 100))
    assert(Math.abs(row.rtp * 100 - Number(predicted)) <= 0.00050001)
  })
}
const minimum = rows.reduce((a, b) => a.rtp < b.rtp ? a : b)
const maximum = rows.reduce((a, b) => a.rtp > b.rtp ? a : b)
const benchmarkWager = rows.find(row => row.denominationSen === 10 && row.betSize === 1 && row.lines === 8)!
const holdFrequency = holdEntry + freeBoards * freeHoldEntry
const { ordinary, mini, minor, major, grand } = benchmarkWager.components
const benchmarkWeights = orbWeightsForWager({ ...benchmarkWager, paytableVersion: version })
const totalOrbWeight = sum(benchmarkWeights.map(([, weight]) => weight))
// Below MINI, every payout consists solely of ordinary orbs and comes from an incomplete grid.
const payoutLimit = Math.ceil(calculateJackpots(benchmarkWager.denominationSen).mini / benchmarkWager.bet) - 1
const hitDistribution = Array<number>(payoutLimit + 1).fill(0)
let orbSums = hitDistribution.map((_, payout) => Number(payout === 0))
for (let held = 1; held < 15; held++) {
  orbSums = orbSums.map((_, payout) => benchmarkWeights.reduce((probability, [multiplier, weight]) =>
    probability + (orbSums[payout - multiplier] ?? 0) * weight / totalOrbWeight, 0))
  const chance = (paidCounts[held] + freeBoards * freeCounts[held]) * types.ordinary ** held / holdFrequency
  orbSums.forEach((probability, payout) => { hitDistribution[payout] += probability * chance })
}
let cumulative = 0
const median = hitDistribution.findIndex(probability => (cumulative += probability) >= 0.5)
assert(median >= 0)
const benchmark = {
  rtp: benchmarkWager.rtp,
  betSen: benchmarkWager.bet,
  medianPayoutSen: median * benchmarkWager.bet,
  meanOrdinaryPayoutSen: ordinary * benchmarkWager.bet / holdFrequency,
  meanPayoutSen: (ordinary + mini + minor + major + grand) * benchmarkWager.bet / holdFrequency,
  payoutUnderRm10: sum(hitDistribution.slice(0, Math.ceil(1000 / benchmarkWager.bet))),
  chanceOrbAtLeast4x: sum(benchmarkWeights.filter(([multiplier]) => multiplier >= 4).map(([, weight]) => weight)) / totalOrbWeight,
  chanceOrbAtLeast8x: sum(benchmarkWeights.filter(([multiplier]) => multiplier >= 8).map(([, weight]) => weight)) / totalOrbWeight,
}
if (current) {
  assert(benchmark.medianPayoutSen >= 2500, 'Expected at least RM25 median Hold & Spin payout at RM0.80')
  assert(benchmark.chanceOrbAtLeast4x > 0.44, 'Expected larger ordinary Gold Orbs')
}
const sixOrbEndings = endCounts(6, BONUS.respins)
const tenOrbHitsAgain = sum(endCounts(10, BONUS.respins).slice(11))
const elevenOrbHitsAgain = sum(endCounts(11, BONUS.respins).slice(12))
const result = { version, minimum, maximum, holdEntry, freeHoldEntry, freeFeatureWithHold, paidEntry, freeEntry, freeBoards,
  finalOrbs: paidOrbs / holdEntry, freeFinalOrbs: freeOrbs / freeHoldEntry, sixOrbFinal: awardedOrbs(sixOrbEndings),
  sixOrbReachesTen: sum(sixOrbEndings.slice(10)), sixOrbNoNew: sixOrbEndings[6], tenOrbHitsAgain, elevenOrbHitsAgain,
  nOrbs, grandRate, types, benchmark, rows }
const output = process.argv.slice(2).find(arg => arg !== versionFlag)
if (output) writeFileSync(output, JSON.stringify(result, null, 2) + '\n')
console.log(`Verified math profile ${version} across ${rows.length} wagers. RTP ${(minimum.rtp * 100).toFixed(7)}–${(maximum.rtp * 100).toFixed(7)}%.`)
console.log(`Hold & Spin entry: ${(holdEntry * 100).toFixed(4)}% paid, ${(freeHoldEntry * 100).toFixed(4)}% per free spin, ${(freeFeatureWithHold * 100).toFixed(4)}% per Lantern feature.`)
console.log(`Chance of another orb with three respins left: ${(tenOrbHitsAgain * 100).toFixed(2)}% with ten held, ${(elevenOrbHitsAgain * 100).toFixed(2)}% with eleven held.`)
console.log(`At RM0.80: median Hold & Spin RM${(benchmark.medianPayoutSen / 100).toFixed(2)}, mean ordinary orbs RM${(benchmark.meanOrdinaryPayoutSen / 100).toFixed(2)}, jackpot-inclusive mean RM${(benchmark.meanPayoutSen / 100).toFixed(2)}.`)

