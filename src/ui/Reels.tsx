import type { CSSProperties } from 'react'
import { LockKeyhole } from 'lucide-react'
import { cellAt, PAYLINES, REELS, ROWS } from '../game/config'
import type { SymbolId } from '../game/config'
import type { LineWin, Slots } from '../game/engine'
import { FREE_SYMBOL_ORDER } from '../game/probabilityConfig'
import { OrbSymbol, Symbol } from './Symbol'

const filler: SymbolId[] = ['9', 'lotus', 'Q', 'boat', 'K', 'tiger', 'chicken', '10', 'J', 'orb']
const freeFiller: readonly SymbolId[] = [...FREE_SYMBOL_ORDER, 'orb']
const lineColors = ['#ffce68', '#f479a9', '#b1a3ff', '#7ff7c0', '#84dbff', '#ffffaa']
const x = (index: number) => (Math.floor(index / ROWS) + 0.5) * 60
const y = (index: number) => (index % ROWS + 0.5) * 40
const miniReelSymbols = ['blank', 'ingot', 'flash', 'spark', 'blank', 'gold'] as const

function CellReel({ position }: { position: number }) {
  const offset = position % miniReelSymbols.length
  const sequence = [...miniReelSymbols.slice(offset), ...miniReelSymbols.slice(0, offset)]
  return <div className="cell-mini-reel" aria-hidden="true">
    <div className="cell-mini-strip">
      {[...sequence, ...sequence].map((kind, index) => <i key={index} className={`cell-filler ${kind}`}/>)}
    </div>
  </div>
}

export function LinesOverlay({ wins, preview }: { wins: LineWin[]; preview: number | null }) {
  if (!wins.length && preview === null) return null
  const paths = preview === null ? wins : [{ line: preview, positions: PAYLINES[preview].map((row, reel) => cellAt(reel, row)) }]
  return <svg className={`line-overlay ${preview === null ? 'winning-paths' : 'preview-path'}`} viewBox="0 0 300 120" preserveAspectRatio="none" aria-hidden="true">
    {paths.map(({ line, positions }) => <g key={line} style={{ color: lineColors[line % lineColors.length] }}>
      <polyline points={positions.map(i => `${x(i)},${y(i)}`).join(' ')} vectorEffect="non-scaling-stroke"/>
      {positions.map(position => <circle key={position} cx={x(position)} cy={y(position)} r="2.4"/>)}
    </g>)}
  </svg>
}

export function Reels({ board, boardOrbs, target, stopped, duration, bonus, baseOrbs, respinning,
  stoppedCells, nextBonusOrbs, landedSymbols, highlightLanterns, wins, preview, spinId, anticipation, reducedReels, compactReels, onReelStop,
  freeSymbols }: {
  board: SymbolId[]; target: SymbolId[] | null; stopped: number[]; duration: number[]; bonus: Slots | null;
  boardOrbs: Slots;
  baseOrbs: Slots | null; respinning: boolean; landedSymbols: number[]; highlightLanterns: boolean; wins: LineWin[];
  stoppedCells: number[]; nextBonusOrbs: Slots | null;
  preview: number | null; spinId: string; anticipation: boolean; reducedReels: boolean; compactReels: boolean;
  onReelStop: (reel: number) => void;
  freeSymbols: boolean;
}) {
  const winningCells = new Set(wins.flatMap(win => win.positions))
  const stripFiller = freeSymbols ? freeFiller : filler
  return <div className={`cabinet ${bonus ? 'bonus-cabinet' : ''} ${anticipation ? 'anticipating' : ''}${compactReels ? ' compact-effects' : ''}`}>
    <div className="frame-corner top-left"/><div className="frame-corner top-right"/>
    <div className="frame-corner bottom-left"/><div className="frame-corner bottom-right"/>
    <div className="side-lights left" aria-hidden="true">{Array.from({ length: 7 }, (_, i) => <i key={i}/>)}</div>
    <div className="side-lights right" aria-hidden="true">{Array.from({ length: 7 }, (_, i) => <i key={i}/>)}</div>
    <div className="reel-window" aria-label={bonus ? 'Hold & Spin board' : 'Five reels, three rows'}>
      {Array.from({ length: REELS }, (_, reel) => {
        const spinning = target && !stopped.includes(reel)
        const visible = target && !spinning ? target : board
        const previous = board.slice(reel * ROWS, reel * ROWS + ROWS)
        const strip = target && !reducedReels ? [
          ...target.slice(reel * ROWS, reel * ROWS + ROWS),
          ...Array.from({ length: compactReels ? 7 + 2 * reel : 12 + 3 * reel },
            (_, i) => stripFiller[(i + 3 * reel) % stripFiller.length]),
          ...previous,
        ] : previous
        return <div className={`reel ${spinning ? 'spinning' : target ? 'stopped' : ''} ${anticipation && spinning ? 'potential' : ''}`} key={reel}>
          {spinning ? <div key={spinId} className={`reel-strip ${reducedReels ? 'still' : ''}`} aria-hidden="true"
            onAnimationEnd={event => {
              if (event.target === event.currentTarget &&
                  (event.animationName === 'roll' || event.animationName === 'hold-reel')) onReelStop(reel)
            }}
            style={{ '--roll-time': `${duration[reel]}ms`, '--strip-steps': strip.length - ROWS } as CSSProperties}>
            {strip.map((symbol, index) => {
              const previousRow = index - (strip.length - ROWS)
              const orb = previousRow >= 0 ? boardOrbs[cellAt(reel, previousRow)] : null
              return <div className="reel-cell" key={index}>
                {orb ? <OrbSymbol orb={orb}/>
                  : (reducedReels || index >= ROWS || (symbol !== 'orb' && symbol !== 'lantern')) && <Symbol symbol={symbol}/>}
              </div>
            })}
          </div> : Array.from({ length: ROWS }, (_, row) => {
            const index = cellAt(reel, row)
            const orb = bonus ? bonus[index] : baseOrbs ? baseOrbs[index] : boardOrbs[index]
            const revealed = landedSymbols.includes(index)
            const lantern = visible[index] === 'lantern' && !bonus
            const waiting = target && (visible[index] === 'orb' || lantern) && !revealed
            const cellSpins = respinning && !orb && (!stoppedCells.includes(index) || Boolean(nextBonusOrbs?.[index]))
            const classes = ['reel-cell', winningCells.has(index) && !bonus && 'winning-cell',
              bonus && orb && 'locked', revealed && (lantern ? 'new-lantern' : 'new-orb'),
              lantern && highlightLanterns && 'scatter-cell', bonus && !orb && 'empty',
              cellSpins && 'respinning'].filter(Boolean).join(' ')
            return <div key={index} className={classes} data-orb-position={bonus && orb ? index : undefined}
              style={{ '--cell-index': index } as CSSProperties}>
              {waiting ? null
                : orb ? <><OrbSymbol orb={orb}/>
                  {bonus && revealed && <span className="orb-burst" aria-hidden="true">
                    {Array.from({ length: 8 }, (_, ray) => <i key={ray} style={{ '--ray': `${ray * 45}deg` } as CSSProperties}/>)}
                  </span>}
                  {bonus && <LockKeyhole className="lock" size={12} aria-label="Held"/>}</>
                : cellSpins ? <CellReel position={index}/>
                : bonus ? <span className="empty-mark" aria-hidden="true">◇</span>
                : <Symbol symbol={visible[index]}/>}
            </div>
          })}
        </div>
      })}
      <LinesOverlay wins={bonus ? [] : wins} preview={bonus ? null : preview}/>
    </div>
  </div>
}
