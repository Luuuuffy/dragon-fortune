import { money } from '../game/config'
import { LANTERN } from '../game/lanternConfig'
import { freeSpinsWin } from '../game/session'
import type { FreeSpins, Round } from '../game/session'
import { Coins } from './Celebration'
import { Symbol } from './Symbol'

export function FreeSpinsMeters({ feature, increase }: { feature: FreeSpins; increase: boolean }) {
  return <>
    <span className="free-spin-remaining">FREE SPINS REMAINING <b key={feature.remaining}
      className={increase ? 'counter-increase' : ''}>{feature.remaining}</b></span>
    <span className="free-spin-win">FREE SPINS WIN <strong>{money(freeSpinsWin(feature))}</strong></span>
  </>
}

export function FreeSpinsDisplay({ feature, round, reduced }: {
  feature: FreeSpins; round: Round; reduced: boolean;
}) {
  const intro = round.phase === 'FREE_INTRO'
  const extra = round.phase === 'FREE_WAIT' ? round.extra : 0
  const complete = round.phase === 'FREE_COMPLETE'
  if (!intro && !extra && !complete) return null
  return <div key={round.phase === 'FREE_WAIT' ? round.spinId : round.phase} className="free-message" role="status">
    {complete && !reduced && <Coins count={20}/>}
    <div className="lantern-emblem"><Symbol symbol="lantern"/></div>
    <strong>{complete ? 'FREE SPINS COMPLETE' : intro ? `${LANTERN.initialSpins} FREE SPINS` : `${extra} EXTRA FREE SPINS`}</strong>
    <span>{complete ? `Free Spins win ${money(freeSpinsWin(feature))}`
      : 'outcome' in round ? `Lantern Scatter ${money(round.outcome.scatter)}` : ''}</span>
  </div>
}
