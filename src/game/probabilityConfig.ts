import { CELLS, REELS } from './config'

export const REGULAR_SYMBOL_ORDER = ['9', '10', 'J', 'Q', 'K', 'chicken', 'boat', 'lotus', 'tiger'] as const
const equalSymbolWeights: readonly number[] = REGULAR_SYMBOL_ORDER.map(() => 1)
const equalReelWeights: readonly (readonly number[])[] = Array.from({ length: REELS }, () => equalSymbolWeights)
export const REEL_SYMBOL_WEIGHTS = {
  paid: equalReelWeights,
  free: equalReelWeights,
} as const
export const REEL_WILD_ALLOWED = [false, true, true, true, true] as const

// Keep the orb and Lantern odds independent of the paying-symbol mix.
export const NON_ORB_WEIGHT = 90

export const LANTERN_PROBABILITY = {
  paidWeight: 4,
  freeWeight: 5,
  paidTierWeights: [1, 1, 1],
  freeTierWeights: [1, 1, 1],
} as const

// Relative weights for requesting 0, 1, 2, or 3 adjacent Panda Wilds on a reel.
export const WILD_STACK_WEIGHTS = {
  paid: [84, 5.7, 5, 5.3],
  free: [61, 15, 12, 12],
} as const

export const DEFAULT_BASE_ORB_UNITS = 8
export const BASE_ORB_UNITS_BY_DENOMINATION: Readonly<Partial<Record<number, number>>> = {}

export const BONUS = {
  triggerCount: 6,
  targetEntryChance: 0.02,
  baseOrbWeight: 16.6,
  freeExtraOrbChance: 0.35,
  respins: 3,
  // Each exclusive upper bound is checked against the held count at respin start.
  respinLandingRates: [[8, 0.072], [10, 0.02], [12, 0.01], [CELLS, 0.003]],
  grandAddsToOrbs: true,
  maxOrbMultiplier: 200,
  orbMultiplierWeights: [[1, 62.3], [2, 24], [3, 8.6], [5, 3.3], [10, 1.2], [20, 0.45], [50, 0.13], [100, 0.018], [200, 0.002]],
  orbTypeWeights: { ordinary: 99.82999, mini: 0.15, minor: 0.02, major: 0.00001 },
} as const
