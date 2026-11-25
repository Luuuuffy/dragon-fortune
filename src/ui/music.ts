import { MUSIC_SAMPLE_RATE, renderMusic } from './musicScore'
import type { MusicMode } from './musicScore'
import type { Round } from '../game/session'

export const MUSIC_FADE_SECONDS = 0.55
export function musicModeForRound(round: Round, inFreeSpins: boolean): MusicMode {
  if (round.phase === 'FEATURE_HOLD_RESULT' || round.phase === 'BONUS_RESULT' || round.phase === 'JACKPOT_CELEBRATION') {
    if (!round.collectionComplete) return 'HOLD_AND_SPIN_COLLECTION'
    const result = round.phase === 'FEATURE_HOLD_RESULT' ? round.holdResult : round.result
    return result.awards.some(award => award.tier === 'grand') ? 'GRAND_CELEBRATION' : 'HOLD_AND_SPIN_CELEBRATION'
  }
  if ('bonus' in round) return 'HOLD_AND_SPIN'
  return inFreeSpins && round.phase !== 'FREE_COMPLETE' ? 'FREE_SPINS' : 'NORMAL'
}

type Voice = { source: AudioBufferSourceNode; gain: GainNode; mode: MusicMode; started: number; offset: number }

export function createMusicManager(context: AudioContext, output: GainNode) {
  const duckGain = context.createGain()
  duckGain.connect(output)
  const buffers = new Map<MusicMode, AudioBuffer>()
  const offsets = new Map<MusicMode, number>()
  let active: Voice | undefined
  let fading: Voice | undefined
  let duckUntil = 0
  let duckDepth = 1

  function bufferFor(mode: MusicMode) {
    const existing = buffers.get(mode)
    if (existing) return existing
    const samples = renderMusic(mode)
    const buffer = context.createBuffer(1, samples.length, MUSIC_SAMPLE_RATE)
    buffer.copyToChannel(samples, 0)
    buffers.set(mode, buffer)
    return buffer
  }

  function holdValue(gain: AudioParam, now: number) {
    if (typeof gain.cancelAndHoldAtTime === 'function') gain.cancelAndHoldAtTime(now)
    else {
      const value = gain.value
      gain.cancelScheduledValues(now)
      gain.setValueAtTime(value, now)
    }
  }

  return {
    setMode(mode: MusicMode) {
      if (active?.mode === mode) return
      const buffer = bufferFor(mode)
      const now = context.currentTime
      // Limit overlap to one incoming track and one outgoing crossfade.
      if (fading) fading.source.stop(now)
      if (active) {
        const { source, gain, started, offset } = active
        offsets.set(active.mode, (offset + now - started) % source.buffer!.duration)
        holdValue(gain.gain, now)
        gain.gain.linearRampToValueAtTime(0, now + MUSIC_FADE_SECONDS)
        source.stop(now + MUSIC_FADE_SECONDS)
      }
      fading = active
      const source = context.createBufferSource()
      const gain = context.createGain()
      const offset = offsets.get(mode) ?? 0
      source.buffer = buffer
      source.loop = true
      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(1, now + MUSIC_FADE_SECONDS)
      source.connect(gain)
      gain.connect(duckGain)
      const voice = { source, gain, mode, started: now, offset }
      source.onended = () => {
        source.disconnect()
        gain.disconnect()
        if (fading === voice) fading = undefined
      }
      active = voice
      source.start(now, offset)
    },
    duck(depth: number, seconds: number) {
      const now = context.currentTime
      duckDepth = Math.min(now < duckUntil ? duckDepth : 1, depth)
      duckUntil = Math.max(duckUntil, now + seconds)
      holdValue(duckGain.gain, now)
      duckGain.gain.linearRampToValueAtTime(duckDepth, now + 0.04)
      duckGain.gain.setValueAtTime(duckDepth, duckUntil)
      duckGain.gain.linearRampToValueAtTime(1, duckUntil + 0.40)
    },
  }
}
