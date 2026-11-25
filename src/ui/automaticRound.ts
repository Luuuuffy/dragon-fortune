import { LANTERN } from '../game/lanternConfig'
import { advanceFreeSpins, freeTransitionId, startRespin } from '../game/session'
import type { Random } from '../game/engine'
import type { Round, Session } from '../game/session'

export function automaticRoundStep(round: Round, freeSpins: boolean, rng: Random) {
  if (!freeSpins) return null
  if (round.phase === 'FEATURE_HOLD_RESULT' && !round.collectionComplete) return null
  const id = freeTransitionId(round)
  const { timing } = LANTERN
  if (round.phase === 'BONUS_READY') {
    const { spin, turn } = round.bonus
    return { delay: timing.queuedRespin,
      update: (session: Session) => startRespin(session, rng, { spinId: spin.id, turn }) }
  }
  if (id === null) return null
  const delay = round.phase === 'FREE_INTRO' ? timing.intro :
    round.phase === 'FREE_COMPLETE' ? timing.complete :
    round.phase === 'FEATURE_HOLD_RESULT' ? (round.holdResult.jackpot ? timing.queuedJackpot : timing.queuedResult) :
    round.phase === 'FREE_WAIT' && round.extra ? timing.retrigger : timing.between
  return { delay, update: (session: Session) => advanceFreeSpins(session, round.phase, id, rng) }
}
