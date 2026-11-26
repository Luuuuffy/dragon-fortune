import { BET_SIZES, CELLS, CREDIT_PAYTABLE_VERSION, CURRENT_MATH_VERSION, DENOMINATIONS_SEN, DESIGN_B_VERSION, JACKPOT_TIERS, LEGACY_BETS, LEGACY_LINE_COUNTS, LINE_OPTIONS,
  MAX_INITIAL_BANKROLL, PAYLINES, START_BALANCE, calculateJackpots, legacyJackpots, totalBetSen } from './config'
import { BONUS } from './bonusConfig'
import { LANTERN } from './lanternConfig'
import { SCENARIOS, evaluateScatter, sampleOrbs } from './engine'
import { MAX_STORED_ORB_PAYOUT, ordinaryOrbBaseBet } from './orbPrizes'
import type { Orb } from './orbPrizes'
import { DEFAULT_SETTINGS, freeSpinsWin, jackpotTotal, knownSymbol, newSession, validBetting } from './session'
import type { Betting, Jackpot, JackpotPrizes, SymbolId } from './config'
import type { FreeSpins, Session, Settings } from './session'

export const SAVE_KEY = 'dragon-fortune.session.v1'
const betOptions = LINE_OPTIONS.flatMap(lines => DENOMINATIONS_SEN.flatMap(denominationSen =>
  BET_SIZES.map(betSize => ({ denominationSen, betSize, lines }))))
const possibleTotals = new Set([...LEGACY_BETS, ...betOptions.map(totalBetSen)])
const oldMultipliers = [1, 2, 3, 5, 10, 15, 20, 25, 50]
const maxSafeOrbValue = Math.floor(Number.MAX_SAFE_INTEGER / (CELLS * Math.max(...DENOMINATIONS_SEN)))

type RecordValue = Record<string, unknown>
const object = (value: unknown): value is RecordValue =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const integer = (value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max
const member = (value: unknown, values: readonly unknown[]) => values.includes(value)
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 100
const board = (value: unknown): value is SymbolId[] => Array.isArray(value) && value.length === CELLS && value.every(knownSymbol)
const specialTier = (value: unknown): value is Exclude<Jackpot, 'grand'> =>
  value === 'mini' || value === 'minor' || value === 'major'
const slots = (value: unknown, version: number): value is (RecordValue | null)[] =>
  Array.isArray(value) && value.length === CELLS && value.every(orb =>
    orb === null || (object(orb) &&
      (version < 5 || integer(orb.payoutSen, 1, MAX_STORED_ORB_PAYOUT)) && ('tier' in orb
      ? specialTier(orb.tier) && !('multiplier' in orb) && !('value' in orb) && !('displayMyr' in orb)
      : version < 3 ? member(orb.multiplier, oldMultipliers)
      : integer(orb.value, 1, version === 5 ? MAX_STORED_ORB_PAYOUT : maxSafeOrbValue) &&
        (version === 5 ? (orb.multiplier === null || integer(orb.multiplier, 1)) &&
          (orb.displayMyr === undefined || orb.displayMyr === true) : !('multiplier' in orb)))))
const matchesBoard = (orbs: (RecordValue | null)[], symbols: SymbolId[]) =>
  orbs.every((orb, index) => Boolean(orb) === (symbols[index] === 'orb'))
const jackpotCounts = (value: unknown): value is Record<Jackpot, number> =>
  object(value) && JACKPOT_TIERS.every(key => integer(value[key]))
const samePrizes = (value: unknown, prizes: JackpotPrizes): value is JackpotPrizes =>
  object(value) && JACKPOT_TIERS.every(tier => value[tier] === prizes[tier])
const storedPrizes = (spin: RecordValue) => (spin.jackpotPrizes as JackpotPrizes | undefined) ?? legacyJackpots(spin.bet as number)
const spinDenomination = (spin: RecordValue) => (spin.betting as Betting | null)?.denominationSen ?? 1
const wagerPricedProfile = (version: unknown) => integer(version, CREDIT_PAYTABLE_VERSION, CURRENT_MATH_VERSION)
function pricedFor(orbs: (RecordValue | null)[], spin: RecordValue, version: number) {
  if (version < 5) return true
  const denomination = spinDenomination(spin)
  const orbBet = spin.paytableVersion === CURRENT_MATH_VERSION ? ordinaryOrbBaseBet({
    denominationSen: denomination, bet: spin.bet as number, betSize: (spin.betting as Betting).betSize,
  }) : spin.bet as number
  return orbs.every(orb => {
    if (!orb) return true
    if (specialTier(orb.tier)) return orb.payoutSen === storedPrizes(spin)[orb.tier]
    if (orb.payoutSen !== (orb.value as number) * denomination) return false
    return !wagerPricedProfile(spin.paytableVersion) || (integer(orb.multiplier, 1) &&
      orb.payoutSen === orbBet * orb.multiplier && Boolean(orb.displayMyr) === (denomination >= 100))
  })
}
const lineWins = (lines: unknown) => Array.isArray(lines) && lines.length <= PAYLINES.length && lines.every(win =>
  object(win) && knownSymbol(win.symbol) && integer(win.line, 0, PAYLINES.length - 1) &&
  integer(win.multiplier, 1) && Array.isArray(win.positions) &&
  win.positions.length >= (win.symbol === 'tiger' ? 2 : 3) && win.positions.length <= 5 &&
  win.positions.every(position => integer(position, 0, CELLS - 1)))
const betting = (value: unknown): value is Betting => object(value) && validBetting(value as Betting)
const sameBetting = (left: unknown, right: unknown) =>
  betting(left) && betting(right) && left.denominationSen === right.denominationSen &&
  left.betSize === right.betSize && left.lines === right.lines
const spin = (value: unknown, legacy: boolean): value is RecordValue =>
  object(value) && id(value.id) && (legacy || value.betting === null
    ? member(value.bet, LEGACY_BETS) && member(value.lines, LEGACY_LINE_COUNTS)
    : betting(value.betting) && value.bet === totalBetSen(value.betting) && value.lines === value.betting.lines) &&
  (value.jackpotPrizes === undefined || (betting(value.betting) &&
    samePrizes(value.jackpotPrizes, calculateJackpots(value.betting.denominationSen)))) &&
  (value.paytableVersion === undefined || value.paytableVersion === 2 ||
    (wagerPricedProfile(value.paytableVersion) && betting(value.betting))) &&
  board(value.board) && (value.scenario === undefined ||
    (typeof value.scenario === 'string' && Object.hasOwn(SCENARIOS, value.scenario)))
const result = (value: unknown): value is RecordValue => {
  if (!object(value) || !id(value.spinId) || !integer(value.bet) || !possibleTotals.has(value.bet)) return false
  if (value.bonusId !== null && value.bonusId !== `${value.spinId}:bonus`) return false
  const legacy = legacyJackpots(value.bet)
  const prizes = value.jackpotPrizes
  if (prizes !== undefined && !samePrizes(prizes, legacy) &&
      !DENOMINATIONS_SEN.some(denomination => samePrizes(prizes, calculateJackpots(denomination)))) return false
  const schedule = (prizes as JackpotPrizes | undefined) ?? legacy
  const { line, scatter = 0, bonus, jackpot, total, awards, lines, jackpotCounts: counts, freeSpins } = value
  const validAwards = Array.isArray(awards) && awards.length <= CELLS + 1 &&
    awards.every(award => object(award) && member(award.tier, JACKPOT_TIERS) &&
      award.amount === schedule[award.tier as Jackpot])
  if (!validAwards || !lineWins(lines) || !integer(scatter) ||
      (freeSpins !== undefined && (!integer(freeSpins) || !integer(total) || freeSpins > total))) return false
  return integer(line) && integer(bonus) && integer(jackpot) && integer(total) &&
    total === line + scatter + bonus + jackpot && (counts === undefined
      ? jackpot === awards.reduce((sum, award) => sum + award.amount, 0)
      : awards.length === 0 && jackpotCounts(counts) && jackpot === jackpotTotal(counts, schedule))
}

const payout = (value: unknown) =>
  object(value) && integer(value.line) && integer(value.scatter) && integer(value.bonus) && jackpotCounts(value.jackpots)
const heldBoard = (orbs: unknown, spin: RecordValue, version: number) =>
  slots(orbs, version) && matchesBoard(orbs, spin.board as SymbolId[]) &&
  orbs.filter(Boolean).length >= BONUS.triggerCount && pricedFor(orbs, spin, version)

function validFeature(value: unknown, version: number): value is FreeSpins {
  if (!object(value) || !spin(value.root, false) || !object(value.root.betting) ||
      !integer(value.awarded, LANTERN.initialSpins) || !integer(value.remaining, 0, value.awarded) ||
      !integer(value.retriggers) || value.awarded !== LANTERN.initialSpins + value.retriggers * LANTERN.extraSpins ||
      !payout(value.paid) || !payout(value.free)) return false
  if (!evaluateScatter(value.root.board as SymbolId[], value.root.bet as number).qualifies) return false
  if (value.paidHold !== null && !heldBoard(value.paidHold, value.root, version)) return false
  const next = value.nextHold
  return next === null || (object(next) && spin(next.spin, false) &&
    sameMathProfile(value.root, next.spin) &&
    next.spin.id === `${value.root.id}:free:${value.awarded - value.remaining}` &&
    sameBetting(next.spin.betting, value.root.betting) && heldBoard(next.orbs, next.spin, version))
}

// Legacy features could have an unversioned root and a version 2 free spin.
const sameMathProfile = (root: RecordValue, child: RecordValue) => {
  const profile = (spin: RecordValue) => integer(spin.paytableVersion, DESIGN_B_VERSION) ? spin.paytableVersion : 0
  return profile(root) === profile(child)
}

function validRound(value: unknown, session: RecordValue, version: number) {
  if (!object(value)) return false
  const { phase, orbs, bonus } = value
  if (value.collectionComplete !== undefined && (value.collectionComplete !== true ||
      (phase !== 'FEATURE_HOLD_RESULT' && phase !== 'BONUS_RESULT' && phase !== 'JACKPOT_CELEBRATION'))) return false
  const rawFeature = version >= 4 ? session.freeSpins : null
  if (rawFeature !== null && !validFeature(rawFeature, version)) return false
  const feature = rawFeature as FreeSpins | null
  if (phase === 'IDLE') return !feature
  const currentFreeId = feature && `${feature.root.id}:free:${feature.awarded - feature.remaining}`
  if (feature && !sameBetting(feature.root.betting, session.betting)) return false
  if (feature?.nextHold && phase !== 'FREE_WAIT') return false
  if (phase === 'FREE_INTRO' || phase === 'FREE_WAIT') {
    if (!feature || !object(value.outcome)) return false
    const scatter = evaluateScatter(session.board as SymbolId[], feature.root.bet, feature.root.paytableVersion ?? 1)
    return value.outcome.scatter === scatter.amount && value.outcome.lanterns === scatter.count &&
      integer(value.outcome.line) && lineWins(value.outcome.lines) &&
      (phase === 'FREE_INTRO'
        ? value.spinId === feature.root.id && feature.remaining === LANTERN.initialSpins &&
          feature.retriggers === 0 && value.extra === 0
        : value.spinId === currentFreeId && value.extra === (scatter.qualifies ? LANTERN.extraSpins : 0))
  }
  if (phase === 'FREE_COMPLETE') return Boolean(feature && !feature.remaining && !feature.paidHold &&
    result(value.result) && value.result.spinId === feature.root.id && value.result.freeSpins === freeSpinsWin(feature) &&
    JSON.stringify(value.result) === JSON.stringify(session.last))
  if (phase === 'FEATURE_HOLD_RESULT') return Boolean(feature && result(value.holdResult) &&
    (value.holdResult.spinId === feature.root.id || value.holdResult.spinId === currentFreeId) && slots(orbs, version))
  const pendingSpin = (candidate: unknown): candidate is RecordValue =>
    spin(candidate, version === 1) && (version === 1
      ? candidate.bet === session.bet && candidate.lines === session.lines
      : (candidate.betting === null && !feature) || sameBetting(candidate.betting, session.betting)) &&
    (!object(session.last) || candidate.id !== session.last.spinId)
  if (phase === 'SPINNING') {
    if (!pendingSpin(value.spin)) return false
    if (feature && (value.spin.id !== currentFreeId || !sameMathProfile(feature.root, value.spin))) return false
    const spinBoard = value.spin.board as SymbolId[]
    const trigger = spinBoard.filter(symbol => symbol === 'orb').length >= BONUS.triggerCount
    if (version < 3 && !trigger) return orbs === null
    return slots(orbs, version) && matchesBoard(orbs, spinBoard) && pricedFor(orbs, value.spin, version) &&
      (trigger || orbs.every(orb => !orb || !('tier' in orb)))
  }
  if (phase === 'LINE_WIN' || phase === 'BONUS_RESULT' || phase === 'JACKPOT_CELEBRATION') {
    return !feature && result(value.result) && JSON.stringify(value.result) === JSON.stringify(session.last) &&
      (phase === 'LINE_WIN' ? orbs === null : slots(orbs, version))
  }
  if (phase !== 'BONUS_TRIGGER' && phase !== 'BONUS_READY' && phase !== 'BONUS_RESPIN') return false
  if (!object(bonus) || !pendingSpin(bonus.spin) || !slots(bonus.orbs, version) || !pricedFor(bonus.orbs, bonus.spin, version) ||
      !integer(bonus.remaining, 1, BONUS.respins) || !integer(bonus.turn, 0, CELLS * BONUS.respins)) return false
  if (feature && ((bonus.spin.id !== currentFreeId && bonus.spin.id !== feature.root.id) ||
      !sameMathProfile(feature.root, bonus.spin))) return false
  const locked = bonus.orbs
  const spinBoard = bonus.spin.board as string[]
  if (spinBoard.filter(symbol => symbol === 'orb').length < BONUS.triggerCount ||
      spinBoard.some((symbol, index) => symbol === 'orb' && !locked[index])) return false
  if (phase === 'BONUS_TRIGGER') {
    return bonus.turn === 0 && bonus.remaining === BONUS.respins && bonus.next === null &&
      locked.every((orb, index) => Boolean(orb) === (spinBoard[index] === 'orb'))
  }
  if (locked.every(Boolean)) return false
  if (phase === 'BONUS_READY') return bonus.next === null
  const next = bonus.next
  if (!object(next) || !slots(next.orbs, version) || !pricedFor(next.orbs, bonus.spin, version) || bonus.turn === 0) return false
  if (!next.orbs.every((orb, index) => !locked[index] || JSON.stringify(orb) === JSON.stringify(locked[index]))) return false
  const landed = next.orbs.filter((orb, index) => orb && !locked[index]).length
  const remaining = landed ? BONUS.respins : bonus.remaining - 1
  return next.landed === landed && next.remaining === remaining &&
    next.done === (remaining === 0 || next.orbs.every(Boolean))
}

function migrateLegacyBetting(value: RecordValue, settings: RecordValue) {
  const round = value.round as RecordValue
  const pending = object(round.spin) ? round.spin :
    object(round.bonus) && object(round.bonus.spin) ? round.bonus.spin : null
  if (pending) pending.betting = null

  const lines = value.lines as number
  const bet = value.bet as number
  const closestLines = LINE_OPTIONS.reduce((best, option) =>
    Math.abs(option - lines) < Math.abs(best - lines) ? option : best)
  const selection = betOptions.filter(option => option.lines === closestLines).reduce((best, option) =>
    Math.abs(totalBetSen(option) - bet) < Math.abs(totalBetSen(best) - bet) ? option : best)
  const { bet: _oldBet, lines: _oldLines, ...rest } = value
  return { ...rest, version: 2, initialBankroll: START_BALANCE, betting: selection,
    settings: { ...DEFAULT_SETTINGS, muted: settings.muted, volume: settings.volume,
      speed: settings.speed, reduced: settings.reduced } }
}

function migrateOrbs(value: RecordValue): RecordValue {
  const round = value.round as RecordValue
  const symbols = value.board as SymbolId[]
  let boardOrbs = sampleOrbs(symbols).map(orb => orb && 'value' in orb ? { value: orb.value } : null)
  const convert = (orbs: unknown, wager: number, denomination: number) =>
    (orbs as (RecordValue | null)[]).map(orb => orb && ('tier' in orb ? { tier: orb.tier } :
      { value: (orb.multiplier as number) * (wager / denomination) }))

  if (object(round.spin)) {
    round.orbs = round.orbs === null ? sampleOrbs(round.spin.board as SymbolId[]) :
      convert(round.orbs, round.spin.bet as number, spinDenomination(round.spin))
  } else if (object(round.bonus) && object(round.bonus.spin)) {
    const { bonus } = round
    const spin = bonus.spin as RecordValue
    const wager = spin.bet as number
    const denomination = spinDenomination(spin)
    const held = convert(bonus.orbs, wager, denomination)
    bonus.orbs = held
    if (object(bonus.next)) bonus.next.orbs = convert(bonus.next.orbs, wager, denomination)
    boardOrbs = boardOrbs.map((orb, index) => orb && held[index] && 'value' in held[index]!
      ? { value: held[index]!.value as number } : orb)
  } else if (object(round.result)) {
    const wager = round.result.bet as number
    const denomination = (value.betting as Betting).denominationSen
    if (round.orbs !== null) round.orbs = convert(round.orbs, wager, wager % denomination === 0 ? denomination : 1)
  }
  return { ...value, version: 3, boardOrbs }
}

function migrateOrbPricing(value: RecordValue, stats: RecordValue): Session {
  const round = value.round as RecordValue
  const previous = object(value.last) ? value.last : null
  const feature = object(value.freeSpins) ? value.freeSpins : null
  const convert = (orbs: unknown, denomination: number, prizes: JackpotPrizes) =>
    (orbs as (RecordValue | null)[]).map((orb): Orb | null => {
      if (!orb) return null
      if (specialTier(orb.tier)) return { tier: orb.tier, payoutSen: prizes[orb.tier] }
      const value = orb.value as number
      return { value, payoutSen: value * denomination, multiplier: null }
    })
  const convertFor = (orbs: unknown, spin: RecordValue) => convert(orbs, spinDenomination(spin), storedPrizes(spin))
  const denomination = (value.betting as Betting).denominationSen
  const previousPrizes = previous ? storedPrizes(previous) : calculateJackpots(denomination)
  let boardOrbs = convert(value.boardOrbs, denomination, previousPrizes)
  if (object(round.spin)) {
    round.orbs = convertFor(round.orbs, round.spin)
  } else if (object(round.bonus) && object(round.bonus.spin)) {
    const { bonus } = round
    const spin = bonus.spin as RecordValue
    const held = convertFor(bonus.orbs, spin)
    bonus.orbs = held
    if (object(bonus.next)) bonus.next.orbs = convertFor(bonus.next.orbs, spin)
    boardOrbs = boardOrbs.map((orb, index) => orb ? held[index] ?? orb : null)
  } else {
    const result = object(round.holdResult) ? round.holdResult : object(round.result) ? round.result : null
    if (result && Array.isArray(round.orbs)) round.orbs = convert(round.orbs, denomination, storedPrizes(result))
  }
  if (feature && object(feature.root)) {
    if (feature.paidHold !== null) feature.paidHold = convertFor(feature.paidHold, feature.root)
    if (object(feature.nextHold) && object(feature.nextHold.spin)) {
      feature.nextHold.orbs = convertFor(feature.nextHold.orbs, feature.nextHold.spin)
    }
  }
  return { ...value, version: 5, boardOrbs, freeSpins: feature,
    settings: { ...DEFAULT_SETTINGS, ...value.settings as Partial<Settings> },
    stats: { freeFeatures: 0, freePlayed: 0, freeRetriggers: 0, ...stats },
  } as Session
}

export function parseSession(raw: string | null): Session | null {
  if (!raw) return null
  try {
    const value: unknown = JSON.parse(raw)
    if (!object(value) || !integer(value.version, 1, 5) ||
      (value.gameplayRevision !== undefined && !integer(value.gameplayRevision)) ||
      !integer(value.balance) || !board(value.board) ||
      (value.last !== null && !result(value.last))) return null
    const legacy = value.version === 1
    if (value.version >= 3 && (!slots(value.boardOrbs, value.version) || !matchesBoard(value.boardOrbs, value.board))) return null
    if (legacy ? !member(value.bet, LEGACY_BETS) || !member(value.lines, LEGACY_LINE_COUNTS) :
      !integer(value.initialBankroll, 0, MAX_INITIAL_BANKROLL) || !betting(value.betting)) return null
    const { stats, settings } = value
    if (!object(stats) || !jackpotCounts(stats.jackpots) ||
      !['spins', 'wagered', 'won', 'bonuses', 'biggest'].every(key => integer(stats[key])) ||
      (value.version >= 4 && !['freeFeatures', 'freePlayed', 'freeRetriggers'].every(key => integer(stats[key])))) return null
    if (!object(settings) || typeof settings.muted !== 'boolean' || typeof settings.reduced !== 'boolean' ||
      !['volume', ...(legacy ? [] : ['reelVolume', 'orbVolume', 'jackpotVolume']),
        ...(value.version === 5 ? ['musicVolume'] : [])].every(key => {
        const level = settings[key]
        return typeof level === 'number' && level >= 0 && level <= 1
      }) ||
      !member(settings.speed, [0.75, 1, 1.5, 2])) return null
    if (!validRound(value.round, value, value.version)) return null
    if (value.version === 5) return value as Session
    const upgraded = value.version >= 3 ? value : migrateOrbs(legacy ? migrateLegacyBetting(value, settings) : value)
    return migrateOrbPricing(upgraded, stats)
  } catch {
    return null
  }
}

export function loadSession(): Session {
  try {
    return parseSession(localStorage.getItem(SAVE_KEY)) ?? newSession()
  } catch {
    return newSession()
  }
}

export function saveSession(session: Session) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(session))
    return true
  } catch {
    return false
  }
}
