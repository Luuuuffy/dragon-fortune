import { CELLS, JACKPOT_TIERS, LEGACY_BETS, LEGACY_LINE_COUNTS, money, parseBankroll, totalBetSen } from '../src/game/config'
import { BONUS, bonusEntryChance, holdBoardMoments } from '../src/game/bonusConfig'
import { baseOrbChance, boardOrbChance, lanternCountOdds, orbTypeProbabilities } from '../src/game/engine'
import { expectedHoldPayout, simulate } from '../src/game/simulation'
import { validBetting } from '../src/game/session'

const [countArg = '100000', denominationArg = '1', sizeArg = '1', linesArg = '88', seedArg = '2026', ...extra] = process.argv.slice(2)
const spins = Number(countArg)
const legacy = denominationArg.includes('.')
const lines = Number(legacy ? (process.argv[4] ?? '25') : linesArg)
const seed = Number(legacy ? (process.argv[5] ?? '2026') : seedArg)
const betting = { denominationSen: Number(denominationArg), betSize: Number(sizeArg), lines }
const legacyBet = legacy ? parseBankroll(denominationArg) : null
const bet = legacy ? legacyBet ?? 0 : totalBetSen(betting)

if (!Number.isSafeInteger(spins) || spins < 1 || spins > 10_000_000 ||
    !Number.isSafeInteger(seed) || extra.length ||
    (legacy ? process.argv.length > 6 || !LEGACY_BETS.some(value => value === legacyBet) ||
      !LEGACY_LINE_COUNTS.some(value => value === lines) : !validBetting(betting))) {
  console.error('Usage: npm run simulate -- [1–10000000 spins] [denomination in sen] [bet size] [lines] [integer seed]')
  process.exit(1)
}

const denominationSen = legacy ? 1 : betting.denominationSen
const { won, bonusWon, components, triggers, hits, lineHits, jackpotCounts, jackpotHits, holdTriggers,
  holdFinalOrbs, sixOrbStarts, sixOrbFinalOrbs, sixOrbStartsReachingEight, lanternTriggers,
  freeRetriggers, freePlayed, freeGoldOrbs, freeLineHits, freeHoldTriggers, freeFeaturesWithHold,
  freeWon, freeZeroPayouts, paidLanternCounts, freeLanternCounts } =
  simulate({ spins, denominationSen, bet, lines, seed, legacy })
const percent = (ratio: number) => `${(100 * ratio).toFixed(6)}%`
const expectedHold = expectedHoldPayout(denominationSen, bet, legacy)
const modeledEntry = bonusEntryChance(CELLS, baseOrbChance)
const version = legacy ? 2 : undefined
const board = holdBoardMoments(CELLS, baseOrbChance, version)
const regularPerSpin = (components.line + components.scatter + components.freeLine + components.freeScatter) / spins
console.log(`Dragon Fortune simulation | ${money(denominationSen)} denomination | ${money(bet)} wager | ${lines} lines | seed ${seed}`)
console.table({
  'Total paid spins': spins,
  'Regular line win rate (paid)': percent(lineHits / spins),
  'Paid Hold & Spin triggers': triggers,
  'Total Hold & Spin triggers': holdTriggers,
  'Average spins per bonus': triggers ? (spins / triggers).toFixed(2) : '—',
  'Target bonus frequency': percent(BONUS.targetEntryChance),
  'Modeled bonus frequency': percent(modeledEntry),
  'Observed bonus frequency': percent(triggers / spins),
  'Average final orbs (all starts)': holdTriggers ? (holdFinalOrbs / holdTriggers).toFixed(3) : '—',
  'Modeled final orbs (all starts)': modeledEntry ? (board.orbs / modeledEntry).toFixed(3) : '—',
  'Average final orbs (six-orb starts)': sixOrbStarts ? (sixOrbFinalOrbs / sixOrbStarts).toFixed(3) : '—',
  'Modeled final orbs (six-orb starts)': board.fromTrigger.orbs.toFixed(3),
  'Six-orb starts reaching eight': sixOrbStarts ? percent(sixOrbStartsReachingEight / sixOrbStarts) : '—',
  'Modeled six-orb starts reaching eight': percent(board.fromTrigger.eightOrMore),
  'Average Hold & Spin payout': holdTriggers ? money(Math.round(bonusWon / holdTriggers)) : '—',
  'Lantern Free Spins triggers': lanternTriggers,
  'Paid spins per Lantern trigger': lanternTriggers ? (spins / lanternTriggers).toFixed(2) : '—',
  'Observed Lantern trigger rate': percent(lanternTriggers / spins),
  'Modeled Lantern trigger rate': percent(lanternCountOdds(false, version).slice(3).reduce((sum, chance) => sum + chance, 0)),
  'Paid exact 3 / exact 4 / 5+': paidLanternCounts.slice(3).join(' / '),
  'Free exact 3 / exact 4 / 5+': freeLanternCounts.slice(3).join(' / '),
  'Total Free Spins played': freePlayed,
  'Average Gold Orbs per Free Spin': freePlayed ? (freeGoldOrbs / freePlayed).toFixed(3) : '—',
  'Regular line win rate (free)': freePlayed ? percent(freeLineHits / freePlayed) : '—',
  'Hold & Spin rate (free)': freePlayed ? percent(freeHoldTriggers / freePlayed) : '—',
  'Modeled Hold & Spin rate (free)': percent(bonusEntryChance(CELLS, boardOrbChance(true, version))),
  'Lantern features with Hold & Spin': lanternTriggers ? percent(freeFeaturesWithHold / lanternTriggers) : '—',
  'Free Spins retriggers': freeRetriggers,
  'Free Spin retrigger rate': freePlayed ? percent(freeRetriggers / freePlayed) : '—',
  'Average Free Spins per feature': lanternTriggers ? (freePlayed / lanternTriggers).toFixed(2) : '—',
  'Average Free Spins payout': lanternTriggers ? money(Math.round(freeWon / lanternTriggers)) : '—',
  'Free Spins features paying zero': lanternTriggers ? percent(freeZeroPayouts / lanternTriggers) : '—',
  'New orb type chances in Hold & Spin': orbTypeProbabilities(version).map(([type, chance]) => `${type} ${percent(chance)}`).join(' · '),
  'Modeled GRAND rate per paid board': `${(100 * board.full).toExponential(4)}%`,
  'Estimated RTP': percent(won / (spins * bet)),
  'RTP with modeled Hold & Spin prizes': percent((regularPerSpin + expectedHold.ordinaryOrbs + expectedHold.jackpots) / bet),
  'Paid payline RTP': percent(components.line / (spins * bet)),
  'Opening Lantern Scatter RTP': percent(components.scatter / (spins * bet)),
  'Free payline RTP': percent(components.freeLine / (spins * bet)),
  'Free Scatter RTP': percent(components.freeScatter / (spins * bet)),
  'Ordinary Hold & Spin orb RTP': percent(components.ordinaryOrbs / (spins * bet)),
  ...Object.fromEntries(JACKPOT_TIERS.map(tier => [`${tier.toUpperCase()} sample RTP`, percent(components[tier] / (spins * bet))])),
  'Modeled ordinary Hold & Spin orb RTP': percent(expectedHold.ordinaryOrbs / bet),
  ...Object.fromEntries(JACKPOT_TIERS.map(tier => [`${tier.toUpperCase()} modeled RTP`, percent(expectedHold.jackpotPayouts[tier] / bet)])),
  'Average payout': money(Math.round(won / spins)),
  'Hit frequency': percent(hits / spins),
  'Net result': money(won - spins * bet),
  ...Object.fromEntries(JACKPOT_TIERS.map(tier => [
    `${tier.toUpperCase()} awards / paid-spin hit rate`,
    `${jackpotCounts[tier]} / ${percent(jackpotHits[tier] / spins)}${jackpotHits[tier] < 25 ? ' (sparse sample)' : ''}`,
  ])),
})
if (JACKPOT_TIERS.some(tier => jackpotHits[tier] < 25)) {
  console.log('Fewer than 25 paid-spin hits makes an observed tier rate noisy. Zero hits can occur even when the chance is positive.')
}
