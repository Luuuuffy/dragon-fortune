import type { Orb } from '../game/engine'

type OrbTier = Extract<Orb, { tier: unknown }>['tier']
export type OrbLanding = { position: number; tier?: OrbTier }
export type SymbolLanding = OrbLanding | { position: number; lantern: true }
export type RoundCue =
  | { type: 'REEL_STOP'; reel: number }
  | { type: 'GOLD_ORB_LAND'; position: number; pitch: number; impact?: true }
  | { type: 'JACKPOT_ORB_LAND'; position: number; tier: OrbTier }
  | { type: 'LANTERN_LAND'; position: number }
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

  function land(symbols: SymbolLanding[], lead = 0) {
    let at = Math.max(now() + lead, nextOrbAt)
    for (const symbol of symbols) {
      const { position } = symbol
      if ('lantern' in symbol) {
        schedule(Math.max(0, at - now()), () => {
          reveal(position)
          emit({ type: 'LANTERN_LAND', position })
        })
        revealEndsAt = Math.max(revealEndsAt, at + 195)
        at += 110
        continue
      }
      const { tier } = symbol
      const pitch = 2 ** (Math.min(pitchStep++, 6) / 24)
      const impact = holdAndSpin || Boolean(tier)
      schedule(Math.max(0, at - now()), () => {
        reveal(position)
        emit({ type: 'GOLD_ORB_LAND', position, pitch, ...(impact ? { impact: true } : {}) })
      })
      if (tier) schedule(Math.max(0, at + 155 - now()), () => emit({ type: 'JACKPOT_ORB_LAND', position, tier }))
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
      emit({ type: 'REEL_STOP', reel })
      if (symbols.length) land(symbols, 45)
      return true
    },
    land,
    finish(callback: () => void, minimum = 0) {
      schedule(Math.max(minimum, revealEndsAt - now()), callback)
    },
  }
}
