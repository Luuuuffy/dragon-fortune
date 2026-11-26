import { BET_SIZES, CREDIT_PAYTABLE_VERSION, DEFAULT_BETTING, DENOMINATIONS_SEN, DESIGN_B_VERSION, JACKPOT_TIERS, LINE_OPTIONS, MAX_INITIAL_BANKROLL,
  BOARD_SYMBOLS, betPerLineSen, calculateJackpots, legacyJackpots, totalBetSen } from './config'
import { BONUS } from './bonusConfig'
import { LANTERN } from './lanternConfig'
import { evaluateLines, evaluateScatter, freeSpinScenario, generateBoard, legacyLinePayout, respin, sampleBoard, sampleOrbs,
  settleBonus, startingOrbs, triggersBonus } from './engine'
import type { Betting, SymbolId, Jackpot, JackpotPrizes, PaytableVersion } from './config'
import type { LineWin, Random, Result, Scenario, Slots } from './engine'
import type { OrbWager } from './orbPrizes'

export type Settings = { muted: boolean; volume: number; musicVolume: number; reelVolume: number; orbVolume: number;
  jackpotVolume: number; speed: number; reduced: boolean }
export const DEFAULT_SETTINGS: Settings = {
  muted: false, volume: 0.55, musicVolume: 0.35, reelVolume: 1, orbVolume: 1, jackpotVolume: 1, speed: 1, reduced: false,
}
export type Stats = {
  spins: number
  wagered: number
  won: number
  bonuses: number
  freeFeatures: number
  freePlayed: number
  freeRetriggers: number
  jackpots: Record<Jackpot, number>
  biggest: number
}
// A null betting snapshot identifies a pending round carried forward from version 1.
type Spin = { id: string; bet: number; lines: number; betting: Betting | null;
  jackpotPrizes?: JackpotPrizes; board: SymbolId[]; scenario?: Scenario; paytableVersion?: Exclude<PaytableVersion, 1> }
export const spinJackpots = (spin: Pick<Spin, 'jackpotPrizes' | 'bet'>) =>
  spin.jackpotPrizes ?? legacyJackpots(spin.bet)
const spinOrbWager = (spin: Spin): OrbWager => ({
  denominationSen: spin.betting?.denominationSen ?? 1,
  bet: spin.bet,
  legacyBetSize: (spin.paytableVersion ?? 1) < CREDIT_PAYTABLE_VERSION ? spin.betting?.betSize ?? 1 : undefined,
  paytableVersion: spin.paytableVersion ?? 1,
  jackpotPrizes: spinJackpots(spin),
})
type SpinOutcome = { line: number; lines: LineWin[]; scatter: number; lanterns: number }
type FeaturePayout = { line: number; scatter: number; bonus: number; jackpots: Record<Jackpot, number> }
type QueuedHold = { spin: Spin; orbs: Slots }
export type FreeSpins = {
  root: Spin
  remaining: number
  awarded: number
  retriggers: number
  paid: FeaturePayout
  free: FeaturePayout
  paidHold: Slots | null
  nextHold: QueuedHold | null
}
type Bonus = {
  spin: Spin
  orbs: Slots
  remaining: number
  turn: number
  next: ReturnType<typeof respin> | null
}
export type Round =
  | { phase: 'IDLE' }
  | { phase: 'SPINNING'; spin: Spin; orbs: Slots }
  | { phase: 'BONUS_TRIGGER' | 'BONUS_READY' | 'BONUS_RESPIN'; bonus: Bonus }
  | { phase: 'FREE_INTRO' | 'FREE_WAIT'; spinId: string; outcome: SpinOutcome; extra: number }
  | { phase: 'FEATURE_HOLD_RESULT'; holdResult: Result; orbs: Slots; collectionComplete?: true }
  | { phase: 'FREE_COMPLETE'; result: Result }
  | { phase: 'LINE_WIN' | 'BONUS_RESULT' | 'JACKPOT_CELEBRATION'; result: Result; orbs: Slots | null; collectionComplete?: true }

export type Session = {
  version: 5
  gameplayRevision?: number
  balance: number
  initialBankroll: number | null
  betting: Betting
  board: SymbolId[]
  boardOrbs: Slots
  last: Result | null
  settings: Settings
  stats: Stats
  round: Round
  freeSpins: FreeSpins | null
}

const blankJackpots = () => ({ mini: 0, minor: 0, major: 0, grand: 0 })
const blankPayout = (): FeaturePayout => ({ line: 0, scatter: 0, bonus: 0, jackpots: blankJackpots() })
export const blankStats = (): Stats => ({
  spins: 0, wagered: 0, won: 0, bonuses: 0, biggest: 0,
  freeFeatures: 0, freePlayed: 0, freeRetriggers: 0, jackpots: blankJackpots(),
})

export function newSession(): Session {
  const board = sampleBoard()
  return {
    version: 5, balance: 0, initialBankroll: null, betting: { ...DEFAULT_BETTING },
    board, boardOrbs: sampleOrbs(board), last: null, round: { phase: 'IDLE' }, stats: blankStats(),
    settings: { ...DEFAULT_SETTINGS }, freeSpins: null,
  }
}

export const lastWinSen = ({ round, last, freeSpins }: Session) =>
  (freeSpins && round.phase !== 'FREE_COMPLETE') || 'spin' in round || 'bonus' in round ||
  ((round.phase === 'BONUS_RESULT' || round.phase === 'JACKPOT_CELEBRATION') && !round.collectionComplete)
    ? 0 : last?.total ?? 0

export const validBetting = (betting: Betting) =>
  DENOMINATIONS_SEN.some(value => value === betting.denominationSen) &&
  BET_SIZES.some(value => value === betting.betSize) && LINE_OPTIONS.some(value => value === betting.lines)

export function selectBetting(session: Session, selection: Partial<Betting>): Session {
  const betting = { ...session.betting, ...selection }
  return session.round.phase === 'IDLE' && session.initialBankroll !== null && validBetting(betting)
    ? { ...session, betting, boardOrbs: session.last ? session.boardOrbs : sampleOrbs(session.board, betting) } : session
}

export function selectDenomination(session: Session, denominationSen: number): Session {
  if (session.betting.denominationSen === denominationSen) return session
  return selectBetting(session, { denominationSen, betSize: DEFAULT_BETTING.betSize })
}

export function startSpin(session: Session, rng: Random, id: string, scenario?: Scenario): Session {
  const { betting, balance, stats } = session
  const bet = totalBetSen(betting)
  if (session.round.phase !== 'IDLE' || session.initialBankroll === null || balance < bet ||
      session.last?.spinId === id || scenario === 'insufficient') return session
  const board = generateBoard(rng, scenario)
  const spin: Spin = { id, bet, lines: betting.lines, betting: { ...betting }, paytableVersion: DESIGN_B_VERSION,
    jackpotPrizes: calculateJackpots(betting.denominationSen), board, scenario }
  const orbs = startingOrbs(board, rng, spinOrbWager(spin), scenario)
  return {
    ...session, balance: balance - bet,
    stats: { ...stats, spins: stats.spins + 1, wagered: stats.wagered + bet },
    round: { phase: 'SPINNING', spin, orbs },
  }
}

function spinOutcome(spin: Spin): SpinOutcome {
  const version = spin.paytableVersion ?? 1
  const unit = spin.betting ? version === CREDIT_PAYTABLE_VERSION ? spin.betting.denominationSen : betPerLineSen(spin.betting)
    : spin.bet
  const { wins, amount } = evaluateLines(spin.board, unit, spin.lines, version)
  // Only migrated rounds use the former rule of rounding the aggregate fractional line payout.
  const line = spin.betting ? amount : legacyLinePayout(amount, spin.lines)
  const scatter = evaluateScatter(spin.board, spin.bet, version)
  return { line, lines: wins, scatter: scatter.amount, lanterns: scatter.count }
}

function credit(session: Session, result: Result): Session {
  const counts = result.jackpotCounts ?? countAwards(result)
  const jackpots = addJackpots(session.stats.jackpots, counts)
  return {
    ...session, balance: session.balance + result.total, last: result,
    stats: { ...session.stats, jackpots, won: session.stats.won + result.total,
      biggest: Math.max(session.stats.biggest, result.total) },
  }
}

function countAwards({ awards }: Result): Record<Jackpot, number> {
  const counts = blankJackpots()
  for (const award of awards) counts[award.tier]++
  return counts
}

const addJackpots = (left: Record<Jackpot, number>, right: Record<Jackpot, number>) =>
  ({ mini: left.mini + right.mini, minor: left.minor + right.minor,
    major: left.major + right.major, grand: left.grand + right.grand })

export const jackpotTotal = (counts: Record<Jackpot, number>, prizes: JackpotPrizes) =>
  JACKPOT_TIERS.reduce((sum, tier) => sum + counts[tier] * prizes[tier], 0)

export const freeSpinsWin = ({ free, root }: FreeSpins) =>
  free.line + free.scatter + free.bonus + jackpotTotal(free.jackpots, spinJackpots(root))

function settle(session: Session, spin: Spin, orbs: Slots | null): Session {
  if (session.last?.spinId === spin.id) return session
  const feature = session.freeSpins
  const { line, lines, scatter } = feature ? { line: 0, lines: [], scatter: 0 } : spinOutcome(spin)
  const jackpotPrizes = spinJackpots(spin)
  const { bonus, jackpot, awards } = orbs
    ? settleBonus(orbs, jackpotPrizes) : { bonus: 0, jackpot: 0, awards: [] }
  const total = line + scatter + bonus + jackpot
  const result: Result = {
    spinId: spin.id, bonusId: orbs ? `${spin.id}:bonus` : null,
    bet: spin.bet, lines, line, scatter, bonus, jackpot, total, awards, jackpotPrizes,
  }
  if (feature && orbs) {
    const bucket = spin.id === feature.root.id ? 'paid' : 'free'
    const payout = feature[bucket]
    return {
      ...session,
      freeSpins: { ...feature, [bucket]: {
        ...payout, bonus: payout.bonus + bonus, jackpots: addJackpots(payout.jackpots, countAwards(result)),
      } },
      round: { phase: 'FEATURE_HOLD_RESULT', holdResult: result, orbs },
    }
  }
  const phase = jackpot ? 'JACKPOT_CELEBRATION' : orbs ? 'BONUS_RESULT' : 'LINE_WIN'
  return {
    ...credit(session, result),
    round: total || orbs ? { phase, result, orbs } : { phase: 'IDLE' },
  }
}

export function revealSpin(session: Session, id: string): Session {
  const { round } = session
  if (round.phase !== 'SPINNING' || round.spin.id !== id) return session
  const { spin, orbs } = round
  const revealed = { ...session, board: spin.board, boardOrbs: orbs }
  const hold = triggersBonus(spin.board)
  const feature = session.freeSpins
  const lanterns = spin.board.filter(symbol => symbol === 'lantern').length
  if (feature || lanterns >= 3) {
    const outcome = spinOutcome(spin)
    if (!feature) return {
      ...revealed, stats: { ...session.stats, freeFeatures: session.stats.freeFeatures + 1 },
      freeSpins: {
        root: spin, remaining: LANTERN.initialSpins, awarded: LANTERN.initialSpins, retriggers: 0,
        paid: { ...blankPayout(), line: outcome.line, scatter: outcome.scatter }, free: blankPayout(),
        paidHold: hold ? orbs : null, nextHold: null,
      },
      round: { phase: 'FREE_INTRO', spinId: id, outcome, extra: 0 },
    }
    const extra = lanterns >= 3 ? LANTERN.extraSpins : 0
    return {
      ...revealed, stats: { ...session.stats, freeRetriggers: session.stats.freeRetriggers + Number(extra > 0) },
      freeSpins: {
        ...feature, remaining: feature.remaining + extra, awarded: feature.awarded + extra,
        retriggers: feature.retriggers + Number(extra > 0),
        nextHold: hold ? { spin, orbs } : null,
        free: { ...feature.free, line: feature.free.line + outcome.line, scatter: feature.free.scatter + outcome.scatter },
      },
      round: { phase: 'FREE_WAIT', spinId: id, outcome, extra },
    }
  }
  if (!hold) return settle(revealed, spin, null)
  return beginHold(revealed, { spin, orbs })
}

function beginHold(session: Session, { spin, orbs }: QueuedHold): Session {
  return {
    ...session, board: spin.board, boardOrbs: orbs,
    stats: { ...session.stats, bonuses: session.stats.bonuses + 1 },
    round: { phase: 'BONUS_TRIGGER', bonus: { spin, orbs, remaining: BONUS.respins, turn: 0, next: null } },
  }
}

export function freeTransitionId(round: Round): string | null {
  if (round.phase === 'FREE_INTRO' || round.phase === 'FREE_WAIT') return round.spinId
  if (round.phase === 'FEATURE_HOLD_RESULT') return round.holdResult.spinId
  if (round.phase === 'FREE_COMPLETE') return round.result.spinId
  return null
}

export function completeHoldCollection(session: Session, id: string): Session {
  const { round } = session
  if (round.phase !== 'FEATURE_HOLD_RESULT' && round.phase !== 'BONUS_RESULT' && round.phase !== 'JACKPOT_CELEBRATION') return session
  const result = round.phase === 'FEATURE_HOLD_RESULT' ? round.holdResult : round.result
  if (result.bonusId !== id || round.collectionComplete) return session
  return { ...session, round: { ...round, collectionComplete: true } }
}

export function advanceFreeSpins(session: Session, phase: Round['phase'], id: string, rng: Random): Session {
  const feature = session.freeSpins
  if (!feature || session.round.phase !== phase || freeTransitionId(session.round) !== id) return session
  if (session.round.phase === 'FEATURE_HOLD_RESULT' && !session.round.collectionComplete) return session
  if (phase === 'FREE_COMPLETE') return { ...session, freeSpins: null, round: { phase: 'IDLE' } }
  if (feature.nextHold) {
    return beginHold({ ...session, freeSpins: { ...feature, nextHold: null } }, feature.nextHold)
  }
  if (feature.remaining > 0) {
    const number = feature.awarded - feature.remaining + 1
    const scenario = freeSpinScenario(feature.root.scenario, number)
    const paytableVersion = feature.root.paytableVersion ?? 2
    const board = generateBoard(rng, scenario, true, paytableVersion)
    const spin = { ...feature.root, id: `${feature.root.id}:free:${number}`, board, scenario, paytableVersion }
    return {
      ...session, stats: { ...session.stats, freePlayed: session.stats.freePlayed + 1 },
      freeSpins: { ...feature, remaining: feature.remaining - 1 },
      round: { phase: 'SPINNING', spin, orbs: startingOrbs(board, rng, spinOrbWager(spin), scenario) },
    }
  }
  if (feature.paidHold) {
    return beginHold({ ...session, freeSpins: { ...feature, paidHold: null } },
      { spin: feature.root, orbs: feature.paidHold })
  }
  const { root, paid, free } = feature
  const jackpotCounts = addJackpots(paid.jackpots, free.jackpots)
  const line = paid.line + free.line
  const scatter = paid.scatter + free.scatter
  const bonus = paid.bonus + free.bonus
  const jackpotPrizes = spinJackpots(root)
  const jackpot = jackpotTotal(jackpotCounts, jackpotPrizes)
  const result: Result = {
    spinId: root.id, bonusId: bonus || jackpot ? `${root.id}:bonus` : null, bet: root.bet,
    lines: [], line, scatter, bonus, jackpot, total: line + scatter + bonus + jackpot,
    awards: [], jackpotCounts, jackpotPrizes, freeSpins: freeSpinsWin(feature),
  }
  return { ...credit(session, result), round: { phase: 'FREE_COMPLETE', result } }
}

export function openBonus(session: Session, id: string): Session {
  const { round } = session
  if (round.phase !== 'BONUS_TRIGGER' || round.bonus.spin.id !== id) return session
  return round.bonus.orbs.every(Boolean)
    ? settle(session, round.bonus.spin, round.bonus.orbs)
    : { ...session, round: { phase: 'BONUS_READY', bonus: round.bonus } }
}

export function startRespin(session: Session, rng: Random, guard?: { spinId: string; turn: number }): Session {
  if (session.round.phase !== 'BONUS_READY') return session
  const { bonus } = session.round
  if (guard
    ? !session.freeSpins || guard.spinId !== bonus.spin.id || guard.turn !== bonus.turn
    : session.freeSpins) return session
  return {
    ...session,
    round: { phase: 'BONUS_RESPIN', bonus: {
      ...bonus, turn: bonus.turn + 1,
      next: respin(bonus.orbs, bonus.remaining, rng, spinOrbWager(bonus.spin), bonus.spin.scenario),
    } },
  }
}

export function revealRespin(session: Session, id: string, turn: number): Session {
  const { round } = session
  if (round.phase !== 'BONUS_RESPIN' || round.bonus.spin.id !== id || round.bonus.turn !== turn) return session
  const { bonus } = round
  const { next } = bonus
  if (!next) return session
  if (next.done) return settle(session, bonus.spin, next.orbs)
  return {
    ...session,
    round: { phase: 'BONUS_READY', bonus: { ...bonus, orbs: next.orbs, remaining: next.remaining, next: null } },
  }
}

export function dismissResult(session: Session, id: string): Session {
  if (session.freeSpins || !('result' in session.round) || session.round.result.spinId !== id) return session
  if ((session.round.phase === 'BONUS_RESULT' || session.round.phase === 'JACKPOT_CELEBRATION') &&
      !session.round.collectionComplete) return session
  return { ...session, round: { phase: 'IDLE' } }
}

export function setBankroll(session: Session, amount: number, mode: 'initial' | 'reset'): Session {
  if (session.round.phase !== 'IDLE' || (session.initialBankroll === null) !== (mode === 'initial') ||
      !Number.isSafeInteger(amount) || amount < 0 || amount > MAX_INITIAL_BANKROLL) return session
  return { ...newSession(), initialBankroll: amount, balance: amount,
    betting: session.betting, settings: session.settings }
}

export function resetGame(session: Session): Session {
  return session.initialBankroll === null ? session :
    setBankroll(session, session.initialBankroll, 'reset')
}

export function resetStats(session: Session): Session {
  return session.round.phase === 'IDLE' ? { ...session, stats: blankStats() } : session
}

export const knownSymbol = (value: unknown): value is SymbolId =>
  typeof value === 'string' && Object.hasOwn(BOARD_SYMBOLS, value)

