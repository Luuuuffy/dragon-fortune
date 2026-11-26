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

  it.each([1, 3])('reveals all %i orbs with the reel and plays one orb chime', count => {
    const { cues, events, visible } = timeline()
    const orbs = Array.from({ length: count }, (_, position) => ({ position }))
    cues.stop(0, orbs, vi.fn())
    cues.stop(0, orbs, vi.fn())
    vi.runAllTimers()
    const reveals = events.filter(event => event.cue.type === 'GOLD_ORB_LAND')
    expect(reveals).toHaveLength(1)
    expect(events[0].cue.type).toBe('REEL_STOP')
    expect(reveals[0].time).toBe(events[0].time)
    expect([...visible.values()]).toEqual(Array(count).fill(events[0].time))
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

  it('keeps one chime in sync with each qualifying reel when stops are close together', () => {
    const { cues, events } = timeline()
    cues.stop(0, [{ position: 0 }, { position: 2 }], vi.fn())
    vi.advanceTimersByTime(80)
    cues.stop(1, [{ position: 4 }], vi.fn())
    vi.runAllTimers()
    expect(events.map(event => [event.time, event.cue.type])).toEqual([
      [0, 'REEL_STOP'], [0, 'GOLD_ORB_LAND'], [80, 'REEL_STOP'], [80, 'GOLD_ORB_LAND'],
    ])
  })

  it('reveals Lanterns at contact without their own sound', () => {
    const { cues, events, visible } = timeline()
    const symbols = [{ position: 0, lantern: true as const }, { position: 1 }, { position: 2, lantern: true as const }]
    cues.stop(0, symbols, vi.fn())
    cues.stop(0, symbols, vi.fn())
    vi.runAllTimers()
    expect(events.map(({ cue }) => cue.type)).toEqual(['REEL_STOP', 'GOLD_ORB_LAND'])
    expect([...visible.values()]).toEqual([0, 0, 0])
  })

  it.each([
    { last: [{ position: 12 }, { position: 13 }, { position: 14 }], first: [{ position: 0 }, { position: 1 }], chimes: 1 },
    { last: [{ position: 12 }, { position: 13 }, { position: 14 }], first: [{ position: 0 }, { position: 1 }, { position: 2 }], chimes: 2 },
  ])('gates late orb sounds on the six-orb threshold ($chimes chimes)', ({ first, last, chimes }) => {
    const { cues, events, visible } = timeline()
    cues.stop(0, first, vi.fn())
    for (let reel = 1; reel < 4; reel++) cues.stop(reel, [], vi.fn())
    cues.stop(4, last, vi.fn())
    expect(events.filter(({ cue }) => cue.type === 'GOLD_ORB_LAND')).toHaveLength(chimes)
    expect(events.filter(({ cue }) => cue.type === 'REEL_STOP')).toHaveLength(5)
    expect(visible.has(14)).toBe(true)
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
