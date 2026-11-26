import { REELS, ROWS } from '../game/config'
import { BONUS } from '../game/bonusConfig'
import type { Orb } from '../game/engine'

type OrbTier = Extract<Orb, { tier: unknown }>['tier']
export type OrbLanding = { position: number; tier?: OrbTier }
export type SymbolLanding = OrbLanding | { position: number; lantern: true }
export type RoundCue =
  | { type: 'REEL_STOP'; reel: number }
  | { type: 'GOLD_ORB_LAND'; position: number; pitch: number; impact?: true }
  | { type: 'JACKPOT_ORB_LAND'; position: number; tier: OrbTier }
  | { type: 'FREE_TRIGGER' | 'FREE_RETRIGGER' | 'FREE_COMPLETE' }
  | { type: 'RESPIN_RESET' }
  | { type: 'BONUS_TRIGGER' }
  | { type: 'JACKPOT_CELEBRATION'; tier: OrbTier | 'grand' }

export function newBonusOrbs(locked: (Orb | null)[], next: (Orb | null)[]): OrbLanding[] {
  return next.flatMap((orb, position) => orb && !locked[position]
    ? [{ position, tier: 'tier' in orb ? orb.tier : undefined }] : [])
}

export function oncePerRound<T>(play: (cue: T) => void) {
  let active = ''
  const played = new Set<string>()
  return (roundId: string, key: string, cue: T) => {
    if (active !== roundId) {
      active = roundId
      played.clear()
    }
    if (played.has(key)) return
    played.add(key)
    play(cue)
  }
}

export function createRoundCues({
  now, schedule, emit, reveal, holdAndSpin = false,
}: {
  now: () => number
  schedule: (delay: number, callback: () => void) => void
  emit: (cue: RoundCue) => void
  reveal: (position: number) => void
  holdAndSpin?: boolean
}) {
  const stopped = new Set<number>()
  let nextOrbAt = 0
  let revealEndsAt = 0
  let pitchStep = 0
  let stoppedOrbs = 0

  function chime({ position, tier }: OrbLanding) {
    const pitch = 2 ** (Math.min(pitchStep++, 6) / 24)
    emit({ type: 'GOLD_ORB_LAND', position, pitch, ...(holdAndSpin || tier ? { impact: true } : {}) })
    if (tier) schedule(155, () => emit({ type: 'JACKPOT_ORB_LAND', position, tier }))
  }

  function land(symbols: OrbLanding[]) {
    let at = Math.max(now(), nextOrbAt)
    for (const symbol of symbols) {
      const { position, tier } = symbol
      schedule(Math.max(0, at - now()), () => {
        reveal(position)
        chime(symbol)
      })
      revealEndsAt = at + (tier ? 390 : 275)
      at += tier ? 390 : holdAndSpin ? 205 : 165
    }
    nextOrbAt = at
  }

  return {
    stop(reel: number, symbols: SymbolLanding[], showStopped: () => void) {
      if (stopped.has(reel)) return false
      stopped.add(reel)
      showStopped()
      for (const symbol of symbols) reveal(symbol.position)
      emit({ type: 'REEL_STOP', reel })
      const orbs = symbols.filter((symbol): symbol is OrbLanding => !('lantern' in symbol))
      stoppedOrbs += orbs.length
      // Count only reels the player has seen. Every moving reel could still supply three orbs.
      if (orbs.length && stoppedOrbs + (REELS - stopped.size) * ROWS >= BONUS.triggerCount) {
        const landing = orbs.find(orb => orb.tier) ?? orbs[0]
        chime(landing)
        if (landing.tier) revealEndsAt = Math.max(revealEndsAt, now() + 285)
      }
      return true
    },
    land,
    finish(callback: () => void, minimum = 0) {
      schedule(Math.max(minimum, revealEndsAt - now()), callback)
    },
  }
}
