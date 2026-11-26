import { DEFAULT_SETTINGS } from '../game/session'
import type { Jackpot } from '../game/config'
import type { Settings } from '../game/session'
import type { RoundCue } from './roundCues'
import { createMusicManager } from './music'
import type { MusicMode } from './musicScore'

const motifs = {
  spin: [196, 294, 392],
  reel: [155, 196, 220, 196],
  line: [523, 659, 784, 1047],
  trigger: [196, 294, 392, 523, 659, 784, 1047],
  reset: [523, 784, 1047],
  lanternTrigger: [330, 392, 523, 659, 784, 1046],
  lanternRetrigger: [587, 784, 880, 1175],
  lanternComplete: [784, 659, 523, 659, 1046],
  mini: [392, 523, 659, 784, 1047],
  minor: [330, 440, 554, 659, 880, 1109],
  major: [262, 392, 523, 659, 784, 1047, 1319, 1568],
  grand: [196, 262, 392, 523, 659, 784, 1047, 1319, 1568, 2093],
} as const

const jackpotOrbs = {
  mini: [523, 659, 880],
  minor: [392, 587, 784, 988],
  major: [294, 440, 587, 932],
} as const

type AudioGraph = {
  context: AudioContext
  master: GainNode
  reel: GainNode
  orb: GainNode
  jackpot: GainNode
  music: GainNode
  musicManager: ReturnType<typeof createMusicManager>
}
let audio: AudioGraph | undefined
let desiredMusic: MusicMode = 'NORMAL'
let latestSettings = DEFAULT_SETTINGS

function resumeAudio(context: AudioContext) {
  // iOS can also interrupt the context when Safari goes to the background.
  if (context.state !== 'running' && context.state !== 'closed') void context.resume().catch(() => {})
}

export function unlockAudio() {
  try {
    if (!audio) {
      const context = new AudioContext()
      resumeAudio(context)
      const master = context.createGain()
      const reel = context.createGain()
      const orb = context.createGain()
      const jackpot = context.createGain()
      const music = context.createGain()
      const limiter = context.createDynamicsCompressor()
      limiter.threshold.value = -8
      limiter.knee.value = 10
      limiter.ratio.value = 16
      limiter.attack.value = 0.003
      limiter.release.value = 0.17
      for (const bus of [reel, orb, jackpot, music]) bus.connect(master)
      master.connect(limiter)
      limiter.connect(context.destination)
      audio = { context, master, reel, orb, jackpot, music, musicManager: createMusicManager(context, music) }
      setAudio(latestSettings)
      audio.musicManager.setMode(desiredMusic)
    } else {
      resumeAudio(audio.context)
    }
  } catch {
    // Gameplay remains available in browsers without Web Audio.
  }
}

export function listenForAudioGestures(target: Window) {
  // Mouse activation happens on press. Touch and pen activate on release.
  const press = (event: PointerEvent) => { if (event.pointerType === 'mouse') unlockAudio() }
  const release = (event: PointerEvent) => { if (event.pointerType !== 'mouse') unlockAudio() }
  const options = { capture: true, passive: true }
  target.addEventListener('pointerdown', press, options)
  target.addEventListener('pointerup', release, options)
  target.addEventListener('touchend', unlockAudio, options)
  target.addEventListener('click', unlockAudio, options)
  target.addEventListener('keydown', unlockAudio, options)
  return () => {
    target.removeEventListener('pointerdown', press, options)
    target.removeEventListener('pointerup', release, options)
    target.removeEventListener('touchend', unlockAudio, options)
    target.removeEventListener('click', unlockAudio, options)
    target.removeEventListener('keydown', unlockAudio, options)
  }
}

export function setAudio(settings: Settings) {
  latestSettings = settings
  if (!audio) return
  const now = audio.context.currentTime
  audio.master.gain.setValueAtTime(settings.muted ? 0 : settings.volume, now)
  audio.reel.gain.setValueAtTime(settings.reelVolume, now)
  audio.orb.gain.setValueAtTime(settings.orbVolume, now)
  audio.jackpot.gain.setValueAtTime(settings.jackpotVolume, now)
  audio.music.gain.setValueAtTime(settings.musicVolume, now)
}

export function setMusicMode(mode: MusicMode) {
  desiredMusic = mode
  audio?.musicManager.setMode(mode)
}

function note(graph: AudioGraph, output: GainNode, start: number, frequency: number,
  length: number, volume: number, type: OscillatorType, attack = 0.008, endPitch = frequency) {
  const oscillator = graph.context.createOscillator()
  const envelope = graph.context.createGain()
  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, start)
  if (endPitch !== frequency) oscillator.frequency.exponentialRampToValueAtTime(endPitch, start + length)
  envelope.gain.setValueAtTime(0.0001, start)
  envelope.gain.exponentialRampToValueAtTime(volume, start + attack)
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + length)
  oscillator.connect(envelope)
  envelope.connect(output)
  oscillator.start(start)
  oscillator.stop(start + length + 0.01)
}

export function play(name: keyof typeof motifs, settings: Settings) {
  setAudio(settings)
  const graph = audio
  if (!graph || settings.muted || !settings.volume) return
  const jackpot = name === 'mini' || name === 'minor' || name === 'major' || name === 'grand'
  if (jackpot && !settings.jackpotVolume) return
  const now = graph.context.currentTime
  const pace = name === 'reel' ? 0.055 : name === 'grand' ? 0.14 : 0.085
  if (jackpot) {
    graph.musicManager.duck(name === 'grand' ? 0.25 : 0.40, name === 'grand' ? 1.1 : 0.68)
    if (name === 'grand') {
      note(graph, graph.jackpot, now, 100, 0.72, 0.28, 'sine', 0.015, 40)
      note(graph, graph.jackpot, now, 261, 0.62, 0.16, 'triangle', 0.018)
    }
  }
  motifs[name].forEach((frequency, index) =>
    note(graph, jackpot ? graph.jackpot : graph.master, now + index * pace, frequency,
      name === 'reel' ? 0.065 : 0.32, name === 'reel' ? 0.035 : 0.17, name === 'reel' ? 'triangle' : 'sine'))
}

export function playCollectionCue(stage: 'lift' | 'arrive', settings: Settings, tier?: Jackpot) {
  setAudio(settings)
  const graph = audio
  if (!graph || settings.muted || !settings.volume || !(tier ? settings.jackpotVolume : settings.orbVolume)) return
  const bus = tier ? graph.jackpot : graph.orb
  const now = graph.context.currentTime
  if (stage === 'lift') {
    note(graph, bus, now, 260, 0.24, tier ? 0.085 : 0.045, 'triangle', 0.035, 680)
    note(graph, bus, now + 0.035, 520, 0.20, 0.035, 'sine', 0.028, 1040)
    return
  }
  if (tier) graph.musicManager.duck(tier === 'grand' ? 0.36 : 0.54, 0.28)
  const tones = tier === 'grand' ? [392, 523, 659, 784, 1047] : tier ? [523, 784, 1047] : [784, 1175]
  tones.forEach((frequency, index) =>
    note(graph, bus, now + index * 0.034, frequency, 0.16, tier ? 0.112 : 0.060, 'sine', 0.008))
}

export function playRoundCue(cue: RoundCue, settings: Settings) {
  setAudio(settings)
  const graph = audio
  if (!graph || settings.muted || !settings.volume) return
  const now = graph.context.currentTime
  switch (cue.type) {
    case 'REEL_STOP':
      if (!settings.reelVolume) break
      // A short latch click and a low thud begin together at reel contact.
      note(graph, graph.reel, now, 155 + cue.reel * 6, 0.07, 0.23, 'triangle', 0.003, 63)
      note(graph, graph.reel, now, 880, 0.022, 0.055, 'square', 0.002, 390)
      break
    case 'GOLD_ORB_LAND':
      if (!settings.orbVolume) break
      if (cue.impact) {
        graph.musicManager.duck(0.53, 0.28)
        // Pitched bass drop, inharmonic metal, shimmer, and short reflected taps.
        note(graph, graph.orb, now, 110, 0.29, 0.27, 'sine', 0.009, 38)
        note(graph, graph.orb, now + 0.007, 293 * cue.pitch, 0.17, 0.13, 'triangle', 0.004, 146)
        note(graph, graph.orb, now + 0.012, 733 * cue.pitch, 0.081, 0.085, 'square', 0.002, 420)
        note(graph, graph.orb, now + 0.025, 1480 * cue.pitch, 0.25, 0.086, 'sine', 0.008)
        note(graph, graph.orb, now + 0.091, 1075 * cue.pitch, 0.19, 0.037, 'sine', 0.012)
        note(graph, graph.orb, now + 0.149, 1185 * cue.pitch, 0.18, 0.021, 'sine', 0.013)
        break
      }
      note(graph, graph.orb, now, 784 * cue.pitch, 0.22, 0.14, 'sine', 0.006)
      note(graph, graph.orb, now, 1661 * cue.pitch, 0.115, 0.06, 'sine', 0.004)
      note(graph, graph.orb, now + 0.035, 1175 * cue.pitch, 0.2, 0.09, 'sine')
      break
    case 'JACKPOT_ORB_LAND':
      if (!settings.jackpotVolume) break
      graph.musicManager.duck(cue.tier === 'major' ? 0.26 : cue.tier === 'minor' ? 0.39 : 0.55, 0.43)
      if (cue.tier !== 'mini') note(graph, graph.jackpot, now, 150, 0.38,
        cue.tier === 'major' ? 0.24 : 0.15, 'triangle', 0.013, 56)
      jackpotOrbs[cue.tier].forEach((frequency, index) =>
        note(graph, graph.jackpot, now + index * 0.036, frequency, 0.125, 0.16, 'triangle'))
      break
    case 'FREE_TRIGGER': play('lanternTrigger', settings); break
    case 'FREE_RETRIGGER': play('lanternRetrigger', settings); break
    case 'FREE_COMPLETE': play('lanternComplete', settings); break
    case 'RESPIN_RESET': play('reset', settings); break
    case 'BONUS_TRIGGER': play('trigger', settings); break
    case 'JACKPOT_CELEBRATION': play(cue.tier, settings); break
  }
}
