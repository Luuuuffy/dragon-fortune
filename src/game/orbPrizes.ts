import { BET_SIZES, BONUS_REBALANCE_VERSION, CELLS, CREDIT_PAYTABLE_VERSION, CURRENT_MATH_VERSION,
  DENOMINATIONS_SEN, DESIGN_B_VERSION, EARLY_RESPIN_VERSION, LINE_OPTIONS, ORB_VARIETY_VERSION, credits } from './config'
import type { Jackpot, JackpotPrizes, PaytableVersion } from './config'
import { BONUS, BONUS_REBALANCE_HIGH_MIX_BPS, BONUS_REBALANCE_HIGH_WEIGHTS, BONUS_REBALANCE_LOW_WEIGHTS,
  CURRENT_HIGH_ORB_WEIGHTS, CURRENT_LOW_ORB_WEIGHTS, CURRENT_ORB_HIGH_MIX_BPS, CURRENT_ORB_MULTIPLIERS,
  EARLY_RESPIN_HIGH_MIX_BPS, HIGH_ORB_WEIGHTS, LEGACY_ORB_UNITS, LOW_ORB_WEIGHTS, MINIMUM_WAGER_ORB_HIGH_MIX_BPS,
  ORB_HIGH_MIX_BPS, ORB_VARIETY_HIGH_MIX_BPS } from './probabilityConfig'

export type OrdinaryOrb = { value: number; multiplier: number | null; payoutSen: number; displayMyr?: true }
export type Orb = OrdinaryOrb | { tier: Exclude<Jackpot, 'grand'>; payoutSen: number }
export type OrbWager = { denominationSen: number; bet: number; jackpotPrizes: JackpotPrizes;
  legacyBetSize?: number; paytableVersion?: PaytableVersion }
export const MAX_STORED_ORB_PAYOUT = Math.floor(Number.MAX_SAFE_INTEGER / CELLS)

export function calculateOrbPrize(denominationSen: number, bet: number, multiplier: number,
  displayMyr = denominationSen >= 100): OrdinaryOrb {
  const payoutSen = bet * multiplier
  const value = payoutSen / denominationSen
  if (![denominationSen, bet, multiplier, value, payoutSen]
    .every(number => Number.isSafeInteger(number) && number > 0) || payoutSen > MAX_STORED_ORB_PAYOUT) {
    throw new RangeError('Gold Orb bet, denomination and multiplier must produce a safe positive whole-credit prize.')
  }
  return { multiplier, value, payoutSen, ...(displayMyr ? { displayMyr: true } : {}) }
}

export const priceWagerOrb = ({ denominationSen, bet, legacyBetSize }: Pick<OrbWager, 'denominationSen' | 'bet' | 'legacyBetSize'>,
  multiplier: number) => legacyBetSize === undefined ? calculateOrbPrize(denominationSen, bet, multiplier)
  : calculateOrbPrize(denominationSen, LEGACY_ORB_UNITS * denominationSen * legacyBetSize, multiplier, false)

export const orbFaceLabel = ({ value, payoutSen, displayMyr }: OrdinaryOrb) =>
  displayMyr ? `RM${credits(payoutSen, 100)}` : credits(value, 1)

export function configureOrbMultipliers(
  tiers: readonly (readonly [number, number])[], maximum: number,
) {
  if (!Number.isSafeInteger(maximum) || maximum < 1) throw new RangeError('Invalid maximum Gold Orb multiplier.')
  const multipliers = new Set<number>()
  for (const [multiplier, weight] of tiers) {
    if (!Number.isSafeInteger(multiplier) || multiplier < 1 || !Number.isFinite(weight) || weight < 0 ||
        multipliers.has(multiplier)) throw new RangeError('Invalid or duplicate Gold Orb multiplier or weight.')
    multipliers.add(multiplier)
  }
  const enabled = tiers.filter(([multiplier, weight]) => multiplier <= maximum && weight > 0)
  const total = enabled.reduce((sum, [, weight]) => sum + weight, 0)
  if (!Number.isFinite(total) || total <= 0) throw new RangeError('Configure at least one enabled Gold Orb multiplier.')
  return enabled
}

export const orbMultiplierWeights = configureOrbMultipliers(BONUS.orbMultiplierWeights, BONUS.maxOrbMultiplier)
function blendOrbWeights(blend: number, low: readonly number[], high: readonly number[], multipliers: readonly number[]) {
  const weights = multipliers.map((multiplier, index) => [multiplier,
    (low[index] * (10_000 - blend) + high[index] * blend) / 10_000] as const)
  return configureOrbMultipliers(weights, BONUS.maxOrbMultiplier)
}

function buildWagerWeights(mix: Readonly<Partial<Record<number, number>>>, low: readonly number[], high: readonly number[],
  multipliers: readonly number[] = orbMultiplierWeights.map(([multiplier]) => multiplier)) {
  return new Map(BET_SIZES.flatMap(size => LINE_OPTIONS.map(lines => {
    const total = size * lines
    const blend = mix[total]
    if (blend === undefined) throw new RangeError(`Missing ordinary orb distribution for ${total} credits.`)
    return [total, blendOrbWeights(blend, low, high, multipliers)] as const
  })))
}
const designBWeights = buildWagerWeights(ORB_HIGH_MIX_BPS, LOW_ORB_WEIGHTS, HIGH_ORB_WEIGHTS)
const rebalanceWeights = buildWagerWeights(BONUS_REBALANCE_HIGH_MIX_BPS, BONUS_REBALANCE_LOW_WEIGHTS, BONUS_REBALANCE_HIGH_WEIGHTS)
const varietyWeights = buildWagerWeights(ORB_VARIETY_HIGH_MIX_BPS, CURRENT_LOW_ORB_WEIGHTS, CURRENT_HIGH_ORB_WEIGHTS,
  CURRENT_ORB_MULTIPLIERS)
const earlyRespinWeights = buildWagerWeights(EARLY_RESPIN_HIGH_MIX_BPS, CURRENT_LOW_ORB_WEIGHTS, CURRENT_HIGH_ORB_WEIGHTS,
  CURRENT_ORB_MULTIPLIERS)
const currentWeights = buildWagerWeights(CURRENT_ORB_HIGH_MIX_BPS, CURRENT_LOW_ORB_WEIGHTS, CURRENT_HIGH_ORB_WEIGHTS,
  CURRENT_ORB_MULTIPLIERS)
const minimumWagerWeights = blendOrbWeights(MINIMUM_WAGER_ORB_HIGH_MIX_BPS, CURRENT_LOW_ORB_WEIGHTS,
  CURRENT_HIGH_ORB_WEIGHTS, CURRENT_ORB_MULTIPLIERS)
const wagerWeights = {
  [DESIGN_B_VERSION]: designBWeights,
  [BONUS_REBALANCE_VERSION]: rebalanceWeights,
  [ORB_VARIETY_VERSION]: varietyWeights,
  [EARLY_RESPIN_VERSION]: earlyRespinWeights,
  [CURRENT_MATH_VERSION]: currentWeights,
}

export const isMinimumOrbWager = (denominationSen: number, totalCredits: number) =>
  denominationSen === DENOMINATIONS_SEN[0] && totalCredits === BET_SIZES[0] * LINE_OPTIONS[0]

export function orbWeightsForWager({ denominationSen, bet, paytableVersion = CURRENT_MATH_VERSION }:
  Pick<OrbWager, 'denominationSen' | 'bet' | 'paytableVersion'>) {
  if (paytableVersion === 1 || paytableVersion === 2 || paytableVersion === CREDIT_PAYTABLE_VERSION) return orbMultiplierWeights
  const totalCredits = bet / denominationSen
  if (paytableVersion === CURRENT_MATH_VERSION && isMinimumOrbWager(denominationSen, totalCredits)) return minimumWagerWeights
  const weights = wagerWeights[paytableVersion].get(totalCredits)
  if (!weights) throw new RangeError('Unsupported total credits for the ordinary orb distribution.')
  return weights
}

export const ordinaryOrbDistributions = [minimumWagerWeights, ...Object.values(wagerWeights).flatMap(weights => [...weights.values()])]
for (const denomination of DENOMINATIONS_SEN) {
  for (const multiplier of CURRENT_ORB_MULTIPLIERS) {
    calculateOrbPrize(denomination, denomination * Math.max(...BET_SIZES) * Math.max(...LINE_OPTIONS), multiplier)
  }
}
