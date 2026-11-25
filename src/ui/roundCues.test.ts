import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRoundCues, newBonusOrbs, oncePerRound } from './roundCues'
import type { RoundCue } from './roundCues'

function timeline() {
  vi.useFakeTimers()
  vi.setSystemTime(0)
  const events: { time: number; cue: RoundCue }[] = []
  const visible = new Map<number, number>()
  const cues = createRoundCues({
    now: Date.now,
    schedule: (delay, callback) => { setTimeout(callback, delay) },
    emit: cue => events.push({ time: Date.now(), cue }),
    reveal: position => visible.set(position, Date.now()),
  })
  return { cues, events, visible }
}

afterEach(() => vi.useRealTimers())

describe('reel and orb animation cues', () => {
  it('plays one sound at each of the five reel completions, including with duplicate callbacks', () => {
    const { cues, events } = timeline()
    const stopped = vi.fn()
    vi.advanceTimersByTime(500)
    expect(events).toEqual([])
    for (let reel = 0; reel < 5; reel++) {
      vi.advanceTimersByTime(155)
      expect(cues.stop(reel, [], stopped)).toBe(true)
      expect(cues.stop(reel, [], stopped)).toBe(false)
      expect(events[reel]).toEqual({ time: Date.now(), cue: { type: 'REEL_STOP', reel } })
    }
    expect(stopped).toHaveBeenCalledTimes(5)
    expect(events).toHaveLength(5)
  })

  it.each([1, 3])('plays %i orb sounds at their respective visual reveals after the reel stop', count => {
    const { cues, events, visible } = timeline()
    const orbs = Array.from({ length: count }, (_, position) => ({ position }))
    cues.stop(0, orbs, vi.fn())
    cues.stop(0, orbs, vi.fn())
    vi.runAllTimers()
    const reveals = events.filter(event => event.cue.type === 'GOLD_ORB_LAND')
    expect(reveals).toHaveLength(count)
    expect(events[0].cue.type).toBe('REEL_STOP')
    reveals.forEach(({ cue, time }, index) => {
      if (cue.type !== 'GOLD_ORB_LAND') throw new Error('Expected orb cue')
      expect(time).toBe(visible.get(cue.position))
      expect(time).toBe(45 + index * 165)
      expect(cue.pitch).toBeCloseTo(2 ** (index / 24))
    })
  })

  it.each(['mini', 'minor', 'major'] as const)('plays one additional %s accent for a newly revealed jackpot', tier => {
    const { cues, events, visible } = timeline()
    const locked = { value: 16, multiplier: 2, payoutSen: 16 }
    cues.land(newBonusOrbs([locked, null, null],
      [locked, { tier, payoutSen: 100 }, { value: 40, multiplier: 5, payoutSen: 40 }]))
    const reset = vi.fn(() => Date.now())
    cues.finish(reset)
    vi.runAllTimers()
    expect(events.map(event => event.cue)).toEqual([
      { type: 'GOLD_ORB_LAND', position: 1, pitch: 1, impact: true },
      { type: 'JACKPOT_ORB_LAND', position: 1, tier },
      { type: 'GOLD_ORB_LAND', position: 2, pitch: 2 ** (1 / 24) },
    ])
    expect(visible.has(0)).toBe(false)
    expect(events[1].time).toBeGreaterThan(events[0].time)
    expect(events[1].time).toBeLessThan(events[2].time)
    expect(reset.mock.results[0].value).toBeGreaterThan(events[2].time)
  })

  it('keeps orb cues staggered when consecutive reels finish close together', () => {
    const { cues, events } = timeline()
    cues.stop(0, [{ position: 0 }, { position: 2 }], vi.fn())
    vi.advanceTimersByTime(80)
    cues.stop(1, [{ position: 4 }], vi.fn())
    vi.runAllTimers()
    expect(events.map(event => [event.time, event.cue.type])).toEqual([
      [0, 'REEL_STOP'], [45, 'GOLD_ORB_LAND'], [80, 'REEL_STOP'],
      [210, 'GOLD_ORB_LAND'], [375, 'GOLD_ORB_LAND'],
    ])
  })

  it('plays one Lantern cue on reveal while preserving reel stops and staggered Gold Orb sounds', () => {
    const { cues, events, visible } = timeline()
    const symbols = [{ position: 0, lantern: true as const }, { position: 1 }, { position: 2, lantern: true as const }]
    cues.stop(0, symbols, vi.fn())
    cues.stop(0, symbols, vi.fn())
    vi.runAllTimers()
    expect(events.map(({ cue }) => cue.type)).toEqual(['REEL_STOP', 'LANTERN_LAND', 'GOLD_ORB_LAND', 'LANTERN_LAND'])
    expect(events[1].time).toBe(visible.get(0))
    expect(events[2].time).toBe(visible.get(1))
    expect(events[3].time).toBe(visible.get(2))
  })

  it('starts pitch at normal for each respin and caps the rise on a full board', () => {
    const first = timeline()
    first.cues.land(Array.from({ length: 15 }, (_, position) => ({ position })))
    vi.runAllTimers()
    expect(first.events.at(-1)?.cue).toMatchObject({ pitch: 2 ** (6 / 24) })
    const next = timeline()
    next.cues.land([{ position: 10 }])
    vi.runAllTimers()
    expect(next.events[0].cue).toMatchObject({ pitch: 1 })
  })

  it('deduplicates phase cues across repeated dispatch and keeps separate respin keys', () => {
    const play = vi.fn()
    const emit = oncePerRound(play)
    for (let rerender = 0; rerender < 3; rerender++) {
      emit('spin-1', 'bonus-trigger', 'trigger')
      emit('spin-1', 'turn-1:reset', 'reset')
    }
    emit('spin-1', 'turn-2:reset', 'reset')
    emit('spin-2', 'bonus-trigger', 'trigger')
    expect(play.mock.calls).toEqual([['trigger'], ['reset'], ['reset'], ['trigger']])
  })
})
