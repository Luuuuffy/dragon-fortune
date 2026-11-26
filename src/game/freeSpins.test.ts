import { afterEach, describe, expect, it, vi } from 'vitest'
import { BONUS_REBALANCE_VERSION, CELLS, CURRENT_MATH_VERSION, DESIGN_B_VERSION, REELS, ROWS,
  START_BALANCE, calculateJackpots, cellAt } from './config'
import type { SymbolId } from './config'
import { evaluateLines, evaluateScatter, generateBoard, lanternCountOdds, lanternReels, seededRandom, startingOrbs,
  triggersBonus } from './engine'
import type { Scenario } from './engine'
import { LANTERN } from './lanternConfig'
import { BONUS_REBALANCE_WILD_WEIGHTS, FREE_ORB_CHANCE, REEL_SYMBOL_WEIGHTS } from './probabilityConfig'
import { completeHoldCollection, dismissResult, freeSpinsWin, lastWinSen, newSession, openBonus, resetGame, revealRespin,
  revealSpin, selectBetting, setBankroll, startRespin, startSpin } from './session'
import type { Session } from './session'
import { simulate } from './simulation'
import { parseSession } from './storage'
import { automaticRoundStep } from '../ui/automaticRound'

const noHits = () => 0.99
const wager = 80
const jackpotPrizes = calculateJackpots(10)
const rootId = 'paid'
const funded = () => selectBetting(setBankroll(newSession(), START_BALANCE, 'initial'), { denominationSen: 10 })
const launch = (scenario: Scenario) => revealSpin(startSpin(funded(), noHits, rootId, scenario), rootId)
const hydrate = (session: Session) => {
  const restored = parseSession(JSON.stringify(session))
  expect(restored).toEqual(session)
  return restored!
}

function reeled(session: Session, scenario?: Scenario) {
  const round = session.round
  if (round.phase !== 'SPINNING') throw new Error('Expected spinning reels')
  const board = scenario ? generateBoard(noHits, scenario, Boolean(session.freeSpins)) : round.spin.board
  const current = scenario ? { ...session, round: { ...round, spin: { ...round.spin, board },
    orbs: startingOrbs(board, noHits, { denominationSen: 10, bet: wager, jackpotPrizes }, scenario) } } : session
  return revealSpin(current, round.spin.id)
}

// Drive the same automatic pause callbacks as the UI and supply reel and respin completion events.
function tick(session: Session) {
  const { round } = session
  const step = automaticRoundStep(round, Boolean(session.freeSpins), noHits)
  if (step) {
    let next = session
    setTimeout(() => { next = step.update(next) }, step.delay)
    vi.advanceTimersByTime(step.delay - 1)
    expect(next).toBe(session)
    vi.advanceTimersByTime(1)
    expect(next).not.toBe(session)
    expect(step.update(next)).toBe(next)
    return hydrate(next)
  }
  if (round.phase === 'SPINNING') return hydrate(reeled(session))
  if (round.phase === 'BONUS_TRIGGER') return hydrate(openBonus(session, round.bonus.spin.id))
  if (round.phase === 'BONUS_RESPIN') return hydrate(revealRespin(session, round.bonus.spin.id, round.bonus.turn))
  if (round.phase === 'FEATURE_HOLD_RESULT' && !round.collectionComplete) {
    return hydrate(completeHoldCollection(session, round.holdResult.bonusId!))
  }
  throw new Error(`No automatic action for ${round.phase}`)
}

function finish(started: Session) {
  let session = started
  const frames: Session[] = []
  for (let transitions = 0; transitions < 160 && session.round.phase !== 'IDLE'; transitions++) {
    frames.push(session)
    session = tick(session)
  }
  expect(session.round.phase).toBe('IDLE')
  return { session, frames }
}

afterEach(() => vi.useRealTimers())

describe('Red Lantern scatter', () => {
  it.each([[2, 0], [3, 2], [4, 5], [5, 25], [9, 25]])(
    'counts %i Lanterns anywhere and applies only one payout tier', (count, multiplier) => {
      const board = Array<SymbolId>(CELLS).fill('orb')
      // Fill column-major across multiple rows, independent of active lines.
      for (let index = 0; index < count; index++) board[index] = 'lantern'
      expect(evaluateScatter(board, wager)).toEqual({ count, amount: multiplier * wager, qualifies: count >= 3 })
      expect(evaluateLines(board, 10, 88).wins).toEqual([])
    },
  )

  it('measures realistic paid and free frequencies with a subcritical retrigger rate', () => {
    const sim = simulate({ spins: 100_000, denominationSen: 10, bet: 80, lines: 8, seed: 2026 })
    const modeled = lanternCountOdds(false).slice(3).reduce((sum, chance) => sum + chance, 0)
    const modeledRetrigger = lanternCountOdds(true).slice(3).reduce((sum, chance) => sum + chance, 0)
    expect(Math.abs(sim.lanternTriggers / sim.spins - modeled)).toBeLessThan(0.002)
    expect(Math.abs(sim.freeRetriggers / sim.freePlayed - modeledRetrigger)).toBeLessThan(0.012)
    expect(Math.abs(sim.freeHoldTriggers / sim.freePlayed - 0.060543)).toBeLessThan(0.01)
    expect(Math.abs(sim.freeFeaturesWithHold / sim.lanternTriggers - 1 / 3)).toBeLessThan(0.05)
    expect(sim.freeLineHits / sim.freePlayed).toBeGreaterThan(sim.lineHits / sim.spins)
    expect(sim.freePlayed).toBe(sim.lanternTriggers * LANTERN.initialSpins + sim.freeRetriggers * LANTERN.extraSpins)
    expect(sim.freeWon).toBeGreaterThan(0)
  })

  it('supports independent Lantern tier weights while retaining the original Gold Orb draws', () => {
    const values = Array.from({ length: CELLS }, seededRandom(120))
    const original = lanternReels(4, [1, 1, 1])
    const tuned = lanternReels(4, [0, 10, 0])
    let index = 0
    const originalBoard = original.drawBoard(() => values[index++] ?? 0.8)
    index = 0
    const tunedBoard = tuned.drawBoard(() => values[index++] ?? 0.8)
    expect(tunedBoard.map(symbol => symbol === 'orb')).toEqual(originalBoard.map(symbol => symbol === 'orb'))
    expect(tuned.odds[3]).toBe(0)
    expect(tuned.odds[4]).toBeGreaterThan(original.odds[4])
    expect(tuned.odds.slice(5).every(chance => chance === 0)).toBe(true)
    expect(tuned.odds.reduce((sum, chance) => sum + chance, 0)).toBeCloseTo(1)
  })

  it('adds Free Spin orbs without changing natural triggers or moving Lanterns', () => {
    const drawOriginal = lanternReels(LANTERN.freeWeight, LANTERN.freeTierWeights,
      BONUS_REBALANCE_WILD_WEIGHTS.free, REEL_SYMBOL_WEIGHTS.free, FREE_ORB_CHANCE).drawBoard
    const rng = seededRandom(2526)
    let extraOrbs = 0
    let naturalTriggers = 0
    let previousTriggers = 0

    for (let spin = 0; spin < 10_000; spin++) {
      const seed = rng() * 2 ** 32
      const original = drawOriginal(seededRandom(seed))
      const free = generateBoard(seededRandom(seed), undefined, true)
      const added = free.filter(symbol => symbol === 'orb').length - original.filter(symbol => symbol === 'orb').length
      expect(added).toBeGreaterThanOrEqual(0)
      expect(added).toBeLessThanOrEqual(1)
      expect(triggersBonus(free)).toBe(triggersBonus(original))
      expect(evaluateScatter(free, wager).count).toBe(evaluateScatter(original, wager).count)
      extraOrbs += added
      naturalTriggers += Number(triggersBonus(free))
      previousTriggers += Number(triggersBonus(generateBoard(seededRandom(seed), undefined, true, DESIGN_B_VERSION)))
    }

    expect(extraOrbs).toBeGreaterThan(2_000)
    expect(extraOrbs).toBeLessThan(4_000)
    expect(naturalTriggers).toBeGreaterThan(previousTriggers * 1.8)
  })

  it.each([{ free: false, minimumFullReelRate: 0.03 }, { free: true, minimumFullReelRate: 0.045 }])(
    'places Lanterns on separate reels and lands adjacent Panda Wild stacks (Free Spins: $free)',
    ({ free, minimumFullReelRate }) => {
      const rng = seededRandom(2026)
      const boards = 10_000
      const stacks = Array<number>(ROWS + 1).fill(0)
      let duplicateLanternReels = 0
      let splitStacks = 0
      let boardsWithFullStack = 0

      for (let spin = 0; spin < boards; spin++) {
        const board = generateBoard(rng, undefined, free)
        let fullStack = false
        for (let reel = 0; reel < REELS; reel++) {
          const column = board.slice(cellAt(reel, 0), cellAt(reel, 0) + ROWS)
          if (column.filter(symbol => symbol === 'lantern').length > 1) duplicateLanternReels++
          const wilds = column.filter(symbol => symbol === 'wild').length
          if (reel === 0 && wilds) splitStacks++
          if (wilds === 2 && column[1] !== 'wild') splitStacks++
          stacks[wilds]++
          if (wilds === ROWS) fullStack = true
        }
        if (fullStack) boardsWithFullStack++
      }

      expect(duplicateLanternReels).toBe(0)
      expect(splitStacks).toBe(0)
      expect(stacks.slice(1).every(count => count > 0)).toBe(true)
      expect(boardsWithFullStack / boards).toBeGreaterThan(minimumFullReelRate)
    },
  )
})

describe('automatic Free Spins', () => {
  it.each([[3, 3_000], [DESIGN_B_VERSION, 6_000], [BONUS_REBALANCE_VERSION, 6_000], [CURRENT_MATH_VERSION, 6_000]] as const)(
    'locks profile %i across the triggering wager and free line payout', (version, payout) => {
    vi.useFakeTimers()
    const start = selectBetting(funded(), { denominationSen: 10, betSize: 3 })
    const active = startSpin(start, noHits, rootId, 'lantern3')
    if (active.round.phase !== 'SPINNING') throw new Error('Expected the paid spin')
    const spin = { ...active.round.spin, paytableVersion: version }
    const intro = hydrate(revealSpin({ ...active, round: { ...active.round, spin } }, rootId))
    const rolling = tick(intro)
    if (rolling.round.phase !== 'SPINNING') throw new Error('Expected a free spin')
    expect(rolling.round.spin.paytableVersion).toBe(version)
    expect(rolling.balance).toBe(START_BALANCE - 240)
    const board = generateBoard(noHits, 'line', true, version)
    const waiting = hydrate(revealSpin({ ...rolling, round: { ...rolling.round, spin: { ...rolling.round.spin, board } } },
      rolling.round.spin.id))
    expect(waiting.round).toMatchObject({ phase: 'FREE_WAIT', outcome: { line: payout } })
    const { session } = finish(waiting)
    expect(session.last?.freeSpins).toBe(payout)
    expect(session.balance).toBe(START_BALANCE - 240 + session.last!.total)
  })

  it.each(['lantern3', 'lantern4', 'lantern5'] as const)('runs six spins automatically for %s and then enables the cabinet', scenario => {
    vi.useFakeTimers()
    const intro = hydrate(launch(scenario))
    expect(intro.round.phase).toBe('FREE_INTRO')
    expect(intro.freeSpins).toMatchObject({ remaining: 6, awarded: 6, retriggers: 0, root: { betting: funded().betting } })
    expect(intro.balance).toBe(START_BALANCE - wager)
    expect(startSpin(intro, noHits, 'blocked')).toBe(intro)
    expect(selectBetting(intro, { lines: 18 })).toBe(intro)
    expect(resetGame(intro)).toBe(intro)
    const { session, frames } = finish(intro)
    expect(frames.map(frame => frame.freeSpins?.remaining)).toContain(0)
    expect(frames.filter(frame => frame.round.phase === 'SPINNING')).toHaveLength(6)
    const complete = frames.at(-1)!
    expect(complete.round.phase).toBe('FREE_COMPLETE')
    expect(dismissResult(complete, rootId)).toBe(complete)
    expect(session.last?.total).toBe(intro.freeSpins?.paid.scatter)
    expect(session.last?.freeSpins).toBe(0)
    expect(session.stats).toMatchObject({ spins: 1, wagered: wager, freePlayed: 6, freeFeatures: 1 })
    expect(session.balance).toBe(START_BALANCE - wager + session.last!.total)
    expect(session.freeSpins).toBeNull()
    expect(automaticRoundStep(session.round, false, noHits)).toBeNull()
    expect(startSpin(session, noHits, 'next-paid', 'none').balance).toBe(session.balance - wager)
  })

  it.each(['lantern3', 'lantern4', 'lantern5'] as const)('awards three more spins and one scatter payout for a %s retrigger', scenario => {
    vi.useFakeTimers()
    const playing = tick(launch('lanternNoWin'))
    expect(playing.freeSpins?.remaining).toBe(5)
    const retrigger = hydrate(reeled(playing, scenario))
    expect(retrigger.round.phase).toBe('FREE_WAIT')
    expect(retrigger.freeSpins).toMatchObject({ remaining: 8, awarded: 9, retriggers: 1 })
    expect(freeSpinsWin(retrigger.freeSpins!)).toBe(evaluateScatter(retrigger.board, wager).amount)
    const { session } = finish(retrigger)
    expect(session.stats.freePlayed).toBe(9)
    expect(session.stats.freeRetriggers).toBe(1)
    expect(lastWinSen(session)).toBe(160 + session.last!.freeSpins!)
  })

  it('combines line and scatter payouts and credits repeated retriggers exactly once', () => {
    vi.useFakeTimers()
    const active = startSpin(funded(), noHits, rootId, 'lanternRepeat')
    if (active.round.phase !== 'SPINNING') throw new Error('Expected the paid spin')
    const board = generateBoard(noHits, 'none')
    for (let reel = 0; reel < 5; reel++) board[cellAt(reel, 1)] = 'boat'
    for (const reel of [0, 2, 4]) board[cellAt(reel, 0)] = 'lantern'
    const intro = revealSpin({ ...active, round: { ...active.round, spin: { ...active.round.spin, board } } }, rootId)
    const { session, frames } = finish(hydrate(intro))
    expect(session.stats).toMatchObject({ freePlayed: 15, freeRetriggers: 3, wagered: wager })
    expect(session.last).toMatchObject({ line: 800, scatter: 640, freeSpins: 480, total: 1440 })
    expect(session.balance).toBe(START_BALANCE - wager + 1440)
    expect(frames.slice(0, -1).every(frame => lastWinSen(frame) === 0)).toBe(true)
    expect(lastWinSen(session)).toBe(1440)
    expect(revealSpin(session, rootId)).toBe(session)
  })

  it.each(['lanternBoth', 'lanternQueued'] as const)('automatically resolves the queued Hold & Spin for %s', scenario => {
    vi.useFakeTimers()
    const intro = hydrate(launch(scenario))
    const { session, frames } = finish(intro)
    const trigger = frames.find(frame => frame.round.phase === 'BONUS_TRIGGER')!
    const ready = frames.find(frame => frame.round.phase === 'BONUS_READY')!
    const hold = frames.find(frame => frame.round.phase === 'FEATURE_HOLD_RESULT')!
    expect(startRespin(ready, noHits)).toBe(ready)
    expect(trigger.freeSpins?.remaining).toBe(scenario === 'lanternBoth' ? 0 : 5)
    expect(hold.balance).toBe(START_BALANCE - wager)
    expect(session.last).toMatchObject({ scatter: 160, bonus: 960, total: 1120,
      freeSpins: scenario === 'lanternBoth' ? 0 : 960 })
    expect(session.stats).toMatchObject({ spins: 1, freePlayed: 6, bonuses: 1, won: 1120 })
  })

  it('ignores a delayed automatic respin callback during a later standalone Hold & Spin', () => {
    vi.useFakeTimers()
    const waiting = tick(tick(launch('lanternQueued')))
    const ready = tick(tick(waiting))
    expect(ready.round.phase).toBe('BONUS_READY')
    const stale = automaticRoundStep(ready.round, true, noHits)!
    const completed = finish(ready).session
    const standalone = openBonus(revealSpin(startSpin(completed, noHits, 'standalone', 'six'), 'standalone'), 'standalone')
    expect(stale.update(standalone)).toBe(standalone)
    expect(startRespin(standalone, noHits).round.phase).toBe('BONUS_RESPIN')
  })

  it('handles a retrigger and a full Hold & Spin board during one feature, with the jackpot credited only at completion', () => {
    vi.useFakeTimers()
    const playing = tick(launch('lanternNoWin'))
    const queued = hydrate(reeled(playing, 'lanternBoth'))
    expect(queued.freeSpins).toMatchObject({ remaining: 8, nextHold: expect.any(Object) })
    const next = tick(queued)
    if (next.round.phase !== 'BONUS_TRIGGER') throw new Error('Expected a queued Hold & Spin')
    const ready = openBonus(next, next.round.bonus.spin.id)
    if (ready.round.phase !== 'BONUS_READY') throw new Error('Expected Hold & Spin ready')
    // The active feature guard allows only this exact queued respin to start.
    const bonus = { ...ready.round.bonus, spin: { ...ready.round.bonus.spin, scenario: 'grand' as const } }
    const { session } = finish({ ...ready, round: { ...ready.round, bonus } })
    expect(session.stats.jackpots.grand).toBe(1)
    expect(session.stats.freePlayed).toBe(9)
    expect(session.last!.jackpot).toBe(jackpotPrizes.grand)
    expect(session.last!.freeSpins).toBe(jackpotPrizes.grand + 15 * 160 + 160)
  })
})
