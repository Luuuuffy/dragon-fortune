import { CELLS, REELS } from './config'

export const REGULAR_SYMBOL_ORDER = ['9', '10', 'J', 'Q', 'K', 'chicken', 'boat', 'lotus', 'tiger'] as const
export const FREE_SYMBOL_ORDER = ['chicken', 'boat', 'lotus', 'tiger'] as const
const freeSymbols = new Set<string>(FREE_SYMBOL_ORDER)
const equalSymbolWeights: readonly number[] = REGULAR_SYMBOL_ORDER.map(() => 1)
const equalReelWeights: readonly (readonly number[])[] = Array.from({ length: REELS }, () => equalSymbolWeights)
const oldFreeSymbolWeights = REGULAR_SYMBOL_ORDER.map(symbol => Number(freeSymbols.has(symbol)))
const freeSymbolWeights = REGULAR_SYMBOL_ORDER.map(symbol => symbol === 'tiger' ? 0.8 : Number(freeSymbols.has(symbol)))
export const CREDIT_V3_FREE_WEIGHTS = Array.from({ length: REELS }, () => oldFreeSymbolWeights)
export const REEL_SYMBOL_WEIGHTS = {
  paid: equalReelWeights,
  free: Array.from({ length: REELS }, () => freeSymbolWeights),
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
export const CREDIT_V3_WILD_WEIGHTS = {
  paid: [84, 5.7, 5, 5.3],
  free: [61, 15, 12, 12],
} as const
export const WILD_STACK_WEIGHTS = {
  paid: [87, 4.7, 4, 4.3],
  free: [80, 8, 6, 6],
} as const

export const DESIGN_B_ORB_TYPES = { ordinary: 99.86799, mini: 0.12, minor: 0.012, major: 0.00001 } as const

// Design B's published schedule. The high distribution is blended in these basis points.
export const ORB_HIGH_MIX_BPS: Readonly<Partial<Record<number, number>>> = {
  8: 2347, 16: 6007, 18: 6414, 24: 7227, 36: 8041, 38: 8126, 40: 8203,
  54: 8583, 58: 8657, 76: 8897, 80: 8935, 88: 9002, 90: 9016, 114: 9153,
  116: 9162, 174: 9331, 176: 9334, 180: 9342, 190: 9359, 264: 9445,
  290: 9465, 380: 9513, 440: 9534, 580: 9566, 880: 9601,
}
export const LOW_ORB_WEIGHTS = [90, 8, 1.5, 0.35, 0.10, 0.04, 0.008, 0.0015, 0.0005] as const
export const HIGH_ORB_WEIGHTS = [40.7, 25, 16, 14, 3.7, 0.45, 0.13, 0.018, 0.002] as const

// Used only for respins and Free Spins continuing under earlier saved rules.
export const LEGACY_ORB_UNITS = 8

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
