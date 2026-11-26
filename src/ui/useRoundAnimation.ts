import { useEffect, useRef, useState } from 'react'
import { REELS, ROWS } from '../game/config'
import { BONUS } from '../game/bonusConfig'
import { secureRandom } from '../game/engine'
import { freeTransitionId, openBonus, revealRespin, revealSpin } from '../game/session'
import type { Session } from '../game/session'
import { listenForAudioGestures, play, playRoundCue, setAudio, setMusicMode } from './audio'
import { musicModeForRound } from './music'
import { automaticRoundStep } from './automaticRound'
import { createRoundCues, newBonusOrbs, oncePerRound } from './roundCues'
import type { RoundCue, SymbolLanding } from './roundCues'

const stopTimes = [710, 865, 1020, 1175, 1330]
const compactEffectsQuery = '(max-width: 680px), (max-width: 1100px) and (max-height: 540px) and (orientation: landscape)'
const reelTiming = (speed: number, reduced: boolean) =>
  stopTimes.map((time, reel) => reduced ? 110 + reel * 85 : time / speed)

export function useRoundAnimation(session: Session, commit: (update: (s: Session) => Session) => Promise<boolean>) {
  const { round, settings } = session
  const inFreeSpins = session.freeSpins !== null
  const [systemReduced, setSystemReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [compact, setCompact] = useState(() => window.matchMedia(compactEffectsQuery).matches)
  const reduced = settings.reduced || systemReduced
  const latest = useRef({ round, settings, reduced, compact })
  const [visual, setVisual] = useState({ scope: '', stopped: [] as number[], landed: [] as number[], cells: [] as number[] })
  const [timing, setTiming] = useState({ scope: '', duration: reelTiming(settings.speed, reduced), reduced, compact })
  const reelCallback = useRef<{ scope: string; stop: (reel: number) => void } | null>(null)
  const emitOnce = useRef(oncePerRound((cue: RoundCue | 'reel' | 'line') => {
    if (typeof cue === 'string') play(cue, latest.current.settings)
    else playRoundCue(cue, latest.current.settings)
  })).current

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const compactQuery = window.matchMedia(compactEffectsQuery)
    const sync = () => setSystemReduced(query.matches)
    const syncCompact = () => setCompact(compactQuery.matches)
    query.addEventListener('change', sync)
    compactQuery.addEventListener('change', syncCompact)
    return () => {
      query.removeEventListener('change', sync)
      compactQuery.removeEventListener('change', syncCompact)
    }
  }, [])
  useEffect(() => listenForAudioGestures(window), [])
  useEffect(() => {
    latest.current = { round, settings, reduced, compact }
    setAudio(settings)
    setMusicMode(musicModeForRound(round, inFreeSpins))
  }, [round, settings, reduced, compact, inFreeSpins])

  const id = 'spin' in round ? round.spin.id : 'bonus' in round ? round.bonus.spin.id :
    freeTransitionId(round) ?? ('result' in round ? round.result.spinId : '')
  const turn = 'bonus' in round ? round.bonus.turn : 0
  const scope = `${id}:${round.phase}:${turn}:${'collectionComplete' in round && round.collectionComplete ? 'collected' : ''}`

  useEffect(() => {
    const active = latest.current
    const timers: number[] = []
    const schedule = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms))
    const duration = reelTiming(active.settings.speed, active.reduced)
    const shorten = (ms: number) => active.reduced ? Math.round(ms / 6) : ms / active.settings.speed
    const sound = (key: string, cue: RoundCue | 'reel' | 'line') => emitOnce(id, `${scope}:${key}`, cue)
    const record = (field: 'stopped' | 'landed' | 'cells', index: number) =>
      setVisual(previous => {
        const current = previous.scope === scope ? previous : { scope, stopped: [], landed: [], cells: [] }
        return { ...current, [field]: [...current[field], index] }
      })
    const cues = createRoundCues({
      now: () => performance.now(), schedule, reveal: position => record('landed', position),
      holdAndSpin: active.round.phase === 'BONUS_RESPIN',
      emit: cue => sound('reel' in cue ? `${cue.type}:${cue.reel}` :
        'position' in cue ? `${cue.type}:${cue.position}` : cue.type, cue),
    })

    if (active.round.phase === 'SPINNING') {
      const spin = active.round
      setTiming({ scope, duration, reduced: active.reduced, compact: active.compact })
      sound('roll', 'reel')
      let stopped = 0
      const stop = (reel: number) => {
        const from = reel * ROWS
        const landings = spin.spin.board.slice(from, from + ROWS).flatMap((symbol, row): SymbolLanding[] => {
          const position = from + row
          if (symbol === 'lantern') return [{ position, lantern: true }]
          if (symbol !== 'orb') return []
          const orb = spin.orbs[position]
          return [{ position, tier: orb && 'tier' in orb ? orb.tier : undefined }]
        })
        if (cues.stop(reel, landings, () => record('stopped', reel))) {
          stopped++
          if (stopped === REELS) cues.finish(() => { void commit(previous => revealSpin(previous, id)) }, shorten(250))
        }
      }
      reelCallback.current = { scope, stop }
      // Keep the fallback close to each reel's contact point if animationend is missed.
      duration.forEach((ms, reel) => schedule(ms + 110, () => stop(reel)))
    }
    if (active.round.phase === 'BONUS_TRIGGER') {
      sound('trigger', { type: 'BONUS_TRIGGER' })
      schedule(shorten(1550), () => { void commit(previous => openBonus(previous, id)) })
    }
    if (active.round.phase === 'BONUS_RESPIN') {
      sound('roll', 'reel')
      const { bonus } = active.round
      const next = bonus.next
      if (next) {
        const landings = newBonusOrbs(bonus.orbs, next.orbs)
        const empty = bonus.orbs.flatMap((orb, position) => orb ? [] : [position])
        empty.forEach((position, index) => schedule(shorten(620 + index * 58), () => {
          record('cells', position)
          const landing = landings.find(orb => orb.position === position)
          if (landing) cues.land([landing])
          if (index === empty.length - 1) cues.finish(async () => {
            const advanced = await commit(previous => revealRespin(previous, id, turn))
            if (advanced && landings.length && !next.done) sound('reset', { type: 'RESPIN_RESET' })
          }, shorten(110))
        }))
      }
    }
    const step = automaticRoundStep(active.round, inFreeSpins, secureRandom)
    if (step) {
      const longMessage = active.round.phase === 'FREE_INTRO' || active.round.phase === 'FREE_COMPLETE' ||
        (active.round.phase === 'FREE_WAIT' && active.round.extra > 0)
      const visibleWin = active.round.phase === 'FREE_WAIT' && active.round.outcome.line > 0
      const minimum = active.round.phase === 'FEATURE_HOLD_RESULT' ? 950 : longMessage ? 650 : visibleWin ? 350 : 0
      schedule(Math.max(minimum, shorten(step.delay)), () => { void commit(step.update) })
    }
    if (active.round.phase === 'FREE_INTRO') sound('free-intro', { type: 'FREE_TRIGGER' })
    else if (active.round.phase === 'FREE_COMPLETE') sound('free-complete', { type: 'FREE_COMPLETE' })
    else if (active.round.phase === 'FREE_WAIT') {
      if (active.round.extra) sound('retrigger', { type: 'FREE_RETRIGGER' })
      else if (active.round.outcome.line) sound('free-line', 'line')
    } else if ('result' in active.round || active.round.phase === 'FEATURE_HOLD_RESULT') {
      const result = 'result' in active.round ? active.round.result : active.round.holdResult
      const tier = result.awards[0]?.tier
      if (!result.bonusId || ('collectionComplete' in active.round && active.round.collectionComplete)) {
        if (tier) sound('result', { type: 'JACKPOT_CELEBRATION', tier })
        else sound('result', 'line')
      }
    }
    return () => {
      timers.forEach(timer => clearTimeout(timer))
      if (reelCallback.current?.scope === scope) reelCallback.current = null
    }
  }, [scope, id, turn, inFreeSpins, commit, emitOnce])

  const stopped = visual.scope === scope ? visual.stopped : []
  const landedSymbols = visual.scope === scope ? visual.landed : []
  const visibleOrbs = round.phase === 'SPINNING' ? landedSymbols.filter(index => round.spin.board[index] === 'orb').length : 0
  const anticipation = stopped.length < REELS && visibleOrbs >= BONUS.triggerCount - ROWS &&
    visibleOrbs + (REELS - stopped.length) * ROWS >= BONUS.triggerCount
  return {
    stopped, landedSymbols, reduced, anticipation, stoppedCells: visual.scope === scope ? visual.cells : [],
    duration: timing.scope === scope ? timing.duration : reelTiming(settings.speed, reduced),
    reducedReels: timing.scope === scope ? timing.reduced : reduced,
    compactReels: timing.scope === scope ? timing.compact : compact,
    onReelStop: (reel: number) => {
      if (reelCallback.current?.scope === scope) reelCallback.current.stop(reel)
    },
  }
}
