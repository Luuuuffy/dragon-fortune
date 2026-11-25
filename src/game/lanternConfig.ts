import { LANTERN_PROBABILITY } from './probabilityConfig'

export const LANTERN = {
  ...LANTERN_PROBABILITY,
  // Five or more is an original demo placeholder.
  payouts: { 3: 2, 4: 4, 5: 8 },
  initialSpins: 6,
  extraSpins: 3,
  timing: {
    intro: 1700,
    between: 850,
    retrigger: 1350,
    queuedRespin: 450,
    queuedResult: 1800,
    queuedJackpot: 2700,
    complete: 2600,
  },
} as const
