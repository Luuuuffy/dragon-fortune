import {
  CELLS, DEFAULT_BETTING, JACKPOT_TIERS, LEGACY_SYMBOLS, PAYLINES, REELS, ROWS, SYMBOLS, cellAt,
} from './config'
import { BONUS, binomial, respinLandingChance } from './bonusConfig'
import { LANTERN } from './lanternConfig'
import { NON_ORB_WEIGHT, REEL_SYMBOL_WEIGHTS, REEL_WILD_ALLOWED, REGULAR_SYMBOL_ORDER, WILD_STACK_WEIGHTS } from './probabilityConfig'
import { calculateOrbPrize, orbMultiplierWeights } from './orbPrizes'
import type { Orb, OrbWager } from './orbPrizes'
import type { Jackpot, JackpotPrizes, SymbolId } from './config'

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
export const baseOrbChance = BONUS.baseOrbWeight / symbolTotal
const reelPositions = Array.from({ length: REELS }, (_, reel) =>
  Array.from({ length: ROWS }, (_, row) => cellAt(reel, row)))
const reelOpenOdds = binomial(ROWS, 1 - baseOrbChance)
let boardOpenOdds = [{ cells: 0, reels: 0, chance: 1 }]
for (let reel = 0; reel < REELS; reel++) {
  boardOpenOdds = boardOpenOdds.flatMap(board => reelOpenOdds.map((chance, cells) => ({
    cells: board.cells + cells, reels: board.reels + Number(cells > 0), chance: board.chance * chance,
  })))
}

export function lanternReels(lanternWeight: number, tierWeights: readonly [number, number, number],
  stackWeights: readonly [number, number, number, number] = WILD_STACK_WEIGHTS.paid,
  reelWeights: readonly (readonly number[])[] = REEL_SYMBOL_WEIGHTS.paid) {
  if (!Number.isFinite(lanternWeight) || lanternWeight < 0 || lanternWeight >= NON_ORB_WEIGHT ||
      tierWeights.some(weight => !Number.isFinite(weight) || weight < 0)) {
    throw new Error('Provide a Lantern weight below the regular symbol weight and nonnegative tier weights.')
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
      const adjusted = capped.map((chance, count) => chance * (count >= 3 ? tierWeights[Math.min(count, 5) - 3] : 1))
      const total = adjusted.reduce((sum, chance) => sum + chance, 0)
      return adjusted.map(chance => chance / total)
    })
  })
  const odds = Array<number>(REELS + 1).fill(0)
  boardOpenOdds.forEach(({ cells, reels, chance }) => {
    countOdds[cells][reels].forEach((conditional, count) => { odds[count] += chance * conditional })
  })
  const drawCount = countOdds.map(distributions => distributions.map(distribution =>
    weighted(distribution.map((chance, count) => [count, chance] as const))))
  return {
    odds,
    drawBoard(rng: Random) {
      const board = Array.from({ length: CELLS }, (): SymbolId | null => rng() >= 1 - baseOrbChance ? 'orb' : null)
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
const paidReels = lanternReels(LANTERN.paidWeight, LANTERN.paidTierWeights)
const freeReels = lanternReels(LANTERN.freeWeight, LANTERN.freeTierWeights, WILD_STACK_WEIGHTS.free, REEL_SYMBOL_WEIGHTS.free)
export const lanternCountOdds = (free: boolean) => (free ? freeReels : paidReels).odds
if (lanternCountOdds(true).slice(3).reduce((sum, chance) => sum + chance, 0) * LANTERN.extraSpins >= 1) {
  throw new Error('Free Spin Lantern weight must keep expected retrigger awards below one per spin.')
}
const freeExtraOrbChance: number = BONUS.freeExtraOrbChance
if (!Number.isFinite(freeExtraOrbChance) || freeExtraOrbChance < 0 || freeExtraOrbChance > 1) {
  throw new RangeError('The extra Free Spin orb chance must be between zero and one.')
}
const drawOrbMultiplier = weighted(orbMultiplierWeights)
const paylinePositions = PAYLINES.map(rows => rows.map((row, reel) => cellAt(reel, row)))
const demoMultiplier = orbMultiplierWeights[1]?.[0] ?? orbMultiplierWeights[0][0]
const types = (['ordinary', 'mini', 'minor', 'major'] as const).map(type => [type, BONUS.orbTypeWeights[type]] as const)
const totalTypeWeight = types.reduce((sum, [, weight]) => sum + weight, 0)
if (types.some(([, weight]) => !Number.isFinite(weight) || weight < 0) ||
    !Number.isFinite(totalTypeWeight) || totalTypeWeight <= 0) {
  throw new RangeError('Configure nonnegative orb-type weights with a positive total.')
}
const drawOrbType = weighted(types.filter(([, weight]) => weight > 0))

export const orbTypeProbabilities = types.map(([type, weight]) => [type, weight / totalTypeWeight] as const)

export const sampleBoard = (): SymbolId[] => [
  'tiger', 'K', 'boat', '9', 'lotus', 'chicken', 'lotus', 'wild', 'Q',
  'chicken', 'orb', '10', 'boat', 'tiger', 'lotus',
]

// The showroom board and old saves without stored face values use a fixed sample.
export const sampleOrbs = (board: SymbolId[], betting = DEFAULT_BETTING): Slots =>
  board.map(symbol => symbol === 'orb' ? calculateOrbPrize(betting.denominationSen,
    betting.betSize, orbMultiplierWeights[0][0]) : null)

export function generateBoard(rng: Random, scenario?: Scenario, free = false): SymbolId[] {
  if (!scenario) {
    if (!free) return paidReels.drawBoard(rng)
    const board = freeReels.drawBoard(rng)
    // Add at most one orb while preserving every Hold & Spin trigger and its starting orb count.
    const orbCount = board.filter(symbol => symbol === 'orb').length
    if (orbCount < BONUS.triggerCount - 1 && freeExtraOrbChance > 0 && rng() < freeExtraOrbChance) {
      const eligible = board.flatMap((symbol, index) =>
        symbol === 'orb' || symbol === 'lantern' || symbol === 'wild' ? [] : [index])
      if (eligible.length) board[eligible[Math.floor(rng() * eligible.length)]] = 'orb'
    }
    return board
  }
  const board: SymbolId[] = ['Q', '9', 'K', 'J', '10', 'lotus', 'boat', 'chicken', 'tiger',
    '9', 'K', 'tiger', 'lotus', 'Q', 'J']
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
  if (scenario === 'grand') return Array.from({ length: CELLS }, (_, index) => index === CELLS - 1 ? 'J' : 'orb')
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

export function evaluateLines(board: SymbolId[], betPerLine: number, activeLines: number, legacyPaytable = false) {
  const paytable: Partial<Record<SymbolId, { pays: readonly number[] | null }>> = legacyPaytable ? LEGACY_SYMBOLS : SYMBOLS
  const wins: LineWin[] = []
  for (let line = 0; line < activeLines; line++) {
    const positions = paylinePositions[line]
    const first = board[positions[0]]
    if (!paytable[first]?.pays) continue
    const candidates = first === 'wild' ? legacyPayingSymbols : [first]
    let best: LineWin | undefined
    for (const symbol of candidates) {
      let count = 0
      for (const position of positions) {
        const actual = board[position]
        if (actual !== symbol && actual !== 'wild') break
        count++
      }
      const multiplier = paytable[symbol]?.pays?.[count - 3]
      if (multiplier && (!best || multiplier > best.multiplier ||
        (multiplier === best.multiplier && count > best.positions.length))) {
        best = { line, symbol, positions: positions.slice(0, count), multiplier }
      }
    }
    if (best) wins.push(best)
  }
  const amount = wins.reduce((sum, win) => sum + betPerLine * win.multiplier, 0)
  return { wins, amount }
}

// Version 1 rounded the sum of fractional per-line payouts only once.
export const legacyLinePayout = (numerator: number, lines: number) =>
  Math.floor((2 * numerator + lines) / (2 * lines))

export function drawOrb(rng: Random, eligibleForJackpot: boolean, wager: OrbWager): Orb {
  const type = eligibleForJackpot ? drawOrbType(rng) : 'ordinary'
  return type === 'ordinary'
    ? calculateOrbPrize(wager.denominationSen, wager.betSize, drawOrbMultiplier(rng))
    : { tier: type, payoutSen: wager.jackpotPrizes[type] }
}

export const triggersBonus = (board: SymbolId[]) =>
  board.filter(symbol => symbol === 'orb').length >= BONUS.triggerCount

export function evaluateScatter(board: SymbolId[], bet: number) {
  const count = board.reduce((total, symbol) => total + Number(symbol === 'lantern'), 0)
  const multiplier = count >= 5 ? LANTERN.payouts[5] : count === 4 ? LANTERN.payouts[4] : count === 3 ? LANTERN.payouts[3] : 0
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
    return scenario ? calculateOrbPrize(wager.denominationSen, wager.betSize, demoMultiplier) : drawOrb(rng, eligibleForJackpot, wager)
  })
}

export function respin(orbs: Slots, remaining: number, rng: Random, wager: OrbWager, scenario?: Scenario) {
  let landed = 0
  const held = orbs.filter(Boolean).length
  const landingChance = respinLandingChance(held)
  const testHit = scenario === 'sixThenHit' && held === BONUS.triggerCount
    ? orbs.indexOf(null) : -1
  const next = orbs.map((orb, position) => {
    if (orb) return orb
    if (scenario === 'grand' || position === testHit) {
      landed++
      return calculateOrbPrize(wager.denominationSen, wager.betSize, demoMultiplier)
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
