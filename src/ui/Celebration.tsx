import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { motion } from 'motion/react'
import { CELEBRATIONS, money } from '../game/config'
import type { Result } from '../game/engine'
import { Symbol } from './Symbol'

export function ResultBreakdown({ result, showTotal = true }: { result: Result; showTotal?: boolean }) {
  return <dl className="breakdown">
    <div><dt>Line win</dt><dd>{money(result.line)}</dd></div>
    {!!result.scatter && <div><dt>Lantern Scatter</dt><dd>{money(result.scatter)}</dd></div>}
    <div><dt>Bonus win</dt><dd>{money(result.bonus)}</dd></div>
    <div><dt>Jackpot win</dt><dd>{money(result.jackpot)}</dd></div>
    {showTotal && <div><dt>Total win</dt><dd>{money(result.total)}</dd></div>}
  </dl>
}

export function winLabel(result: Result) {
  return result.awards[0] ? 'JACKPOT' :
    CELEBRATIONS.find(({ ratio }) => result.total >= ratio * result.bet)?.label ?? 'LINE WIN'
}

export function Coins({ count }: { count: number }) {
  return <div aria-hidden="true" className="coins">{Array.from({ length: count }, (_, i) =>
    <i key={i} style={{ '--left': `${(i * 73 + 17) % 100}%`, '--delay': `${i % 13 * -0.12}s`,
      '--fall': `${1.4 + i % 11 * 0.17}s`, '--drift': `${(i % 9 - 4) * 16}px` } as CSSProperties}/>)}</div>
}

export function Celebration({ result, reduced, speed, close }: { result: Result; reduced: boolean; speed: number; close?: () => void }) {
  const [amount, setAmount] = useState(reduced ? result.total : 0)
  const tier = result.awards[0]?.tier
  useEffect(() => {
    if (reduced) { setAmount(result.total); return }
    const duration = (tier === 'grand' ? 2500 : 950) / speed
    let frame = 0
    const start = performance.now()
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration)
      setAmount(Math.round(result.total * (1 - (1 - progress) ** 3)))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [result.total, reduced, speed, tier])
  const count = tier === 'grand' ? 96 : tier === 'major' ? 60 : tier === 'minor' ? 36 : tier === 'mini' ? 22 : 18
  return <div className={`celebration ${tier ?? 'bonus-win'}`}>
    {!reduced && <Coins count={count}/>}
    {tier === 'grand' && <div className="grand-dragon"><Symbol symbol="dragon"/></div>}
    <p className="eyebrow">{tier ? 'JACKPOT' : 'HOLD & SPIN COMPLETE'}</p>
    <motion.h2 initial={reduced ? false : { opacity: 0, scale: 0.82 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: (tier === 'grand' ? 0.65 : 0.35) / speed, ease: 'easeOut' }}>
      {tier ? tier.toUpperCase() : winLabel(result)}
    </motion.h2>
    {tier && <p className="jackpot-prize">{money(result.awards[0].amount)}</p>}
    <p className="count-up" aria-label={`Total win ${money(result.total)}`}>{money(amount)}</p>
    <ResultBreakdown result={result}/>
    {close && <button className="gold-button" onClick={close}>Continue</button>}
  </div>
}
