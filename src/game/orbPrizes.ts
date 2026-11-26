import { BET_SIZES, CELLS, DENOMINATIONS_SEN, DESIGN_B_VERSION, LINE_OPTIONS, credits, money } from './config'
import type { Jackpot, JackpotPrizes, PaytableVersion } from './config'
import { BONUS, HIGH_ORB_WEIGHTS, LEGACY_ORB_UNITS, LOW_ORB_WEIGHTS, ORB_HIGH_MIX_BPS } from './probabilityConfig'

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

export const orbFaceLabel = ({ payoutSen }: OrdinaryOrb) => payoutSen % 100 === 0
  ? `RM${credits(payoutSen, 100)}` : money(payoutSen).replace('RM ', 'RM')

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
const designBWeights = new Map(BET_SIZES.flatMap(size => LINE_OPTIONS.map(lines => {
  const total = size * lines
  const high = ORB_HIGH_MIX_BPS[total]
  if (high === undefined) throw new RangeError(`Missing Design B distribution for ${total} credits.`)
  const weights = BONUS.orbMultiplierWeights.map(([multiplier], index) => [multiplier,
    (LOW_ORB_WEIGHTS[index] * (10_000 - high) + HIGH_ORB_WEIGHTS[index] * high) / 10_000] as const)
  return [total, configureOrbMultipliers(weights, BONUS.maxOrbMultiplier)] as const
})))

export function orbWeightsForWager({ denominationSen, bet, paytableVersion = DESIGN_B_VERSION }:
  Pick<OrbWager, 'denominationSen' | 'bet' | 'paytableVersion'>) {
  if (paytableVersion !== DESIGN_B_VERSION) return orbMultiplierWeights
  const weights = designBWeights.get(bet / denominationSen)
  if (!weights) throw new RangeError('Unsupported total credits for Design B.')
  return weights
}

export const ordinaryOrbDistributions = [...designBWeights.values()]
for (const denomination of DENOMINATIONS_SEN) {
  for (const [multiplier] of orbMultiplierWeights) {
    calculateOrbPrize(denomination, denomination * Math.max(...BET_SIZES) * Math.max(...LINE_OPTIONS), multiplier)
  }
}
