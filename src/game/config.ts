export const DENOMINATIONS_SEN = [1, 2, 5, 10, 20, 50, 100, 200] as const
export const BET_SIZES = [1, 2, 3, 5, 10] as const
export const LINE_OPTIONS = [8, 18, 38, 58, 88] as const
export const LEGACY_BETS = [80, 180, 380, 580, 880] as const
export const LEGACY_LINE_COUNTS = [1, 5, 10, 20, 25] as const
export type Betting = { denominationSen: number; betSize: number; lines: number }
export const DEFAULT_BETTING: Betting = { denominationSen: 1, betSize: 1, lines: 8 }
export const betPerLineSen = ({ denominationSen, betSize }: Betting) => denominationSen * betSize
export const wagerCredits = ({ betSize, lines }: Betting) => betSize * lines
export const totalBetSen = (betting: Betting) => betPerLineSen(betting) * betting.lines
export const denominationLabel = (sen: number) => sen < 100 ? `${sen}¢` : `RM${sen / 100}`
export const START_BALANCE = 100_000
export const MAX_INITIAL_BANKROLL = 100_000_000
export const REELS = 5
export const ROWS = 3
export const CELLS = REELS * ROWS

export const JACKPOT_TIERS = ['grand', 'major', 'minor', 'mini'] as const
export type Jackpot = typeof JACKPOT_TIERS[number]
export type JackpotPrizes = Record<Jackpot, number>

export function calculateJackpots(denominationSen: number): JackpotPrizes {
  if (!Number.isSafeInteger(denominationSen) || denominationSen <= 0 ||
      !Number.isSafeInteger(denominationSen * 20_000)) throw new RangeError('Invalid jackpot denomination.')
  return { mini: denominationSen * 5_000, minor: denominationSen * 20_000, major: 5_000_000, grand: 20_000_000 }
}

// Amounts used by saved spins from before denomination-based jackpots.
export const legacyJackpots = (bet: number): JackpotPrizes =>
  ({ mini: 625 * bet, minor: 1250 * bet, major: 12500 * bet, grand: 125000 * bet })

// These prices remain valid for boards already committed by older versions.
export const LEGACY_SYMBOLS = {
  dragon: { name: 'Golden Dragon', pays: [18, 65, 200] },
  phoenix: { name: 'Red Phoenix', pays: [15, 45, 150] },
  ingot: { name: 'Gold Ingot', pays: [10, 35, 100] },
  jade: { name: 'Jade Ornament', pays: [8, 25, 80] },
  coin: { name: 'Lucky Coin', pays: [7, 20, 65] },
  A: { name: 'Ace', pays: [5, 15, 50] },
  K: { name: 'King', pays: [5, 15, 45] },
  Q: { name: 'Queen', pays: [4, 12, 40] },
  J: { name: 'Jack', pays: [4, 12, 35] },
  '10': { name: 'Ten', pays: [4, 10, 30] },
  wild: { name: 'Panda Wild', pays: [25, 100, 350] },
  orb: { name: 'Gold Orb', pays: null },
  lantern: { name: 'Red Lantern Scatter', pays: null },
} as const
export const SYMBOLS = {
  '9': { name: 'Nine', pays: [2, 5, 15] },
  '10': { name: 'Ten', pays: [2, 6, 18] },
  J: { name: 'Jack', pays: [3, 8, 22] },
  Q: { name: 'Queen', pays: [3, 10, 25] },
  K: { name: 'King', pays: [4, 12, 30] },
  chicken: { name: 'Chicken', pays: [5, 20, 60] },
  boat: { name: 'Boat', pays: [6, 25, 80] },
  lotus: { name: 'Lotus Flower', pays: [8, 30, 100] },
  tiger: { name: 'Tiger', pays: [10, 50, 200] },
  wild: { name: 'Panda Wild', pays: null },
  orb: LEGACY_SYMBOLS.orb,
  lantern: LEGACY_SYMBOLS.lantern,
} as const
export const CREDIT_PAYTABLE_VERSION = 3
export const DESIGN_B_VERSION = 4
export const BONUS_REBALANCE_VERSION = 5
export const ORB_VARIETY_VERSION = 6
export const EARLY_RESPIN_VERSION = 7
export const LATE_RESPIN_VERSION = 8
export const RICH_BONUS_VERSION = 9
export const BALANCED_BONUS_VERSION = 10
export const MATCHED_LANTERN_VERSION = 11
export const CURRENT_MATH_VERSION = 12
export type PaytableVersion = 1 | 2 | typeof CREDIT_PAYTABLE_VERSION | typeof DESIGN_B_VERSION |
  typeof BONUS_REBALANCE_VERSION | typeof ORB_VARIETY_VERSION | typeof EARLY_RESPIN_VERSION |
  typeof LATE_RESPIN_VERSION | typeof RICH_BONUS_VERSION | typeof BALANCED_BONUS_VERSION |
  typeof MATCHED_LANTERN_VERSION | typeof CURRENT_MATH_VERSION
const standardLineCredits = { 3: 10, 4: 25, 5: 100 } as const
export const CREDIT_V3_LINE_AWARDS = {
  '9': standardLineCredits, '10': standardLineCredits, J: standardLineCredits, Q: standardLineCredits,
  K: standardLineCredits, chicken: standardLineCredits, boat: standardLineCredits, lotus: standardLineCredits,
  tiger: { 2: 4, 3: 30, 4: 75, 5: 300 },
} satisfies Partial<Record<keyof typeof SYMBOLS, Readonly<Partial<Record<number, number>>>>>
const rankCredits = { 3: 5, 4: 14, 5: 55 } as const
const pictureCredits = { 3: 8, 4: 20, 5: 80 } as const
export const LINE_CREDITS = {
  '9': rankCredits, '10': rankCredits, J: rankCredits, Q: rankCredits, K: rankCredits,
  chicken: pictureCredits, boat: pictureCredits, lotus: pictureCredits,
  tiger: { 2: 3, 3: 22, 4: 55, 5: 200 },
} satisfies Record<keyof typeof CREDIT_V3_LINE_AWARDS, Readonly<Partial<Record<number, number>>>>
export const BOARD_SYMBOLS = { ...LEGACY_SYMBOLS, ...SYMBOLS }
export type SymbolId = keyof typeof BOARD_SYMBOLS
export const PAYLINES = [
  [1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2], [0, 1, 2, 1, 0], [2, 1, 0, 1, 2],
  [0, 0, 1, 2, 2], [2, 2, 1, 0, 0], [1, 0, 0, 0, 1], [1, 2, 2, 2, 1], [0, 1, 1, 1, 0],
  [2, 1, 1, 1, 2], [1, 1, 0, 1, 1], [1, 1, 2, 1, 1], [0, 1, 0, 1, 0], [2, 1, 2, 1, 2],
  [0, 2, 0, 2, 0], [2, 0, 2, 0, 2], [1, 0, 1, 0, 1], [1, 2, 1, 2, 1], [0, 0, 2, 0, 0],
  [2, 2, 0, 2, 2], [0, 2, 2, 2, 0], [2, 0, 0, 0, 2], [0, 2, 1, 0, 2], [2, 0, 1, 2, 0],
  // Additional paths are listed in activation order, with zero-based rows.
  [0, 0, 0, 0, 1], [2, 2, 2, 2, 1], [0, 0, 0, 1, 0], [2, 2, 2, 1, 2],
  [0, 0, 1, 0, 0], [2, 2, 1, 2, 2], [0, 1, 0, 0, 0], [2, 1, 2, 2, 2],
  [1, 0, 0, 0, 0], [1, 2, 2, 2, 2], [1, 1, 1, 1, 0], [1, 1, 1, 1, 2],
  [1, 1, 1, 0, 1], [1, 1, 1, 2, 1], [1, 0, 1, 1, 1], [1, 2, 1, 1, 1],
  [0, 1, 1, 1, 1], [2, 1, 1, 1, 1], [0, 0, 0, 1, 1], [2, 2, 2, 1, 1],
  [1, 1, 0, 0, 0], [1, 1, 2, 2, 2], [0, 0, 1, 1, 1], [2, 2, 1, 1, 1],
  [1, 1, 1, 0, 0], [1, 1, 1, 2, 2], [0, 0, 1, 1, 2], [2, 2, 1, 1, 0],
  [2, 1, 1, 0, 0], [0, 1, 1, 2, 2], [0, 0, 0, 1, 2], [2, 2, 2, 1, 0],
  [2, 1, 0, 0, 0], [0, 1, 2, 2, 2], [0, 1, 2, 2, 1], [2, 1, 0, 0, 1],
  [1, 2, 2, 1, 0], [1, 0, 0, 1, 2], [1, 0, 1, 2, 1], [1, 2, 1, 0, 1],
  [0, 1, 0, 1, 2], [2, 1, 2, 1, 0], [2, 1, 0, 1, 0], [0, 1, 2, 1, 2],
  [0, 0, 1, 0, 1], [2, 2, 1, 2, 1], [1, 0, 1, 0, 0], [1, 2, 1, 2, 2],
  [1, 1, 0, 1, 0], [1, 1, 2, 1, 2], [0, 1, 0, 1, 1], [2, 1, 2, 1, 1],
  [0, 1, 1, 0, 0], [2, 1, 1, 2, 2], [0, 0, 1, 1, 0], [2, 2, 1, 1, 2],
  [1, 1, 0, 0, 1], [1, 1, 2, 2, 1], [1, 0, 0, 1, 1], [1, 2, 2, 1, 1],
  [0, 1, 0, 0, 1], [2, 1, 2, 2, 1], [1, 0, 0, 1, 0],
] as const

export const CELEBRATIONS = [
  { ratio: 50, label: 'SUPER WIN' },
  { ratio: 25, label: 'MEGA WIN' },
  { ratio: 12, label: 'BIG WIN' },
  { ratio: 1, label: 'NICE WIN' },
] as const

// Flat boards use column-major indexing.
export const cellAt = (column: number, row: number) => column * ROWS + row
const formatter = new Intl.NumberFormat('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const money = (sen: number) => `${sen < 0 ? '−' : ''}RM ${formatter.format(Math.abs(sen) / 100)}`
const creditFormatter = new Intl.NumberFormat('en-MY', { maximumFractionDigits: 3 })
export const credits = (sen: number, denominationSen: number) => creditFormatter.format(sen / denominationSen)

export function parseBankroll(input: string): number | null {
  const match = /^(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?$/.exec(input.trim())
  if (!match) return null
  const sen = Number(match[1].replaceAll(',', '')) * 100 + Number((match[2] ?? '').padEnd(2, '0'))
  return Number.isSafeInteger(sen) && sen <= MAX_INITIAL_BANKROLL ? sen : null
}

