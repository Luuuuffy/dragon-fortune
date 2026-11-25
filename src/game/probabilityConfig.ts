const payingSymbols = ['9', '10', 'J', 'Q', 'K', 'chicken', 'boat', 'lotus', 'tiger'] as const
export { payingSymbols as REGULAR_SYMBOL_ORDER }
export const REEL_SYMBOL_WEIGHTS = {
  paid: [
    [43, 23, 11, 9, 7, 3, 2, 1.4, 0.6],
    [42, 24, 11, 9, 7, 3, 2, 1.2, 0.8],
    [41, 24, 12, 9, 7, 3, 2, 1.3, 0.7],
    [39, 24, 12, 10, 7, 3.5, 2.4, 1.4, 0.7],
    [38, 24, 12, 10, 8, 3.5, 2.4, 1.4, 0.7],
  ],
  free: [
    [45, 24, 11, 8, 6, 2.6, 1.8, 1, 0.6],
    [45, 24, 11, 8, 6, 2.6, 1.8, 1, 0.6],
    [44, 25, 11, 8, 6, 2.5, 1.8, 1, 0.7],
    [42, 25, 11, 9, 6, 3, 2, 1.3, 0.7],
    [42, 24, 11, 9, 7, 3, 2, 1.3, 0.7],
  ],
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
  landingChance: 0.011,
  grandAddsToOrbs: true,
  maxOrbMultiplier: 200,
  orbMultiplierWeights: [[1, 40.7], [2, 25], [3, 16], [5, 14], [10, 3.7], [20, 0.45], [50, 0.13], [100, 0.018], [200, 0.002]],
  orbTypeWeights: { ordinary: 99.82999, mini: 0.15, minor: 0.02, major: 0.00001 },
} as const
