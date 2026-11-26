import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { motion } from 'motion/react'
import { CELLS, REELS, cellAt, money } from '../game/config'
import type { Jackpot } from '../game/config'
import type { Result, Slots } from '../game/engine'
import type { Settings } from '../game/session'
import { playCollectionCue } from './audio'
import { Coins } from './Celebration'

type Prize = { position: number | null; amount: number; tier?: Jackpot }
type Point = { x: number; y: number }
type Path = [Point, Point, Point, Point]
type Layout = { orbs: Map<number, Point>; counter: Point; grand: Point }

export function holdCollectionPrizes(orbs: Slots, result: Result): Prize[] {
  const awards = [...result.awards]
  const prizes: Prize[] = []
  for (let index = 0; index < CELLS; index++) {
    const position = cellAt(index % REELS, Math.floor(index / REELS))
    const orb = orbs[position]
    if (!orb) continue
    if ('tier' in orb) {
      const index = awards.findIndex(award => award.tier === orb.tier)
      if (index >= 0) prizes.push({ position, tier: orb.tier, amount: awards.splice(index, 1)[0].amount })
    } else if (result.bonus) prizes.push({ position, amount: orb.payoutSen })
  }
  const grand = awards.find(award => award.tier === 'grand')
  if (grand) prizes.push({ position: null, ...grand })
  return prizes
}

export function dragonPath(start: Point, end: Point): Path {
  const lift = Math.max(24, Math.min(92, (start.y - end.y) * 0.32))
  const across = end.x - start.x
  return [start, { x: start.x + across * 0.1 - 26, y: Math.max(5, start.y - lift * 1.4) },
    { x: end.x - across * 0.24 + 42, y: Math.max(3, end.y - lift) }, end]
}

export function dragonPoint([start, first, second, end]: Path, progress: number): Point {
  const left = 1 - progress
  return {
    x: left ** 3 * start.x + 3 * left ** 2 * progress * first.x + 3 * left * progress ** 2 * second.x + progress ** 3 * end.x,
    y: left ** 3 * start.y + 3 * left ** 2 * progress * first.y + 3 * left * progress ** 2 * second.y + progress ** 3 * end.y,
  }
}

function Dragon({ fill }: { fill: string }) {
  return <g fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d="M-41 8q12 13 22 1c4-5 1-11-4-10-8 2-3 19 10 14 9-4 3-16 13-21q7-4 13 1"
      stroke="#8b3d14" strokeWidth="9"/>
    <path d="M-41 8q12 13 22 1c4-5 1-11-4-10-8 2-3 19 10 14 9-4 3-16 13-21q7-4 13 1"
      stroke={fill} strokeWidth="5"/>
    <path d="M-41 8-48 5l5 8m22-14 2-4m7 16 6 5m4-22-4-4m15-1 4-6 2 7 5-3 1 6 8 4-3 5-12 1-7-3"
      fill={fill} stroke="#fff2bf" strokeWidth="1.3"/>
    <path d="M24-1q13-10 20-6M25 3q9-1 15 4M10 2l-4 5" stroke={fill} strokeWidth="1.3"/>
    <circle cx="19" cy="-3" r="1.55" fill="#681a23"/>
  </g>
}

const colors = { mini: '#91ebbb', minor: '#a0deff', major: '#f4aaff', grand: '#ffe09a' } as const
const keypoint = (point: Point) => `${point.x},${point.y}`

export function HoldCollection({ field, orbs, result, complete, settings, reduced, onComplete }: {
  field: RefObject<HTMLElement | null>; orbs: Slots; result: Result; complete: boolean; settings: Settings;
  reduced: boolean; onComplete: (id: string) => void;
}) {
  const [prizes] = useState(() => holdCollectionPrizes(orbs, result))
  const final = result.bonus + result.jackpot
  const [frame, setFrame] = useState({ index: 0, progress: 0, amount: 0 })
  const [layout, setLayout] = useState<Layout | null>(null)
  const counter = useRef<HTMLSpanElement>(null)
  const raf = useRef(0)
  const done = useRef(false)
  const live = useRef({ settings, reduced })
  useEffect(() => { live.current = { settings, reduced } }, [settings, reduced])

  useEffect(() => {
    const area = field.current
    const destination = counter.current
    if (!area || !destination || complete) return
    const measure = () => {
      const bounds = area.getBoundingClientRect()
      const center = (rect: DOMRect) => ({ x: rect.left - bounds.left + rect.width / 2, y: rect.top - bounds.top + rect.height / 2 })
      const cells = Array.from(area.querySelectorAll<HTMLElement>('[data-orb-position]'))
      const board = area.querySelector('.reel-window')
      setLayout({
        orbs: new Map(cells.map(cell => [Number(cell.dataset.orbPosition), center(cell.getBoundingClientRect())])),
        counter: center(destination.getBoundingClientRect()),
        grand: center(board?.getBoundingClientRect() ?? bounds),
      })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(area)
    observer.observe(destination)
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [field, complete])

  const id = result.bonusId
  const finish = () => {
    if (done.current || id === null) return
    done.current = true
    cancelAnimationFrame(raf.current)
    setFrame({ index: prizes.length, progress: 1, amount: final })
    onComplete(id)
  }

  useEffect(() => {
    if (complete || done.current) return
    let index = 0
    let collected = 0
    let elapsed = 0
    let previous = 0
    let lifted = false
    let arrived = false
    const tick = (time: number) => {
      if (done.current) return
      const prize = prizes[index]
      if (!prize) { finish(); return }
      const { settings, reduced } = live.current
      elapsed += previous ? Math.min(90, time - previous) * settings.speed : 0
      previous = time
      const travel = reduced ? 90 : prize.tier === 'grand' ? 1000 : prize.tier ? 650 : 455
      const counting = reduced ? 90 : prize.tier === 'grand' ? 520 : 160
      if (!lifted) {
        lifted = true
        playCollectionCue('lift', settings, prize.tier)
      }
      if (elapsed >= travel && !arrived) {
        arrived = true
        playCollectionCue('arrive', settings, prize.tier)
      }
      if (elapsed >= travel + counting) {
        collected += prize.amount
        index++
        elapsed = 0
        lifted = arrived = false
        setFrame({ index, progress: 0, amount: collected })
      } else {
        const countProgress = Math.max(0, (elapsed - travel) / counting)
        setFrame({ index, progress: Math.min(1, elapsed / travel),
          amount: collected + Math.floor(prize.amount * (1 - (1 - countProgress) ** 2)) })
      }
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [complete, id, prizes, final, onComplete])

  const prize = prizes[frame.index]
  const source = prize && layout && (prize.position === null ? layout.grand : layout.orbs.get(prize.position))
  const path = source && layout ? dragonPath(source, layout.counter) : null
  const dragon = path && dragonPoint(path, frame.progress)
  const color = prize?.tier ? colors[prize.tier] : '#ffc65d'
  const display = complete ? final : frame.amount
  const title = complete ? result.awards.some(award => award.tier === 'grand') ? 'GRAND JACKPOT' : 'BONUS COMPLETE'
    : prize?.tier === 'grand' ? 'GRAND AWARD' : 'COLLECTING PRIZES'

  return <>
    <div className={`reel-heading in-feature collection-heading ${complete ? 'collection-complete' : ''}`}>
      <span className="collection-title">{title}</span>
      <span className="collection-counter">BONUS WIN <strong ref={counter}>{money(display)}</strong></span>
      {!complete && <button type="button" className="text-button collection-action" onClick={finish}>Skip</button>}
    </div>
    {!complete && layout && <svg className="collection-flight" aria-hidden="true">
      {prizes.slice(0, frame.index).map(({ position }) => {
        const point = position === null ? null : layout.orbs.get(position)
        return point && <g className="collection-check" key={position} transform={`translate(${point.x}, ${point.y})`}>
          <circle r="12"/><path d="m-5 0 3 3 7-7"/>
        </g>
      })}
      {source && <circle className="collection-source" cx={source.x} cy={source.y} r={prize.tier === 'grand' ? 30 : 21}
        stroke={color}/>}
      {!reduced && path && dragon && frame.progress < 1 && <>
        <path className="collection-trail" d={`M${keypoint(path[0])} C${keypoint(path[1])} ${keypoint(path[2])} ${keypoint(path[3])}`}
          pathLength="1" stroke={color} strokeDasharray="1" strokeDashoffset={1 - frame.progress}/>
        {[1, 2, 3, 4, 5].map(step => {
          const point = dragonPoint(path, Math.max(0, frame.progress - step * 0.06))
          return <circle key={step} cx={point.x} cy={point.y + Math.sin(step) * 5} r={4 - step / 2} fill={color} opacity={1 - step / 7}/>
        })}
        <g className="collection-dragon" opacity={Math.min(1, (1 - frame.progress) * 12)}
          transform={`translate(${dragon.x}, ${dragon.y}) scale(${prize.tier === 'grand' ? 1.25 : .8})`}>
          <Dragon fill={color}/>
        </g>
      </>}
    </svg>}
    {complete && <>
      <span className="collection-announcement" role="status">{title} · Bonus win {money(final)}</span>
      {!reduced && <motion.div className={`collection-celebration ${result.awards[0]?.tier ?? ''}`}
        initial={{ opacity: 0, scale: .98 }} animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: .35 / settings.speed }}><Coins count={result.awards[0]?.tier === 'grand' ? 42 : 20}/></motion.div>}
    </>}
  </>
}
