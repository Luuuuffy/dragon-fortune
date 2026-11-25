import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS, advanceFreeSpins, completeHoldCollection, newSession, openBonus, revealRespin, revealSpin,
  setBankroll, startRespin, startSpin } from '../game/session'
import { MUSIC_FADE_SECONDS, createMusicManager, musicModeForRound } from './music'
import { renderMusic } from './musicScore'

const param = () => ({
  value: 1, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(),
  linearRampToValueAtTime: vi.fn(), cancelAndHoldAtTime: vi.fn(),
})
const createOscillator = vi.fn(() => ({
  frequency: param(), connect: vi.fn(), start: vi.fn(), stop: vi.fn(), type: 'sine',
}))
const createGain = vi.fn(() => ({ gain: param(), connect: vi.fn(), disconnect: vi.fn() }))
const createBufferSource = vi.fn(() => ({
  buffer: null as { duration: number } | null, loop: false, connect: vi.fn(), disconnect: vi.fn(),
  start: vi.fn(), stop: vi.fn(), onended: null as (() => void) | null,
}))
class MockAudioContext {
  currentTime = 3
  destination = {}
  state = 'running'
  createOscillator = createOscillator
  createGain = createGain
  createBufferSource = createBufferSource
  createBuffer(_channels: number, frames: number, rate: number) {
    return { duration: frames / rate, copyToChannel: vi.fn() }
  }
  createDynamicsCompressor() {
    return { threshold: param(), knee: param(), ratio: param(), attack: param(), release: param(), connect: vi.fn() }
  }
}

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  vi.stubGlobal('AudioContext', MockAudioContext)
})
afterEach(() => vi.unstubAllGlobals())

it('unlocks audio on touch release and resumes an interrupted context on the next tap', async () => {
  const resume = vi.fn()
  const contexts: MockAudioContext[] = []
  vi.stubGlobal('AudioContext', class extends MockAudioContext {
    state = 'suspended'
    constructor() {
      super()
      contexts.push(this)
    }
    resume() {
      resume()
      this.state = 'running'
      return Promise.resolve()
    }
  })
  const target = new EventTarget()
  const { listenForAudioGestures } = await import('./audio')
  const stopListening = listenForAudioGestures(target as unknown as Window)
  target.dispatchEvent(Object.assign(new Event('pointerdown'), { pointerType: 'touch' }))
  expect(contexts).toHaveLength(0)
  target.dispatchEvent(Object.assign(new Event('pointerup'), { pointerType: 'touch' }))
  target.dispatchEvent(new Event('click'))
  expect(contexts).toHaveLength(1)
  expect(resume).toHaveBeenCalledTimes(1)
  contexts[0].state = 'interrupted'
  target.dispatchEvent(new Event('touchend'))
  expect(resume).toHaveBeenCalledTimes(2)
  stopListening()
  contexts[0].state = 'interrupted'
  target.dispatchEvent(new Event('touchend'))
  expect(resume).toHaveBeenCalledTimes(2)
})

it('mutes the master bus immediately and schedules no new audible cues', async () => {
  const { play, playRoundCue, setAudio, unlockAudio } = await import('./audio')
  unlockAudio()
  playRoundCue({ type: 'REEL_STOP', reel: 0 }, DEFAULT_SETTINGS)
  expect(createOscillator).toHaveBeenCalledTimes(2)
  const muted = { ...DEFAULT_SETTINGS, muted: true }
  setAudio(muted)
  expect(createGain.mock.results[0].value.gain.setValueAtTime).toHaveBeenLastCalledWith(0, 3)
  play('spin', muted)
  playRoundCue({ type: 'GOLD_ORB_LAND', position: 0, pitch: 1 }, muted)
  playRoundCue({ type: 'JACKPOT_CELEBRATION', tier: 'grand' }, muted)
  expect(createOscillator).toHaveBeenCalledTimes(2)
})

it('applies independent volume levels and skips oscillators for silenced categories', async () => {
  const { playRoundCue, setAudio, unlockAudio } = await import('./audio')
  unlockAudio()
  const settings = { ...DEFAULT_SETTINGS, volume: 0.8, musicVolume: 0.3, reelVolume: 0, orbVolume: 0.4, jackpotVolume: 0.6 }
  setAudio(settings)
  expect(createGain.mock.results.slice(0, 5).map(({ value }) => value.gain.setValueAtTime.mock.lastCall))
    .toEqual([[0.8, 3], [0, 3], [0.4, 3], [0.6, 3], [0.3, 3]])
  playRoundCue({ type: 'REEL_STOP', reel: 0 }, settings)
  expect(createOscillator).not.toHaveBeenCalled()
  playRoundCue({ type: 'GOLD_ORB_LAND', position: 0, pitch: 1.1 }, settings)
  expect(createOscillator).toHaveBeenCalledTimes(3)
  expect(createOscillator.mock.results[0].value.frequency.setValueAtTime)
    .toHaveBeenCalledWith(784 * 1.1, 3)
})

it('plays distinct Lantern, trigger, retrigger, and completion motifs on the master bus', async () => {
  const { playRoundCue, unlockAudio } = await import('./audio')
  unlockAudio()
  playRoundCue({ type: 'LANTERN_LAND', position: 4 }, DEFAULT_SETTINGS)
  playRoundCue({ type: 'FREE_TRIGGER' }, DEFAULT_SETTINGS)
  playRoundCue({ type: 'FREE_RETRIGGER' }, DEFAULT_SETTINGS)
  playRoundCue({ type: 'FREE_COMPLETE' }, DEFAULT_SETTINGS)
  expect(createOscillator).toHaveBeenCalledTimes(17)
  expect([0, 2, 8, 12].map(index =>
    createOscillator.mock.results[index].value.frequency.setValueAtTime.mock.lastCall?.[0]))
    .toEqual([988, 330, 587, 784])
  playRoundCue({ type: 'FREE_RETRIGGER' }, { ...DEFAULT_SETTINGS, muted: true })
  expect(createOscillator).toHaveBeenCalledTimes(17)
})

it('loops one persistent track per mode, crossfades and resumes from the saved playhead', () => {
  const context = new MockAudioContext()
  const music = createMusicManager(context as unknown as AudioContext, createGain() as unknown as GainNode)
  music.setMode('NORMAL')
  const normal = createBufferSource.mock.results[0].value
  expect(normal.loop).toBe(true)
  expect(normal.start).toHaveBeenCalledWith(3, 0)
  music.setMode('NORMAL')
  expect(createBufferSource).toHaveBeenCalledTimes(1)
  context.currentTime = 5
  music.setMode('FREE_SPINS')
  expect(normal.stop).toHaveBeenCalledWith(5 + MUSIC_FADE_SECONDS)
  expect(createGain.mock.results[2].value.gain.linearRampToValueAtTime)
    .toHaveBeenLastCalledWith(0, 5 + MUSIC_FADE_SECONDS)
  music.setMode('FREE_SPINS')
  expect(createBufferSource).toHaveBeenCalledTimes(2)
  normal.onended?.()
  expect(normal.disconnect).toHaveBeenCalledTimes(1)
  context.currentTime = 8
  music.setMode('HOLD_AND_SPIN')
  context.currentTime = 8.2
  music.setMode('FREE_SPINS')
  expect(createBufferSource.mock.results[1].value.stop).toHaveBeenLastCalledWith(8.2)
  expect(createBufferSource.mock.results[3].value.start).toHaveBeenCalledWith(8.2, 3)
  context.currentTime = 12
  music.setMode('NORMAL')
  expect(createBufferSource.mock.results[4].value.start).toHaveBeenCalledWith(12, 2)
})

it('selects music from the saved gameplay phase and keeps Free Spins on their track on retrigger', () => {
  const rng = () => 0.99
  const funded = setBankroll(newSession(), 100_000, 'initial')
  const { round: base } = startSpin(funded, rng, 'base', 'six')
  const hold = revealSpin(startSpin(funded, rng, 'hold', 'six'), 'hold')
  const free = revealSpin(startSpin(funded, rng, 'free', 'lanternRetrigger'), 'free')
  const spin = advanceFreeSpins(free, 'FREE_INTRO', 'free', rng)
  const extra = revealSpin(spin, 'free:free:1')
  expect(musicModeForRound(base, false)).toBe('NORMAL')
  expect(musicModeForRound(hold.round, false)).toBe('HOLD_AND_SPIN')
  expect(musicModeForRound(hold.round, true)).toBe('HOLD_AND_SPIN')
  expect(musicModeForRound(free.round, true)).toBe('FREE_SPINS')
  expect(musicModeForRound(spin.round, true)).toBe('FREE_SPINS')
  expect(musicModeForRound(extra.round, true)).toBe('FREE_SPINS')
  const grand = openBonus(revealSpin(startSpin(funded, rng, 'grand', 'full'), 'grand'), 'grand')
  expect(musicModeForRound(grand.round, false)).toBe('HOLD_AND_SPIN_COLLECTION')
  expect(musicModeForRound(completeHoldCollection(grand, 'grand:bonus').round, false)).toBe('GRAND_CELEBRATION')
  let ordinary = openBonus(hold, 'hold')
  for (let turn = 1; turn <= 3; turn++) ordinary = revealRespin(startRespin(ordinary, rng), 'hold', turn)
  expect(musicModeForRound(ordinary.round, false)).toBe('HOLD_AND_SPIN_COLLECTION')
  expect(musicModeForRound(completeHoldCollection(ordinary, 'hold:bonus').round, false)).toBe('HOLD_AND_SPIN_CELEBRATION')
})

it('uses distinct, bounded PCM music loops and smoothly ducks after loud sounds', async () => {
  const normal = renderMusic('NORMAL', 8000)
  const hold = renderMusic('HOLD_AND_SPIN', 8000)
  const free = renderMusic('FREE_SPINS', 8000)
  const collection = renderMusic('HOLD_AND_SPIN_COLLECTION', 8000)
  const celebration = renderMusic('HOLD_AND_SPIN_CELEBRATION', 8000)
  const grand = renderMusic('GRAND_CELEBRATION', 8000)
  expect(new Set([normal, hold, free, collection, celebration, grand].map(track => track.length)).size).toBe(6)
  expect(normal.some(sample => Math.abs(sample) > 0.02)).toBe(true)
  expect(normal.every(sample => Math.abs(sample) < 1)).toBe(true)
  expect(Math.abs(normal[0] - normal.at(-1)!)).toBeLessThan(0.02)

  const { playRoundCue, unlockAudio } = await import('./audio')
  unlockAudio()
  const duck = createGain.mock.results[5].value.gain
  playRoundCue({ type: 'GOLD_ORB_LAND', position: 2, pitch: 1, impact: true }, DEFAULT_SETTINGS)
  expect(createOscillator).toHaveBeenCalledTimes(6)
  expect(duck.cancelAndHoldAtTime).toHaveBeenCalledWith(3)
  expect(duck.linearRampToValueAtTime).toHaveBeenCalledWith(0.53, 3.04)
  expect(duck.linearRampToValueAtTime.mock.lastCall?.[0]).toBe(1)
  playRoundCue({ type: 'JACKPOT_ORB_LAND', position: 2, tier: 'major' }, DEFAULT_SETTINGS)
  expect(createOscillator).toHaveBeenCalledTimes(11)
  expect(duck.linearRampToValueAtTime).toHaveBeenCalledWith(0.26, 3.04)
  expect(duck.linearRampToValueAtTime.mock.lastCall?.[0]).toBe(1)
})
