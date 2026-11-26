import { totalBetSen } from './config'
import type { Betting } from './config'
import type { Random, Scenario } from './engine'
import { dismissResult, revealRespin, revealSpin, startRespin, startSpin } from './session'
import type { Session } from './session'

export type RoundIntent =
  | { kind: 'continue'; spinId: string }
  | { kind: 'respin'; spinId: string; turn: number }
  | { kind: 'stop-spin'; spinId: string }
  | { kind: 'stop-respin'; spinId: string; turn: number }
  | { kind: 'spin'; revision: number; betting: Betting }

export function roundIntent(session: Session): RoundIntent | null {
  const { round, freeSpins } = session
  if (round.phase === 'SPINNING') return { kind: 'stop-spin', spinId: round.spin.id }
  if (round.phase === 'BONUS_RESPIN') {
    return { kind: 'stop-respin', spinId: round.bonus.spin.id, turn: round.bonus.turn }
  }
  if (freeSpins) return null
  if (round.phase === 'LINE_WIN' ||
      ((round.phase === 'BONUS_RESULT' || round.phase === 'JACKPOT_CELEBRATION') && round.collectionComplete)) {
    return { kind: 'continue', spinId: round.result.spinId }
  }
  if (round.phase === 'BONUS_READY') return { kind: 'respin', spinId: round.bonus.spin.id, turn: round.bonus.turn }
  if (round.phase === 'IDLE' && session.initialBankroll !== null && session.balance >= totalBetSen(session.betting)) {
    return { kind: 'spin', revision: session.gameplayRevision ?? 0, betting: session.betting }
  }
  return null
}

export function roundIntentKey(intent: RoundIntent | null): string {
  if (!intent) return 'unavailable'
  switch (intent.kind) {
    case 'continue':
    case 'stop-spin': return `${intent.kind}:${intent.spinId}`
    case 'respin':
    case 'stop-respin': return `${intent.kind}:${intent.spinId}:${intent.turn}`
    case 'spin': {
      const { denominationSen, betSize, lines } = intent.betting
      return `spin:${intent.revision}:${denominationSen}:${betSize}:${lines}`
    }
  }
}

export function applyRoundIntent(session: Session, intent: RoundIntent, rng: Random, createId: () => string, scenario?: Scenario) {
  if (roundIntentKey(roundIntent(session)) !== roundIntentKey(intent)) return session
  switch (intent.kind) {
    case 'continue': return dismissResult(session, intent.spinId)
    case 'respin': return startRespin(session, rng)
    case 'stop-spin': return revealSpin(session, intent.spinId)
    case 'stop-respin': return revealRespin(session, intent.spinId, intent.turn)
    case 'spin': return startSpin(session, rng, createId(), scenario)
  }
}

export function stampGameplayRevision(previous: Session, next: Session): Session {
  return next.round === previous.round && next.betting === previous.betting ? next
    : { ...next, gameplayRevision: (previous.gameplayRevision ?? 0) + 1 }
}
