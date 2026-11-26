import {
  BALANCED_BONUS_VERSION, BONUS_REBALANCE_VERSION, CELLS, CREDIT_PAYTABLE_VERSION, CREDIT_V3_LINE_AWARDS, CURRENT_MATH_VERSION,
  DEFAULT_BETTING, DESIGN_B_VERSION, JACKPOT_TIERS, LEGACY_SYMBOLS, LINE_CREDITS, MATCHED_LANTERN_VERSION,
  ORB_VARIETY_VERSION, RICH_BONUS_VERSION,
  PAYLINES, REELS, ROWS, SYMBOLS, cellAt, totalBetSen,
} from './config'
import { BONUS, binomial, respinLandingChance } from './bonusConfig'
import { LANTERN, LEGACY_LANTERN_PAYOUTS } from './lanternConfig'
import { BALANCED_BONUS_FREE_CHANCE, BALANCED_BONUS_ORB_TYPES, BONUS_REBALANCE_FREE_ORB_CHANCE, BONUS_REBALANCE_ORB_TYPES, BONUS_REBALANCE_WILD_WEIGHTS,
  CREDIT_V3_FREE_WEIGHTS, CREDIT_V3_WILD_WEIGHTS, CURRENT_FREE_LANTERN_COUNT_WEIGHTS, CURRENT_FREE_WILD_WEIGHTS,
  CURRENT_LANTERN_WEIGHT, CURRENT_ORB_TYPES, DESIGN_B_ORB_TYPES,
  FREE_ORB_CHANCE, NON_ORB_WEIGHT, ORB_VARIETY_PAID_ORB_CHANCE, ORB_VARIETY_TYPES, PAID_ORB_CHANCE,
  RICH_BONUS_FREE_CHANCE, RICH_BONUS_PAID_CHANCE,
  REEL_SYMBOL_WEIGHTS, REEL_WILD_ALLOWED, REGULAR_SYMBOL_ORDER, WILD_STACK_WEIGHTS } from './probabilityConfig'
import { calculateOrbPrize, ordinaryOrbDistributions, orbMultiplierWeights, orbWeightsForWager, priceWagerOrb } from './orbPrizes'
import type { Orb, OrbWager } from './orbPrizes'
import type { Jackpot, JackpotPrizes, PaytableVersion, SymbolId } from './config'

export type Random = () => number
export type { Orb } from './orbPrizes'
export type Slots = (Orb | null)[]
export type LineWin = { line: number; symbol: SymbolId; positions: number[]; multiplier: number }
export type Award = { tier: Jackpot; amount: number }
export type Result = {
  spinId: string
  bonusId: string | null
  bet: number
  lines: LineWin[]
  line: number
  scatter?: number
  freeSpins?: number
  jackpotCounts?: Record<Jackpot, number>
  jackpotPrizes?: JackpotPrizes
  bonus: number
  jackpot: number
  awards: Award[]
  total: number
}
export type Scenario = keyof typeof SCENARIOS
export const SCENARIOS = {
  line: 'Regular line win',
  multi: 'Multiple line wins',
  oneOrb: 'One gold orb',
  six: 'Six-orb trigger (all respins miss)',
  sixThenHit: 'Six orbs → seventh on first respin',
  seven: 'Seven-orb trigger',
  mini: 'MINI jackpot orb',
  minor: 'MINOR jackpot orb',
  major: 'MAJOR jackpot orb',
  grand: 'GRAND on first respin',
  full: 'Full grid on base spin',
  none: 'No-win spin',
  insufficient: 'Insufficient balance',
  lantern3: 'Exactly 3 Lanterns → 6 free spins',
  lantern4: 'Exactly 4 Lanterns → 6 free spins',
  lantern5: 'Exactly 5 Lanterns → 6 free spins',
  lanternRetrigger: 'One Free Spins retrigger',
  lanternRepeat: 'Three consecutive retriggers',
  lanternNoWin: 'Six losing Free Spins → completion',
  lanternBoth: 'Paid spin triggers both bonuses',
  lanternQueued: 'Hold & Spin during Free Spins',
} as const
const lanternScenarios: Partial<Record<Scenario, number>> = {
  lantern3: 3, lantern4: 4, lantern5: 5, lanternRetrigger: 3, lanternRepeat: 3,
  lanternNoWin: 3, lanternBoth: 3, lanternQueued: 3,
}

export function freeSpinScenario(root: Scenario | undefined, number: number): Scenario | undefined {
  if (!root || !lanternScenarios[root]) return undefined
  if ((root === 'lanternRetrigger' && number === 1) || (root === 'lanternRepeat' && number <= 3)) return 'lantern3'
  if (root === 'lanternQueued' && number === 1) return 'six'
  return 'none'
}

export const secureRandom: Random = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32

export function seededRandom(seed: number): Random {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 2 ** 32
  }
}

function weighted<T>(items: readonly (readonly [T, number])[]) {
  const total = items.reduce((sum, [, weight]) => sum + weight, 0)
  return (rng: Random): T => {
    let roll = rng() * total
    for (const [item, weight] of items) {
      roll -= weight
      if (roll < 0) return item
    }
    return items[items.length - 1][0]
  }
}

const legacyPayingSymbols = (Object.keys(LEGACY_SYMBOLS) as (keyof typeof LEGACY_SYMBOLS)[])
  .filter(symbol => LEGACY_SYMBOLS[symbol].pays)
const symbolTotal = NON_ORB_WEIGHT + BONUS.baseOrbWeight
if (!Number.isFinite(NON_ORB_WEIGHT) || NON_ORB_WEIGHT <= 0 ||
    !Number.isFinite(symbolTotal) || BONUS.baseOrbWeight < 0) {
  throw new RangeError('Symbol weights must be finite and nonnegative.')
}
const previousOrbChance = BONUS.baseOrbWeight / symbolTotal
export const baseOrbChance = PAID_ORB_CHANCE
export function boardOrbChance(free: boolean, version: PaytableVersion = CURRENT_MATH_VERSION) {
  if (version >= MATCHED_LANTERN_VERSION) return free ? FREE_ORB_CHANCE : baseOrbChance
  if (version === BALANCED_BONUS_VERSION) return free ? BALANCED_BONUS_FREE_CHANCE : baseOrbChance
  if (version === RICH_BONUS_VERSION) return free ? RICH_BONUS_FREE_CHANCE : RICH_BONUS_PAID_CHANCE
  if (free) return version >= BONUS_REBALANCE_VERSION ? BONUS_REBALANCE_FREE_ORB_CHANCE : previousOrbChance
  return version >= ORB_VARIETY_VERSION ? ORB_VARIETY_PAID_ORB_CHANCE : previousOrbChance
}
const reelPositions = Array.from({ length: REELS }, (_, reel) =>
  Array.from({ length: ROWS }, (_, row) => cellAt(reel, row)))

export function lanternReels(lanternWeight: number,
  weights: readonly [number, number, number] | readonly [number, number, number, number, number, number],
  stackWeights: readonly [number, number, number, number] = WILD_STACK_WEIGHTS.paid,
  reelWeights: readonly (readonly number[])[] = REEL_SYMBOL_WEIGHTS.paid,
  orbChance = baseOrbChance) {
  const weightsByCount = weights.length === 3 ? [1, 1, 1, ...weights] : weights
  if (!Number.isFinite(lanternWeight) || lanternWeight < 0 || lanternWeight >= NON_ORB_WEIGHT ||
      weightsByCount.some(weight => !Number.isFinite(weight) || weight < 0) || weightsByCount[0] <= 0 ||
      !Number.isFinite(orbChance) || orbChance < 0 || orbChance > 1) {
    throw new Error('Provide valid Lantern weights and an orb probability between zero and one.')
  }
  const stackTotal = stackWeights.reduce((sum, weight) => sum + weight, 0)
  if (stackWeights.some(weight => !Number.isFinite(weight) || weight < 0) || !Number.isFinite(stackTotal) || stackTotal <= 0) {
    throw new RangeError('Configure finite, nonnegative Panda Wild stack weights with a positive total.')
  }
  const drawStack = weighted(stackWeights.map((weight, size) => [size, weight] as const))
  if (reelWeights.length !== REELS || reelWeights.some(weights =>
    weights.length !== REGULAR_SYMBOL_ORDER.length || weights.some(weight => !Number.isFinite(weight) || weight < 0) ||
    !Number.isFinite(weights.reduce((sum, weight) => sum + weight, 0)) || !weights.some(weight => weight > 0))) {
    throw new RangeError('Provide a finite paying-symbol weight table for each reel.')
  }
  const drawRegular = reelWeights.map(weights =>
    weighted<SymbolId>(REGULAR_SYMBOL_ORDER.map((symbol, index) => [symbol, weights[index]] as const)))

  // Keep the existing scatter count draw, capped by the number of reels with space for a Lantern.
  const countOdds = Array.from({ length: CELLS + 1 }, (_, positions) => {
    const probabilities = binomial(positions, lanternWeight / NON_ORB_WEIGHT)
    return Array.from({ length: REELS + 1 }, (_, reels) => {
      const capped = probabilities.slice(0, reels)
      capped.push(probabilities.slice(reels).reduce((sum, chance) => sum + chance, 0))
      const adjusted = capped.map((chance, count) => chance * weightsByCount[count])
      const total = adjusted.reduce((sum, chance) => sum + chance, 0)
      return adjusted.map(chance => chance / total)
    })
  })
  const reelOpenOdds = binomial(ROWS, 1 - orbChance)
  let boardOpenOdds = [{ cells: 0, reels: 0, chance: 1 }]
  for (let reel = 0; reel < REELS; reel++) {
    boardOpenOdds = boardOpenOdds.flatMap(board => reelOpenOdds.map((chance, cells) => ({
      cells: board.cells + cells, reels: board.reels + Number(cells > 0), chance: board.chance * chance,
    })))
  }
  const odds = Array<number>(REELS + 1).fill(0)
  boardOpenOdds.forEach(({ cells, reels, chance }) => {
    countOdds[cells][reels].forEach((conditional, count) => { odds[count] += chance * conditional })
  })
  const drawCount = countOdds.map(distributions => distributions.map(distribution =>
    weighted(distribution.map((chance, count) => [count, chance] as const))))
  return {
    odds,
    drawBoard(rng: Random) {
      const board = Array.from({ length: CELLS }, (): SymbolId | null => rng() >= 1 - orbChance ? 'orb' : null)
      const openReels = reelPositions.map(positions => positions.filter(position => board[position] === null))
        .filter(positions => positions.length > 0)
      const openCount = openReels.reduce((sum, positions) => sum + positions.length, 0)
      const count = openCount ? drawCount[openCount][openReels.length](rng) : 0
      for (let index = 0; index < count; index++) {
        const other = index + Math.floor(rng() * (openReels.length - index))
        const positions = openReels[other]
        openReels[other] = openReels[index]
        openReels[index] = positions
        board[positions[Math.floor(rng() * positions.length)]] = 'lantern'
      }
      for (const positions of openReels) {
        if (!REEL_WILD_ALLOWED[Math.floor(positions[0] / ROWS)]) continue
        const available = positions.filter(position => board[position] === null)
        // A Lantern or Gold Orb splits a stack. Use the longest requested streak that fits.
        for (let size = Math.min(available.length, drawStack(rng)); size > 0; size--) {
          const starts = available.filter((position, index) => available[index + size - 1] === position + size - 1)
          if (!starts.length) continue
          const start = starts[Math.floor(rng() * starts.length)]
          for (let offset = 0; offset < size; offset++) board[start + offset] = 'wild'
          break
        }
      }
      return board.map((symbol, index) => symbol ?? drawRegular[Math.floor(index / ROWS)](rng))
    },
  }
}
const paidReels = lanternReels(CURRENT_LANTERN_WEIGHT, LANTERN.paidTierWeights, BONUS_REBALANCE_WILD_WEIGHTS.paid)
const freeReels = lanternReels(CURRENT_LANTERN_WEIGHT, CURRENT_FREE_LANTERN_COUNT_WEIGHTS, CURRENT_FREE_WILD_WEIGHTS,
  REEL_SYMBOL_WEIGHTS.free, FREE_ORB_CHANCE)
const balancedBonusPaidReels = lanternReels(LANTERN.paidWeight, LANTERN.paidTierWeights, BONUS_REBALANCE_WILD_WEIGHTS.paid)
const balancedBonusFreeReels = lanternReels(LANTERN.freeWeight, LANTERN.freeTierWeights, CURRENT_FREE_WILD_WEIGHTS,
  REEL_SYMBOL_WEIGHTS.free, BALANCED_BONUS_FREE_CHANCE)
const richBonusPaidReels = lanternReels(LANTERN.paidWeight, LANTERN.paidTierWeights, BONUS_REBALANCE_WILD_WEIGHTS.paid,
  REEL_SYMBOL_WEIGHTS.paid, RICH_BONUS_PAID_CHANCE)
const richBonusFreeReels = lanternReels(LANTERN.freeWeight, LANTERN.freeTierWeights, BONUS_REBALANCE_WILD_WEIGHTS.free,
  REEL_SYMBOL_WEIGHTS.free, RICH_BONUS_FREE_CHANCE)
const varietyPaidReels = lanternReels(LANTERN.paidWeight, LANTERN.paidTierWeights, BONUS_REBALANCE_WILD_WEIGHTS.paid,
  REEL_SYMBOL_WEIGHTS.paid, ORB_VARIETY_PAID_ORB_CHANCE)
const rebalanceFreeReels = lanternReels(LANTERN.freeWeight, LANTERN.freeTierWeights, BONUS_REBALANCE_WILD_WEIGHTS.free,
  REEL_SYMBOL_WEIGHTS.free, BONUS_REBALANCE_FREE_ORB_CHANCE)
const rebalancePaidReels = lanternReels(LANTERN.paidWeight, LANTERN.paidTierWeights, BONUS_REBALANCE_WILD_WEIGHTS.paid,
  REEL_SYMBOL_WEIGHTS.paid, previousOrbChance)
const designBPaidReels = lanternReels(LANTERN.paidWeight, LANTERN.paidTierWeights, WILD_STACK_WEIGHTS.paid,
  REEL_SYMBOL_WEIGHTS.paid, previousOrbChance)
const designBFreeReels = lanternReels(LANTERN.freeWeight, LANTERN.freeTierWeights, WILD_STACK_WEIGHTS.free,
  REEL_SYMBOL_WEIGHTS.free, previousOrbChance)
const previousPaidReels = lanternReels(LANTERN.paidWeight, LANTERN.paidTierWeights, CREDIT_V3_WILD_WEIGHTS.paid,
  REEL_SYMBOL_WEIGHTS.paid, previousOrbChance)
const creditV3FreeReels = lanternReels(LANTERN.freeWeight, LANTERN.freeTierWeights, CREDIT_V3_WILD_WEIGHTS.free,
  CREDIT_V3_FREE_WEIGHTS, previousOrbChance)
const legacyFreeReels = lanternReels(LANTERN.freeWeight, LANTERN.freeTierWeights, CREDIT_V3_WILD_WEIGHTS.free,
  REEL_SYMBOL_WEIGHTS.paid, previousOrbChance)

function reelsFor(free: boolean, version: PaytableVersion) {
  if (version >= MATCHED_LANTERN_VERSION) return free ? freeReels : paidReels
  if (version === BALANCED_BONUS_VERSION) return free ? balancedBonusFreeReels : balancedBonusPaidReels
  if (version === RICH_BONUS_VERSION) return free ? richBonusFreeReels : richBonusPaidReels
  if (free) {
    if (version >= BONUS_REBALANCE_VERSION) return rebalanceFreeReels
    if (version === DESIGN_B_VERSION) return designBFreeReels
    return version === CREDIT_PAYTABLE_VERSION ? creditV3FreeReels : legacyFreeReels
  }
  if (version >= ORB_VARIETY_VERSION) return varietyPaidReels
  if (version === BONUS_REBALANCE_VERSION) return rebalancePaidReels
  return version === DESIGN_B_VERSION ? designBPaidReels : previousPaidReels
}
export const lanternCountOdds = (free: boolean, version: PaytableVersion = CURRENT_MATH_VERSION) => reelsFor(free, version).odds
if (lanternCountOdds(true).slice(3).reduce((sum, chance) => sum + chance, 0) * LANTERN.extraSpins >= 1) {
  throw new Error('Free Spin Lantern weight must keep expected retrigger awards below one per spin.')
}
const freeExtraOrbChance: number = BONUS.freeExtraOrbChance
if (!Number.isFinite(freeExtraOrbChance) || freeExtraOrbChance < 0 || freeExtraOrbChance > 1) {
  throw new RangeError('The extra Free Spin orb chance must be between zero and one.')
}
const multiplierDraws = new Map([orbMultiplierWeights, ...ordinaryOrbDistributions].map(weights => [weights, weighted(weights)]))
const paylinePositions = PAYLINES.map(rows => rows.map((row, reel) => cellAt(reel, row)))
const demoMultiplier = orbMultiplierWeights[1]?.[0] ?? orbMultiplierWeights[0][0]
const orbTypes = ['ordinary', 'mini', 'minor', 'major'] as const
function orbTypeTable(weights: Readonly<Record<typeof orbTypes[number], number>>) {
  const types = orbTypes.map(type => [type, weights[type]] as const)
  const total = types.reduce((sum, [, weight]) => sum + weight, 0)
  if (types.some(([, weight]) => !Number.isFinite(weight) || weight < 0) || !Number.isFinite(total) || total <= 0) {
    throw new RangeError('Configure nonnegative orb-type weights with a positive total.')
  }
  return { draw: weighted(types.filter(([, weight]) => weight > 0)),
    probabilities: types.map(([type, weight]) => [type, weight / total] as const) }
}
const designBOrbTypes = orbTypeTable(DESIGN_B_ORB_TYPES)
const rebalanceOrbTypes = orbTypeTable(BONUS_REBALANCE_ORB_TYPES)
const currentOrbTypes = orbTypeTable(CURRENT_ORB_TYPES)
const balancedBonusOrbTypes = orbTypeTable(BALANCED_BONUS_ORB_TYPES)
const varietyOrbTypes = orbTypeTable(ORB_VARIETY_TYPES)
const previousOrbTypes = orbTypeTable(BONUS.orbTypeWeights)
function orbTypesForVersion(version: PaytableVersion = CURRENT_MATH_VERSION) {
  if (version === CURRENT_MATH_VERSION) return currentOrbTypes
  if (version >= BALANCED_BONUS_VERSION) return balancedBonusOrbTypes
  if (version >= ORB_VARIETY_VERSION) return varietyOrbTypes
  if (version === BONUS_REBALANCE_VERSION) return rebalanceOrbTypes
  return version === DESIGN_B_VERSION ? designBOrbTypes : previousOrbTypes
}
export const orbTypeProbabilities = (version?: PaytableVersion) => orbTypesForVersion(version).probabilities

export const sampleBoard = (): SymbolId[] => [
  'tiger', 'K', 'boat', '9', 'lotus', 'chicken', 'lotus', 'wild', 'Q',
  'chicken', 'orb', '10', 'boat', 'tiger', 'lotus',
]

// The showroom board and old saves without stored face values use a fixed sample.
export const sampleOrbs = (board: SymbolId[], betting = DEFAULT_BETTING): Slots =>
  board.map(symbol => symbol === 'orb' ? calculateOrbPrize(betting.denominationSen,
    totalBetSen(betting), orbMultiplierWeights[0][0]) : null)

export function generateBoard(rng: Random, scenario?: Scenario, free = false, version: PaytableVersion = CURRENT_MATH_VERSION): SymbolId[] {
  const freeSymbols = free && version >= CREDIT_PAYTABLE_VERSION
  if (!scenario) {
    const board = reelsFor(free, version).drawBoard(rng)
    if (!free) return board
    // The extra orb can make near misses more visible. Qualifying boards come from the independent cell draws.
    const orbCount = board.filter(symbol => symbol === 'orb').length
    if (orbCount < BONUS.triggerCount - 1 && freeExtraOrbChance > 0 && rng() < freeExtraOrbChance) {
      const eligible = board.flatMap((symbol, index) =>
        symbol === 'orb' || symbol === 'lantern' || symbol === 'wild' ? [] : [index])
      if (eligible.length) board[eligible[Math.floor(rng() * eligible.length)]] = 'orb'
    }
    return board
  }
  const board: SymbolId[] = freeSymbols
    ? ['chicken', 'lotus', 'chicken', 'boat', 'tiger', 'boat', 'lotus', 'chicken', 'lotus', 'boat', 'tiger', 'boat', 'chicken', 'lotus', 'chicken']
    : ['Q', '9', 'K', 'J', '10', 'lotus', 'boat', 'chicken', 'tiger', '9', 'K', 'tiger', 'lotus', 'Q', 'J']
  if (scenario === 'line' || scenario === 'multi') {
    for (let reel = 0; reel < 5; reel++) {
      board[cellAt(reel, 1)] = reel === 2 ? 'wild' : 'tiger'
      if (scenario === 'multi') {
        board[cellAt(reel, 0)] = 'chicken'
        board[cellAt(reel, 2)] = 'boat'
      }
    }
  }
  if (scenario === 'full') return Array<SymbolId>(CELLS).fill('orb')
  if (scenario === 'grand') return Array.from({ length: CELLS }, (_, index) => index === CELLS - 1 ? board[index] : 'orb')
  if (scenario === 'oneOrb') board[4] = 'orb'
  if (['six', 'sixThenHit', 'seven', 'mini', 'minor', 'major', 'lanternBoth'].includes(scenario)) {
    const cells = [0, 2, 4, 6, 10, 14, 8]
    cells.slice(0, scenario === 'seven' ? 7 : 6).forEach(cell => { board[cell] = 'orb' })
  }
  const lanterns = lanternScenarios[scenario] ?? 0
  if (lanterns) {
    const open = reelPositions.flatMap(positions => positions.find(position => board[position] !== 'orb') ?? [])
    for (const cell of open.slice(0, lanterns)) board[cell] = 'lantern'
  }
  return board
}

export function evaluateLines(board: SymbolId[], unitSen: number, activeLines: number, version: PaytableVersion = CURRENT_MATH_VERSION) {
  const oldTable: Partial<Record<SymbolId, { pays: readonly number[] | null }>> = version === 1 ? LEGACY_SYMBOLS : SYMBOLS
  const creditTable: Partial<Record<SymbolId, Readonly<Partial<Record<number, number>>>>> =
    version >= DESIGN_B_VERSION ? LINE_CREDITS : CREDIT_V3_LINE_AWARDS
  const pays = (symbol: SymbolId, count: number) => version >= CREDIT_PAYTABLE_VERSION
    ? creditTable[symbol]?.[count] : oldTable[symbol]?.pays?.[count - 3]
  const wins: LineWin[] = []
  for (let line = 0; line < activeLines; line++) {
    const positions = paylinePositions[line]
    const first = board[positions[0]]
    const candidates = first === 'wild' && version === 1 ? legacyPayingSymbols : [first]
    let best: LineWin | undefined
    for (const symbol of candidates) {
      let count = 0
      for (const position of positions) {
        const actual = board[position]
        if (actual !== symbol && actual !== 'wild') break
        count++
      }
      const multiplier = pays(symbol, count)
      if (multiplier && (!best || multiplier > best.multiplier ||
        (multiplier === best.multiplier && count > best.positions.length))) {
        best = { line, symbol, positions: positions.slice(0, count), multiplier }
      }
    }
    if (best) wins.push(best)
  }
  const amount = wins.reduce((sum, win) => sum + unitSen * win.multiplier, 0)
  return { wins, amount }
}

// Version 1 rounded the sum of fractional per-line payouts only once.
export const legacyLinePayout = (numerator: number, lines: number) =>
  Math.floor((2 * numerator + lines) / (2 * lines))

export function drawOrb(rng: Random, eligibleForJackpot: boolean, wager: OrbWager): Orb {
  const type = eligibleForJackpot ? orbTypesForVersion(wager.paytableVersion).draw(rng) : 'ordinary'
  return type === 'ordinary'
    ? priceWagerOrb(wager, multiplierDraws.get(orbWeightsForWager(wager))!(rng))
    : { tier: type, payoutSen: wager.jackpotPrizes[type] }
}

export const triggersBonus = (board: SymbolId[]) =>
  board.filter(symbol => symbol === 'orb').length >= BONUS.triggerCount

export function evaluateScatter(board: SymbolId[], bet: number, version: PaytableVersion = CURRENT_MATH_VERSION) {
  const count = board.reduce((total, symbol) => total + Number(symbol === 'lantern'), 0)
  const payouts = version >= CREDIT_PAYTABLE_VERSION ? LANTERN.payouts : LEGACY_LANTERN_PAYOUTS
  const multiplier = count >= 5 ? payouts[5] : count === 4 ? payouts[4] : count === 3 ? payouts[3] : 0
  return { count, amount: multiplier * bet, qualifies: count >= 3 }
}

export function startingOrbs(board: SymbolId[], rng: Random, wager: OrbWager, scenario?: Scenario): Slots {
  const eligibleForJackpot = triggersBonus(board)
  let first = true
  return board.map(symbol => {
    if (symbol !== 'orb') return null
    const special = first && (scenario === 'mini' || scenario === 'minor' || scenario === 'major')
    first = false
    if (special) return { tier: scenario, payoutSen: wager.jackpotPrizes[scenario] }
    return scenario ? priceWagerOrb(wager, demoMultiplier) : drawOrb(rng, eligibleForJackpot, wager)
  })
}

export function respin(orbs: Slots, remaining: number, rng: Random, wager: OrbWager, scenario?: Scenario) {
  let landed = 0
  const held = orbs.filter(Boolean).length
  const landingChance = respinLandingChance(held, wager.paytableVersion)
  const testHit = scenario === 'sixThenHit' && held === BONUS.triggerCount
    ? orbs.indexOf(null) : -1
  const next = orbs.map((orb, position) => {
    if (orb) return orb
    if (scenario === 'grand' || position === testHit) {
      landed++
      return priceWagerOrb(wager, demoMultiplier)
    }
    if (scenario || rng() >= landingChance) return null
    landed++
    return drawOrb(rng, true, wager)
  })
  const full = next.every(Boolean)
  const left = landed ? BONUS.respins : remaining - 1
  return { orbs: next, remaining: left, done: full || left === 0, landed }
}

export function settleBonus(orbs: Slots, jackpotPrizes: JackpotPrizes, grandAddsToOrbs: boolean = BONUS.grandAddsToOrbs) {
  const full = orbs.length === CELLS && orbs.every(Boolean)
  let bonus = 0
  const awards: Award[] = []
  if (!full || grandAddsToOrbs) {
    for (const orb of orbs) {
      if (!orb) continue
      const amount = orb.payoutSen
      if ('tier' in orb) awards.push({ tier: orb.tier, amount })
      else bonus += amount
    }
  }
  if (full) awards.push({ tier: 'grand', amount: jackpotPrizes.grand })
  awards.sort((a, b) => JACKPOT_TIERS.indexOf(a.tier) - JACKPOT_TIERS.indexOf(b.tier))
  return { bonus, awards, jackpot: awards.reduce((sum, award) => sum + award.amount, 0) }
}
