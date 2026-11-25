export const REGULAR_SYMBOL_WEIGHTS = {
  dragon: 5, phoenix: 6, ingot: 8, jade: 9, coin: 10,
  A: 10, K: 10, Q: 10, J: 10, '10': 10,
} as const

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
  paid: [92, 3, 2, 3],
  free: [85, 6, 3, 6],
} as const

export const DEFAULT_BASE_ORB_UNITS = 8
export const BASE_ORB_UNITS_BY_DENOMINATION: Readonly<Partial<Record<number, number>>> = {}

export const BONUS = {
  triggerCount: 6,
  targetEntryChance: 0.02,
  baseOrbWeight: 16.6,
  freeExtraOrbChance: 0.35,
  respins: 3,
  landingChance: 0.04,
  grandAddsToOrbs: true,
  maxOrbMultiplier: 200,
  orbMultiplierWeights: [[1, 35], [2, 25], [3, 16], [5, 10], [10, 7], [20, 4], [50, 2], [100, 0.8], [200, 0.2]],
  orbTypeWeights: { ordinary: 99, mini: 0.8, minor: 0.19, major: 0.01 },
} as const
