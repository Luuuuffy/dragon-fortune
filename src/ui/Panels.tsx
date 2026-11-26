import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { BET_SIZES, BONUS_REBALANCE_VERSION, CELLS, CREDIT_PAYTABLE_VERSION, CREDIT_V3_LINE_AWARDS,
  CURRENT_MATH_VERSION, DENOMINATIONS_SEN, DESIGN_B_VERSION, EARLY_RESPIN_VERSION, JACKPOT_TIERS, ORB_VARIETY_VERSION,
  LINE_CREDITS, LINE_OPTIONS, PAYLINES, SYMBOLS, betPerLineSen, calculateJackpots, denominationLabel, money, totalBetSen,
  wagerCredits } from '../game/config'
import { BONUS, bonusEntryChance, respinRates } from '../game/bonusConfig'
import { isMinimumOrbWager, orbFaceLabel, orbWeightsForWager, priceWagerOrb } from '../game/orbPrizes'
import { LANTERN } from '../game/lanternConfig'
import type { Betting, JackpotPrizes, PaytableVersion, SymbolId } from '../game/config'
import { SCENARIOS, boardOrbChance, orbTypeProbabilities } from '../game/engine'
import type { Scenario } from '../game/engine'
import { freeSpinsWin, resetGame, resetStats, selectBetting, selectDenomination, spinJackpots } from '../game/session'
import type { Session, Settings } from '../game/session'
import { Symbol } from './Symbol'

export type PanelName = 'denomination' | 'betSize' | 'lines' | 'paylines' | 'paytable' | 'settings' | 'help' | 'stats' | 'developer' | 'reset' | 'resetStats' | 'bankroll' | 'bankrollReset'
const titles: Record<PanelName, string> = {
  denomination: 'Denomination', betSize: 'Bet size', lines: 'Active lines', paylines: 'Paylines', paytable: 'Paytable',
  settings: 'Settings', help: 'How to play', stats: 'Game statistics', developer: 'Developer test mode',
  reset: 'Reset game', resetStats: 'Reset statistics', bankroll: 'Set bankroll', bankrollReset: 'Reset bankroll',
}

export function Modal({ children, close, title, className = '' }: { children: ReactNode; close?: () => void; title: string; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    dialog.showModal()
    const viewport = window.visualViewport
    const fitKeyboard = () => {
      if (!viewport) return
      // Safari may shrink the visual viewport for the keyboard without resizing the layout viewport.
      const hidden = window.innerHeight - viewport.height
      const keyboard = viewport.scale === 1 && hidden > 100
      dialog.style.setProperty('--keyboard-top', `${keyboard ? Math.max(0, viewport.offsetTop) : 0}px`)
      dialog.style.setProperty('--keyboard-bottom', `${keyboard ? Math.max(0, hidden - viewport.offsetTop) : 0}px`)
      if (keyboard) dialog.style.setProperty('--keyboard-viewport', `${viewport.height}px`)
      else dialog.style.removeProperty('--keyboard-viewport')
    }
    viewport?.addEventListener('resize', fitKeyboard)
    viewport?.addEventListener('scroll', fitKeyboard)
    fitKeyboard()
    return () => {
      viewport?.removeEventListener('resize', fitKeyboard)
      viewport?.removeEventListener('scroll', fitKeyboard)
      dialog.close()
    }
  }, [])
  return <dialog ref={ref} className={`modal ${className}`} aria-label={title}
    onCancel={event => { event.preventDefault(); close?.() }}
    onClick={event => { if (event.target === event.currentTarget) close?.() }}>
    <div className="modal-content">
      <header className="modal-header">
        <h2>{title}</h2>
        {close && <button type="button" className="icon-button" onClick={close} aria-label="Close"><X size={20}/></button>}
      </header>
      {children}
    </div>
  </dialog>
}

const matchCounts = [2, 3, 4, 5] as const

const percent = (chance: number) => `${(chance * 100).toLocaleString('en-MY', { maximumFractionDigits: 8 })}%`
const theoreticalRtp = {
  [DESIGN_B_VERSION]: '91.27–92.69%',
  [BONUS_REBALANCE_VERSION]: '91.21–92.80%',
  [ORB_VARIETY_VERSION]: '91.08–92.92%',
  [EARLY_RESPIN_VERSION]: '91.00–93.00%',
  [CURRENT_MATH_VERSION]: '91.28–92.72%',
}

function Paytable({ betting, version, prizes }: { betting: Betting; version: PaytableVersion; prizes: JackpotPrizes }) {
  const { denominationSen, betSize } = betting
  const bet = totalBetSen(betting)
  const totalCredits = wagerCredits(betting)
  const scaled = version >= DESIGN_B_VERSION
  const lineScale = scaled ? betSize : 1
  const awardsTable = scaled ? LINE_CREDITS : CREDIT_V3_LINE_AWARDS
  const types = Object.fromEntries(orbTypeProbabilities(version))
  const wager = { denominationSen, bet, paytableVersion: version }
  const weights = orbWeightsForWager(wager)
  const totalWeight = weights.reduce((sum, [, weight]) => sum + weight, 0)
  const rates = respinRates(version)
  const entryRate = (free: boolean) => (100 * bonusEntryChance(CELLS, boardOrbChance(free, version))).toFixed(2)
  const rtp = version === 1 || version === 2 || version === CREDIT_PAYTABLE_VERSION ? undefined : theoreticalRtp[version]
  return <>
    <p>{scaled ? <>Paid and free line wins multiply the base credit award by Bet Size. The table shows awards at
      your current Bet Size of <strong>{betSize}</strong>.</> : 'This round uses the previous fixed-credit paytable.'}
      {' '}One credit is worth <strong>{money(denominationSen)}</strong>.</p>
    <table className="paytable">
      <thead><tr><th>Symbol</th>{matchCounts.map(count => <th key={count}>{count} match</th>)}</tr></thead>
      <tbody>{Object.entries(awardsTable).map(([symbol, awards]: [string, Partial<Record<number, number>>]) => <tr key={symbol}>
        <th scope="row"><span><Symbol symbol={symbol as SymbolId}/>{SYMBOLS[symbol as keyof typeof LINE_CREDITS].name}</span></th>
        {matchCounts.map(count => <td key={count}>{awards[count] ? awards[count] * lineScale : '—'}</td>)}
      </tr>)}</tbody>
    </table>
    <h3>Red Lantern Scatter</h3>
    <p>Each reel can show one Lantern. A paid trigger starts {LANTERN.initialSpins} automatic Free Spins.
      A qualifying Free Spin awards {LANTERN.extraSpins} more. Chicken, Boat, Lotus and Tiger are the paying symbols in Free Spins.</p>
    <ul className="orb-values">
      {([3, 4, 5] as const).map(count => <li key={count}><b>{count} Lanterns</b> {LANTERN.payouts[count]}× total bet · {money(bet * LANTERN.payouts[count])}</li>)}
    </ul>
    <p>Paying symbols match from the first reel. On reels 2–5, one to three Panda Wilds can stack and substitute for standard paying symbols. Each active line pays its highest qualifying combination.</p>
    <h3>Hold & Spin prizes</h3>
    <p>Six or more Gold Orbs start the feature. Entry is {entryRate(false)}% per paid spin and {entryRate(true)}% per Lantern Free Spin.
      A new orb restores three respins. Ordinary orb faces show credits below RM1 denomination and virtual MYR at RM1 and RM2.
      Each ordinary orb pays the triggering spin’s total bet × its multiplier.</p>
    <ul className="orb-values">
      {rates.map(([limit, chance], index) =>
        <li key={limit}><b>{rates[index - 1]?.[0] ?? BONUS.triggerCount}–{limit - 1} held</b> {percent(chance)} per empty cell</li>)}
    </ul>
    {scaled && <p>Ordinary multiplier chances depend on Bet Size × Active Lines.
      {version === CURRENT_MATH_VERSION && isMinimumOrbWager(denominationSen, totalCredits) &&
        ' The minimum wager uses its own mix because fixed jackpots account for more of its return.'}
      {' '}These are the chances per ordinary orb for the current <strong>{totalCredits}-credit</strong> wager.</p>}
    <ul className="orb-values">
      {weights.map(([multiplier, weight]) => {
        const orb = priceWagerOrb(wager, multiplier)
        return <li key={multiplier}><b>{multiplier}×</b> {orbFaceLabel(orb)}{!orb.displayMyr && ' credits'}<br/>{percent(weight / totalWeight)}</li>
      })}
    </ul>
    <ul className="orb-values">
      {JACKPOT_TIERS.map(tier => <li key={tier}><b>{tier.toUpperCase()}</b> {money(prizes[tier])}
        <br/>{tier === 'grand' ? 'Full board' : `${percent(types[tier])} per qualifying orb`}</li>)}
    </ul>
    <p>MINI, MINOR and MAJOR orbs pay their named jackpot. Fill every position to win GRAND {BONUS.grandAddsToOrbs ? 'in addition to the visible orb prizes' : 'as the full feature payout'}. Any regular line wins from the triggering spin are included in the final result.</p>
    {rtp && <p>Theoretical return across supported wagers is <strong>{rtp}</strong> for this virtual game.</p>}
  </>
}

function LineDiagram({ rows }: { rows: readonly number[] }) {
  return <svg viewBox="0 0 75 32" aria-hidden="true">
    {Array.from({ length: 15 }, (_, i) => <rect key={i} x={Math.floor(i / 3) * 15 + 1} y={i % 3 * 10 + 1} width="13" height="8" rx="1"/>)}
    <polyline points={rows.map((row, col) => `${col * 15 + 7.5},${row * 10 + 5}`).join(' ')}/>
  </svg>
}

export function Panels({ panel, open, close, session, action, commit, preview, setPreview, scenario, setScenario, developer, setDeveloper }: {
  panel: PanelName; open: (panel: PanelName) => void; close: () => void; session: Session;
  action: (update: (session: Session) => Session) => Promise<boolean>;
  commit: (update: (session: Session) => Session) => Promise<boolean>;
  preview: number | null; setPreview: (line: number | null) => void;
  scenario: Scenario | undefined; setScenario: (scenario: Scenario | undefined) => void;
  developer: boolean; setDeveloper: (enabled: boolean) => void;
}) {
  const { betting, stats, settings, initialBankroll, freeSpins, round } = session
  const { denominationSen, betSize, lines } = betting
  const bet = totalBetSen(betting)
  const spin = freeSpins?.root ?? ('spin' in round ? round.spin : 'bonus' in round ? round.bonus.spin : null)
  const paytableSpin = spin?.paytableVersion && spin.paytableVersion >= CREDIT_PAYTABLE_VERSION && spin.betting ? spin : null
  const idle = session.round.phase === 'IDLE'
  function settingsChange(patch: Partial<Settings>) {
    void commit(previous => ({ ...previous, settings: { ...previous.settings, ...patch } }))
  }
  const choose = async (update: (previous: Session) => Session) => {
    await action(update)
    close()
  }
  return <Modal close={close} title={titles[panel]} className={panel === 'paylines' ? 'line-modal' : ''}>
    {panel === 'denomination' && <>
      <p>Choose how much one credit is worth. Changing denomination resets Bet Size to 1.</p>
      <div className="choice-list">{DENOMINATIONS_SEN.map(value => <button aria-pressed={denominationSen === value} key={value} disabled={!idle}
        onClick={() => void choose(previous => selectDenomination(previous, value))}>{denominationLabel(value)}</button>)}</div>
    </>}
    {panel === 'betSize' && <>
      <p>Choose the number of credits wagered per active line.</p>
      <div className="choice-list">{BET_SIZES.map(value => <button aria-pressed={betSize === value} key={value} disabled={!idle}
        onClick={() => void choose(previous => selectBetting(previous, { betSize: value }))}>{value}</button>)}</div>
    </>}
    {panel === 'lines' && <>
      <p>Each active line costs <strong>{money(betPerLineSen(betting))}</strong> per spin.</p>
      <div className="choice-list">{LINE_OPTIONS.map(value => <button aria-pressed={lines === value} key={value} disabled={!idle}
        onClick={() => void choose(previous => selectBetting(previous, { lines: value }))}>{value} lines</button>)}</div>
      <button className="text-button" onClick={() => open('paylines')}>View all {PAYLINES.length} paylines</button>
    </>}
    {panel === 'paylines' && <>
      <p>Choose a line to preview its path on the reels. The first {lines} lines are active.</p>
      <div className="line-cards">{PAYLINES.map((rows, line) =>
        <button key={line} className={line < lines ? 'active-line' : ''} aria-pressed={preview === line}
          onClick={() => setPreview(preview === line ? null : line)}>
          <span>{line + 1}</span><LineDiagram rows={rows}/>
        </button>
      )}</div>
    </>}
    {panel === 'paytable' && <Paytable betting={paytableSpin?.betting ?? betting}
      version={paytableSpin?.paytableVersion ?? CURRENT_MATH_VERSION}
      prizes={paytableSpin ? spinJackpots(paytableSpin) : calculateJackpots(denominationSen)}/>}
    {panel === 'settings' && <div className="settings-list">
      {([['volume', 'Master volume'], ['musicVolume', 'Background music volume'],
        ['reelVolume', 'Reel stop volume'], ['orbVolume', 'Gold orb volume'],
        ['jackpotVolume', 'Jackpot volume']] as const).map(([key, label]) => <label key={key}>{label}
        <input type="range" min="0" max="100" value={Math.round(settings[key] * 100)}
          onChange={event => settingsChange({ [key]: +event.target.value / 100 })}/></label>)}
      <label>Mute <input type="checkbox" checked={settings.muted} onChange={event => settingsChange({ muted: event.target.checked })}/></label>
      <label>Animation speed <select value={settings.speed} onChange={event => settingsChange({ speed: +event.target.value })}>
        {[0.75, 1, 1.5, 2].map(speed => <option value={speed} key={speed}>{speed}×</option>)}
      </select></label>
      <label>Reduced motion <input type="checkbox" checked={settings.reduced} onChange={event => settingsChange({ reduced: event.target.checked })}/></label>
      <div className="modal-actions">
        <button onClick={() => open('stats')}>Game statistics</button><button onClick={() => open('developer')}>Developer tools</button>
        <button disabled={!idle} onClick={() => open('bankroll')}>Set bankroll</button>
        <button className="danger" disabled={!idle} onClick={() => open('reset')}>Reset game</button>
      </div>
    </div>}
    {panel === 'help' && <>
      <h3>Spin the reels</h3>
      <p>Choose a denomination, bet size and line count. One credit is worth the selected denomination. Your total bet is credits per line × active lines × denomination. Press Spin or Space to play. Matches count from the first reel along an active path. Tiger pays from two matches and other paying symbols from three. Panda Wilds can complete a match.</p>
      <p>Press Stop or Space while the reels are moving to see the result immediately.</p>
      <p>Paid spins and Free Spins multiply base line credits by Bet Size. Across all supported wagers, the theoretical return for new wagers is {theoreticalRtp[CURRENT_MATH_VERSION]}.</p>
      <h3>Hold & Spin</h3>
      <p>Land six or more Gold Orbs to start with three respins. Orbs stay in their original cells and only empty positions respin. Each newly filled cell resets the counter to three. The round ends at zero respins or a full board.</p>
      <p>Total Credits Wagered is Bet Size × Active Lines. This total determines the ordinary multiplier odds.
        The minimum 1¢ wager has its own multiplier mix. The Paytable lists the active odds.</p>
      <h3>Lantern Free Spins</h3>
      <p>Land Red Lanterns on three or more reels in a paid spin for {LANTERN.initialSpins} automatic Free Spins.
        Land three or more during a Free Spin for {LANTERN.extraSpins} extra spins. Chicken, Boat, Lotus and Tiger are the paying symbols throughout the feature. Hold &amp; Spin rounds triggered during Free Spins also play automatically.</p>
      <h3>Jackpots</h3>
      <p>MINI pays 5,000 credits and MINOR pays 20,000 credits at the triggering denomination.
        MAJOR pays RM 50,000 and a full Hold &amp; Spin board adds GRAND of RM 200,000.
        See the Paytable for jackpot odds. All amounts are virtual Malaysian Ringgit.</p>
      <div className="modal-actions"><button onClick={() => open('paytable')}>Symbol paytable & orb values</button><button onClick={() => open('paylines')}>All paylines</button></div>
    </>}
    {panel === 'stats' && <>
      <dl className="stats-list">
        <div><dt>Initial bankroll</dt><dd>{money(initialBankroll ?? 0)}</dd></div>
        <div><dt>Current bankroll</dt><dd>{money(session.balance)}</dd></div>
        <div><dt>Current denomination</dt><dd>{money(denominationSen)}</dd></div>
        <div><dt>Current bet size</dt><dd>{betSize}</dd></div>
        <div><dt>Current active lines</dt><dd>{lines}</dd></div>
        <div><dt>Total spins</dt><dd>{stats.spins.toLocaleString()}</dd></div>
        <div><dt>Total wagered</dt><dd>{money(stats.wagered)}</dd></div>
        <div><dt>Total won</dt><dd>{money(stats.won)}</dd></div>
        <div><dt>Net virtual profit/loss</dt><dd>{money(stats.won - stats.wagered)}</dd></div>
        <div><dt>Bonus triggers</dt><dd>{stats.bonuses.toLocaleString()}</dd></div>
        <div><dt>Lantern features</dt><dd>{stats.freeFeatures.toLocaleString()}</dd></div>
        <div><dt>Free Spins played</dt><dd>{stats.freePlayed.toLocaleString()}</dd></div>
        <div><dt>Free Spins retriggers</dt><dd>{stats.freeRetriggers.toLocaleString()}</dd></div>
        {JACKPOT_TIERS.map(tier => <div key={tier}><dt>{tier.toUpperCase()} jackpots</dt><dd>{stats.jackpots[tier].toLocaleString()}</dd></div>)}
        <div><dt>Biggest single win</dt><dd>{money(stats.biggest)}</dd></div>
      </dl>
      <button className="danger" disabled={!idle} onClick={() => open('resetStats')}>Reset statistics</button>
    </>}
    {panel === 'developer' && <>
      <p>Testing tool. Forced spins use the current virtual balance and statistics. Each selection applies to the next spin only. The insufficient-balance scenario temporarily displays {money(0)} until cleared.</p>
      <div className="settings-list">
        <label>Enable developer mode <input type="checkbox" checked={developer} disabled={!idle}
          onChange={event => setDeveloper(event.target.checked)}/></label>
        <label>Next outcome <select disabled={!developer || !idle} value={scenario ?? ''}
          onChange={event => setScenario((event.target.value || undefined) as Scenario | undefined)}>
          <option value="">Random spin</option>
          {Object.entries(SCENARIOS).map(([key, label]) => <option value={key} key={key}>{label}</option>)}
        </select></label>
      </div>
      {developer && <dl className="stats-list">
        <div><dt>Game state</dt><dd>{round.phase}</dd></div>
        <div><dt>Free Spins remaining</dt><dd>{freeSpins?.remaining ?? 0}</dd></div>
        <div><dt>Free Spins awarded</dt><dd>{freeSpins?.awarded ?? 0}</dd></div>
        <div><dt>Retriggers</dt><dd>{freeSpins?.retriggers ?? 0}</dd></div>
        <div><dt>Accumulated Free Spins win</dt><dd>{money(freeSpins ? freeSpinsWin(freeSpins) : 0)}</dd></div>
        <div><dt>Queued Hold &amp; Spin rounds</dt><dd>{Number(Boolean(freeSpins?.paidHold)) + Number(Boolean(freeSpins?.nextHold))}</dd></div>
        <div><dt>Active wager</dt><dd>{denominationLabel(denominationSen)} × {betSize} × {lines} · {money(freeSpins?.root.bet ?? bet)}</dd></div>
      </dl>}
    </>}
    {panel === 'reset' && <>
      <p>Restore the initial bankroll of {money(initialBankroll ?? 0)} and clear game statistics and the last result?</p>
      <div className="modal-actions"><button onClick={() => open('settings')}>Cancel</button>
        <button className="danger" disabled={!idle} onClick={async () => {
          if (await action(resetGame)) { setScenario(undefined); close() }
        }}>Reset game</button></div>
    </>}
    {panel === 'resetStats' && <>
      <p>Clear all recorded statistics? Your balance stays at {money(session.balance)}.</p>
      <div className="modal-actions"><button onClick={() => open('stats')}>Cancel</button>
        <button className="danger" disabled={!idle} onClick={() => void choose(resetStats)}>Reset statistics</button></div>
    </>}
  </Modal>
}
