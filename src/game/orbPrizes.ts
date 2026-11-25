import { BET_SIZES, CELLS, DENOMINATIONS_SEN } from './config'
import type { Jackpot, JackpotPrizes } from './config'
import { BASE_ORB_UNITS_BY_DENOMINATION, BONUS, DEFAULT_BASE_ORB_UNITS } from './probabilityConfig'

export type OrdinaryOrb = { value: number; multiplier: number | null; payoutSen: number }
export type Orb = OrdinaryOrb | { tier: Exclude<Jackpot, 'grand'>; payoutSen: number }
export type OrbWager = { denominationSen: number; betSize: number; jackpotPrizes: JackpotPrizes }
export const MAX_STORED_ORB_PAYOUT = Math.floor(Number.MAX_SAFE_INTEGER / CELLS)

export function calculateOrbPrize(denominationSen: number, betSize: number, multiplier: number,
  baseUnits = BASE_ORB_UNITS_BY_DENOMINATION[denominationSen] ?? DEFAULT_BASE_ORB_UNITS): OrdinaryOrb {
  const value = baseUnits * betSize * multiplier
  const payoutSen = value * denominationSen
  if (![denominationSen, betSize, multiplier, baseUnits, value, payoutSen]
    .every(number => Number.isSafeInteger(number) && number > 0) || payoutSen > MAX_STORED_ORB_PAYOUT) {
    throw new RangeError('Gold Orb units, denomination, bet size and multiplier must produce a safe positive prize.')
  }
  return { multiplier, value, payoutSen }
}

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
for (const denomination of DENOMINATIONS_SEN) {
  for (const size of BET_SIZES) {
    for (const [multiplier] of orbMultiplierWeights) calculateOrbPrize(denomination, size, multiplier)
  }
}
