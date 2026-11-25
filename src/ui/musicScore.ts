export type MusicMode = 'NORMAL' | 'HOLD_AND_SPIN' | 'FREE_SPINS' |
  'HOLD_AND_SPIN_COLLECTION' | 'HOLD_AND_SPIN_CELEBRATION' | 'GRAND_CELEBRATION'

// Original eight-measure loops. MIDI notes are used solely as pitch numbers.
const scores = {
  NORMAL: {
    bpm: 84, roots: [50, 50, 55, 45, 50, 53, 55, 45], energy: 0.8, accents: [0, 2.5],
    melody: [[62, 69, 72, 69], [65, 67, 69], [74, 72, 67, 65], [69, 65, 62],
      [62, 65, 69, 72], [77, 72, 69], [67, 69, 74, 72], [69, 65, 62]],
  },
  HOLD_AND_SPIN: {
    bpm: 98, roots: [38, 38, 43, 36, 38, 41, 43, 45], energy: 0.95, accents: [0, 1.5, 3],
    melody: [[62, 65, 62], [60, 62, 69, 65], [67, 74, 67], [60, 65, 67],
      [62, 65, 69, 72], [65, 60, 62], [67, 72, 74, 69], [69, 72, 76, 69]],
  },
  FREE_SPINS: {
    bpm: 119, roots: [48, 55, 57, 52, 53, 48, 55, 55], energy: 1, accents: [0, 1, 2.5, 3],
    melody: [[72, 76, 79, 81, 79], [74, 79, 81, 84, 79], [76, 81, 84, 81, 76], [76, 74, 72, 76, 79],
      [77, 81, 84, 86, 81], [79, 76, 72, 74, 76], [74, 79, 81, 84, 86], [84, 81, 79, 74, 79]],
  },
  HOLD_AND_SPIN_COLLECTION: {
    bpm: 78, roots: [38, 38, 41, 43, 38, 41, 45, 43], energy: 0.63, accents: [0, 2.5],
    melody: [[62, 65, 69], [57, 62, 65], [65, 69, 72], [67, 72, 74],
      [62, 69, 74], [65, 69, 72], [69, 74, 76], [67, 65, 62]],
  },
  HOLD_AND_SPIN_CELEBRATION: {
    bpm: 128, roots: [50, 55, 57, 50, 53, 55, 57, 50], energy: 1.02, accents: [0, 1, 2.5, 3],
    melody: [[74, 78, 81, 86], [79, 81, 86, 91], [81, 85, 88, 93], [86, 81, 78, 74],
      [77, 81, 84, 89], [79, 83, 86, 91], [81, 85, 88, 93], [90, 86, 81, 78]],
  },
  GRAND_CELEBRATION: {
    bpm: 137, roots: [48, 53, 57, 55, 48, 53, 55, 55], energy: 1.1, accents: [0, 1, 2, 3],
    melody: [[72, 76, 79, 84, 91], [77, 81, 84, 88, 84], [81, 84, 88, 91, 88], [79, 83, 86, 91, 86],
      [84, 79, 76, 79, 88], [89, 84, 81, 84, 89], [86, 83, 79, 86, 91], [91, 86, 83, 79, 74]],
  },
} as const

export const MUSIC_SAMPLE_RATE = 22_050

export function renderMusic(mode: MusicMode, sampleRate: number = MUSIC_SAMPLE_RATE) {
  const score = scores[mode]
  const beat = 60 / score.bpm
  const samples = new Float32Array(Math.round(score.melody.length * 4 * beat * sampleRate))

  function note(startBeat: number, lengthBeats: number, midi: number, level: number,
    timbre: 'pluck' | 'bass' | 'bell' | 'drum') {
    const frequency = 440 * 2 ** ((midi - 69) / 12)
    const start = Math.round(startBeat * beat * sampleRate)
    const length = Math.round(lengthBeats * beat * sampleRate)
    const angular = 2 * Math.PI * frequency / sampleRate
    for (let frame = 0; frame < length; frame++) {
      const t = frame / sampleRate
      const edge = Math.min(1, t / 0.009, (length - frame - 1) / (sampleRate * 0.025))
      const phase = frame * angular
      const fundamental = Math.sin(phase)
      const voice = timbre === 'bell' ? fundamental + 0.40 * Math.sin(phase * 2.17) :
        timbre === 'pluck' ? fundamental + 0.32 * Math.sin(phase * 2) + 0.17 * Math.sin(phase * 3) :
        timbre === 'drum' ? Math.sin(phase + 3 * (1 - Math.exp(-t * 26))) + 0.15 * Math.sin(phase * 3.12) :
        fundamental + 0.19 * Math.sin(phase * 2)
      const decay = timbre === 'drum' ? 17 : timbre === 'pluck' ? 3.8 : timbre === 'bell' ? 4.6 : 2.4
      samples[(start + frame) % samples.length] += level * voice * Math.exp(-t * decay) * edge
    }
  }
  score.melody.forEach((phrase, bar) => {
    const start = bar * 4
    const root = score.roots[bar]
    note(start, 2.5, root, 0.055 * score.energy, 'bass')
    note(start + 2.5, 1.6, root + 7, 0.03, 'bass')
    phrase.forEach((pitch, index) => note(start + index * 0.70, 1.28, pitch, 0.065 * score.energy, 'pluck'))
    note(start + 1.75, 2.45, phrase[0] + 12, 0.015 * score.energy, 'bell')
    for (const accent of score.accents) note(start + accent, 0.44, root - 10, 0.035 * score.energy, 'drum')
  })
  return samples
}
