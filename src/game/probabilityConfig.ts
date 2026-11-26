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

export const BONUS_REBALANCE_WILD_WEIGHTS = {
  paid: [87, 8, 3, 2],
  free: [80, 12, 5, 3],
} as const

export const DESIGN_B_ORB_TYPES = { ordinary: 99.86799, mini: 0.12, minor: 0.012, major: 0.00001 } as const
export const BONUS_REBALANCE_ORB_TYPES = { ordinary: 99.88999, mini: 0.10, minor: 0.01, major: 0.00001 } as const
export const CURRENT_ORB_TYPES = { ordinary: 99.98349, mini: 0.015, minor: 0.0015, major: 0.00001 } as const

// Design B's published schedule. The high distribution is blended in these basis points.
export const ORB_HIGH_MIX_BPS: Readonly<Partial<Record<number, number>>> = {
  8: 2347, 16: 6007, 18: 6414, 24: 7227, 36: 8041, 38: 8126, 40: 8203,
  54: 8583, 58: 8657, 76: 8897, 80: 8935, 88: 9002, 90: 9016, 114: 9153,
  116: 9162, 174: 9331, 176: 9334, 180: 9342, 190: 9359, 264: 9445,
  290: 9465, 380: 9513, 440: 9534, 580: 9566, 880: 9601,
}
export const LOW_ORB_WEIGHTS = [90, 8, 1.5, 0.35, 0.10, 0.04, 0.008, 0.0015, 0.0005] as const
export const HIGH_ORB_WEIGHTS = [40.7, 25, 16, 14, 3.7, 0.45, 0.13, 0.018, 0.002] as const
export const BONUS_REBALANCE_LOW_WEIGHTS = [65.7, 30, 3.8, 0.4, 0.07, 0.02, 0.008, 0.0015, 0.0005] as const
export const BONUS_REBALANCE_HIGH_WEIGHTS = [21, 35, 30, 12, 1.7, 0.24, 0.055, 0.004, 0.001] as const
// Blend the ordinary orb schedules by credits to center each group's theoretical RTP at 92%.
export const BONUS_REBALANCE_HIGH_MIX_BPS: Readonly<Partial<Record<number, number>>> = {
  8: 1022, 16: 4661, 18: 4966, 24: 5875, 36: 6584, 38: 6783, 40: 6845,
  54: 7123, 58: 7195, 76: 7549, 80: 7573, 88: 7520, 90: 7554, 114: 7804,
  116: 7697, 174: 7864, 176: 7851, 180: 7878, 190: 8009, 264: 7962, 290: 7998,
  380: 8162, 440: 8050, 580: 8098, 880: 8116,
}

export const CURRENT_ORB_MULTIPLIERS = [1, 2, 3, 4, 5, 8, 10, 20, 50, 100, 200] as const
export const CURRENT_LOW_ORB_WEIGHTS = [53, 29, 9, 6, 2, 0.72, 0.23, 0.04, 0.008, 0.0015, 0.0005] as const
export const CURRENT_HIGH_ORB_WEIGHTS = [26, 36, 19, 13, 4, 1.4, 0.48, 0.09, 0.026, 0.003, 0.001] as const
// Center the RTP range at 92% among wagers with the same total credits.
export const CURRENT_ORB_HIGH_MIX_BPS: Readonly<Partial<Record<number, number>>> = {
  8: 2469, 16: 3754, 18: 3736, 24: 4183, 36: 4307, 38: 4521, 40: 4526,
  54: 4498, 58: 4520, 76: 4792, 80: 4783, 88: 4614, 90: 4650, 114: 4882,
  116: 4697, 174: 4756, 176: 4730, 180: 4764, 190: 4954, 264: 4769, 290: 4803,
  380: 5008, 440: 4801, 580: 4839, 880: 4824,
}
export const PAID_ORB_CHANCE = 0.162
export const FREE_ORB_CHANCE = 0.185
export const BONUS_REBALANCE_RESPIN_RATES = [[8, 0.091], [10, 0.043], [12, 0.01], [CELLS, 0.00105]] as const

// Used only for respins and Free Spins continuing under earlier saved rules.
export const LEGACY_ORB_UNITS = 8

export const BONUS = {
  triggerCount: 6,
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
