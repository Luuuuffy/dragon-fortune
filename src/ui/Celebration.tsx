import type { CSSProperties } from 'react'
import { CELEBRATIONS, money } from '../game/config'
import type { Result } from '../game/engine'

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
