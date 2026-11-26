import { useCallback, useEffect, useRef, useState } from 'react'
import {
  BookOpen, ChevronDown, CircleHelp, Coins as CoinIcon, Grid3X3, Layers3,
  Settings as SettingsIcon, Volume2, VolumeX,
} from 'lucide-react'
import { CREDIT_PAYTABLE_VERSION, JACKPOT_TIERS, REELS, calculateJackpots, credits, denominationLabel, money, totalBetSen } from '../game/config'
import { SCENARIOS, secureRandom } from '../game/engine'
import type { Scenario } from '../game/engine'
import { completeHoldCollection, lastWinSen, spinJackpots } from '../game/session'
import { applyRoundIntent, roundIntent, roundIntentKey } from '../game/roundIntent'
import type { RoundIntent } from '../game/roundIntent'
import { useSession } from '../game/useSession'
import { play, playRoundCue, unlockAudio } from './audio'
import { createSpinId } from './spinId'
import { Bankroll } from './Bankroll'
import { Coins, ResultBreakdown, winLabel } from './Celebration'
import { FreeSpinsDisplay, FreeSpinsMeters } from './FreeSpinsDisplay'
import { HoldCollection } from './HoldCollection'
import { Panels } from './Panels'
import type { PanelName } from './Panels'
import { Reels } from './Reels'
import { RoundButton } from './RoundButton'
import { Symbol, SymbolPaint } from './Symbol'
import { useRoundAnimation } from './useRoundAnimation'

export function App() {
  const { session, action, commit, saveFailed } = useSession()
  const { round, settings, betting, last, freeSpins } = session
  const { denominationSen, betSize, lines } = betting
  const needsBankroll = session.initialBankroll === null
  const bet = totalBetSen(betting)
  const animation = useRoundAnimation(session, commit)
  const field = useRef<HTMLElement>(null)
  const [panel, setPanel] = useState<PanelName | null>(null)
  const [preview, setPreview] = useState<number | null>(null)
  const [developer, setDeveloper] = useState(false)
  const [scenario, setScenario] = useState<Scenario>()
  const idle = round.phase === 'IDLE'
  const ready = round.phase === 'BONUS_READY' && !freeSpins
  const lineWin = round.phase === 'LINE_WIN' ? round.result : null
  const result = !freeSpins && 'result' in round && round.phase !== 'LINE_WIN' ? round.result : null
  const bonus = 'bonus' in round ? round.bonus : null
  const holdResult = round.phase === 'FEATURE_HOLD_RESULT' ? round.holdResult : result
  const collectionComplete = 'collectionComplete' in round && Boolean(round.collectionComplete)
  const continueId = lineWin?.spinId ?? (collectionComplete ? result?.spinId : undefined)
  const collectionOrbs = 'orbs' in round && holdResult ? round.orbs : null
  const outcome = 'outcome' in round ? round.outcome : null
  const activeSpin = freeSpins?.root ?? ('spin' in round ? round.spin : bonus?.spin) ?? result ?? lineWin
  const roundBet = activeSpin?.bet ?? bet
  const jackpotPrizes = activeSpin ? spinJackpots(activeSpin) : calculateJackpots(denominationSen)
  const simulatedLow = developer && scenario === 'insufficient'
  const intent = panel || (simulatedLow && idle) ? null : roundIntent(session)
  const balance = simulatedLow ? 0 : session.balance - (result && !collectionComplete ? result.total : 0)
  const lastWin = lastWinSen(session)
  const forcedRound = freeSpins?.root.scenario ?? ('spin' in round ? round.spin.scenario : bonus?.spin.scenario)
  const testScenario = forcedRound ?? scenario

  const open = (next: PanelName) => { setPreview(null); setPanel(next) }
  const close = () => { setPreview(null); setPanel(null) }
  const finishCollection = useCallback((id: string) => {
    void commit(previous => completeHoldCollection(previous, id))
  }, [commit])
  const toggleSound = () => {
    unlockAudio()
    void action(previous => ({ ...previous, settings: { ...previous.settings, muted: !previous.settings.muted } }))
  }

  const activate = useCallback(async (selected: RoundIntent) => {
    unlockAudio()
    if (await action(previous => applyRoundIntent(previous, selected, secureRandom, createSpinId, developer ? scenario : undefined))) {
      if (selected.kind === 'continue') return
      if (selected.kind === 'stop-spin' || selected.kind === 'stop-respin') {
        playRoundCue({ type: 'REEL_STOP', reel: REELS - 1 }, settings)
        return
      }
      if (selected.kind === 'spin') setScenario(undefined)
      play('spin', settings)
    }
  }, [action, developer, scenario, settings])

  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.altKey || event.ctrlKey || event.metaKey || !intent) return
      if (event.target instanceof HTMLElement && event.target.closest('button, input, select, textarea, a, [contenteditable]')) return
      event.preventDefault()
      if (!event.repeat) void activate(intent)
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [activate, intent])

  const buttonLabel = round.phase === 'SPINNING' || round.phase === 'BONUS_RESPIN' ? 'Stop' :
    freeSpins ? 'Auto play' : continueId ? 'Continue' : ready ? 'Respin' :
    holdResult ? 'Collecting' : 'Spin'
  const status = lineWin ? `${winLabel(lineWin)} · ${lineWin.lines.length} winning ${lineWin.lines.length === 1 ? 'line' : 'lines'}`
    : round.phase === 'SPINNING' ? animation.anticipation ? 'Gold orbs in play' : 'Reels spinning'
    : needsBankroll ? 'Set your initial bankroll' : idle && balance < bet ? 'INSUFFICIENT BALANCE'
    : idle && last?.total === 0 ? 'No win this spin' : 'Choose your bet and spin'
  const showBonus = bonus && round.phase !== 'BONUS_TRIGGER'
    ? bonus.orbs.map((orb, position) => orb ?? (animation.landedSymbols.includes(position) ? bonus.next?.orbs[position] ?? null : null))
    : collectionOrbs
  const baseOrbs = round.phase === 'SPINNING' ? round.orbs : round.phase === 'BONUS_TRIGGER' ? round.bonus.orbs : null
  const bankrollPanel = panel === 'bankroll' || panel === 'bankrollReset'

  return <div className={`game-shell ${animation.reduced ? 'reduced' : ''}`}>
    <SymbolPaint/>
    <div className="stage-art" aria-hidden="true"/>
    <header className="topbar">
      <div className="brand"><span className="brand-icon"><Symbol symbol="dragon"/></span><span>Dragon Fortune</span></div>
      <span className="virtual"><span/> VIRTUAL PLAY</span>
      <nav aria-label="Game tools">
        <button onClick={() => open('paytable')} aria-label="Paytable" title="Paytable"><BookOpen size={16}/><span>Paytable</span></button>
        <button onClick={() => open('help')} aria-label="Help" title="Help"><CircleHelp size={17}/><span>Help</span></button>
        <button onClick={() => open('settings')} aria-label="Settings" title="Settings"><SettingsIcon size={17}/><span>Settings</span></button>
        <button className="sound-control" aria-label={settings.muted ? 'Unmute sound' : 'Mute sound'} title={settings.muted ? 'Unmute sound' : 'Mute sound'}
          onClick={toggleSound}>{settings.muted ? <VolumeX size={19}/> : <Volume2 size={19}/>}</button>
      </nav>
    </header>

    <main className="game">
      <div className="masthead">
        <div className="masthead-flourish" aria-hidden="true"><i/>◆<i/></div>
        <h1>Dragon Fortune</h1>
        <div className="feature-title"><i/> HOLD &amp; SPIN <i/></div>
      </div>
      {(developer || forcedRound) && <button className="dev-indicator" onClick={() => open('developer')}>
        Developer test mode{testScenario ? ` · ${SCENARIOS[testScenario]}` : ''}
      </button>}
      <section className="jackpots" aria-label="Jackpots" aria-live="polite">
        {JACKPOT_TIERS.map(tier => <div className={`jackpot ${tier}`} key={tier}>
          <div className="jackpot-name"><i/> {tier.toUpperCase()} <i/></div>
          <strong>{money(jackpotPrizes[tier])}</strong>
        </div>)}
      </section>

      <section ref={field} className="playfield" aria-label="Reels and status">
        {holdResult && collectionOrbs ? <HoldCollection key={holdResult.bonusId} field={field} orbs={collectionOrbs}
          result={holdResult} complete={collectionComplete} settings={settings} reduced={animation.reduced}
          onComplete={finishCollection}/>
        : <div className={`reel-heading ${bonus || freeSpins ? 'in-feature' : ''}`} aria-live="polite">
          {bonus ? <><span>HOLD &amp; SPIN</span><span className="respins">RESPINS REMAINING <b key={bonus.turn + ':' + round.phase}>{bonus.remaining}</b></span></>
            : freeSpins ? <FreeSpinsMeters feature={freeSpins} increase={round.phase === 'FREE_WAIT' && round.extra > 0}/>
            : <><p>{status}</p><button className="paylines-link" onClick={() => open('paylines')}><Grid3X3 size={15}/> Paylines</button></>}
        </div>}
        <div className="reels-container">
          <Reels board={session.board} boardOrbs={session.boardOrbs}
            target={round.phase === 'SPINNING' ? round.spin.board : null}
            stopped={animation.stopped} duration={animation.duration} preview={preview}
            bonus={showBonus} baseOrbs={baseOrbs} respinning={round.phase === 'BONUS_RESPIN'} landedSymbols={animation.landedSymbols}
            stoppedCells={animation.stoppedCells} nextBonusOrbs={bonus?.next?.orbs ?? null}
            highlightLanterns={(outcome?.lanterns ?? 0) >= 3}
            wins={outcome?.lines ?? lineWin?.lines ?? []} spinId={round.phase === 'SPINNING' ? round.spin.id : ''}
            anticipation={animation.anticipation} reducedReels={animation.reducedReels}
            compactReels={animation.compactReels} onReelStop={animation.onReelStop}
            freeSymbols={(freeSpins?.root.paytableVersion ?? 1) >= CREDIT_PAYTABLE_VERSION}/>
          {round.phase === 'BONUS_TRIGGER' && <div className="bonus-trigger" role="status"><strong>Bonus Triggered</strong><span>HOLD &amp; SPIN</span></div>}
          {freeSpins && <FreeSpinsDisplay feature={freeSpins} round={round} reduced={animation.reduced}/>}
          {lineWin && !animation.reduced && <Coins count={12}/>}
        </div>
        {holdResult && collectionComplete && <div className="line-result"><ResultBreakdown result={holdResult}
          denominationSen={denominationSen} showTotal={false}/></div>}
      </section>

      <section className="console" aria-label="Game controls">
        <div className="meter balance"><span><CoinIcon size={13}/> Balance</span><strong>{money(balance)}</strong>
          <small>{credits(balance, denominationSen)} credits</small></div>
        <button className="bankroll-reset" disabled={!idle || needsBankroll} onClick={() => open('bankrollReset')}>
          Reset bankroll
        </button>
        <button className="meter picker denomination-picker" disabled={!idle || needsBankroll} onClick={() => open('denomination')}
          aria-label={`Denomination ${denominationLabel(denominationSen)}`}>
          <span>Denomination <ChevronDown size={13}/></span><strong>{denominationLabel(denominationSen)}</strong>
        </button>
        <button className="meter picker bet-size-picker" disabled={!idle || needsBankroll} onClick={() => open('betSize')}
          aria-label={`Bet size ${betSize}`}>
          <span>Bet size <ChevronDown size={13}/></span><strong>{betSize}</strong>
        </button>
        <button className="meter picker lines-picker" disabled={!idle || needsBankroll} onClick={() => open('lines')} aria-label={`Active lines ${lines}`}>
          <span>Active lines <ChevronDown size={13}/></span><strong><Layers3 size={16}/> {lines}</strong>
        </button>
        <div className="meter total-bet" aria-live="polite"><span>Total bet</span><strong>{money(roundBet)}</strong>
          <small>{credits(roundBet, denominationSen)} credits</small></div>
        <div className="meter last-win"><span>Last win</span><strong>{money(lastWin)}</strong>
          <small>{credits(lastWin, denominationSen)} credits</small></div>
        <RoundButton key={roundIntentKey(intent)} intent={intent} label={buttonLabel} onActivate={activate}/>
      </section>
      {lineWin && <div className="line-result" aria-live="polite"><ResultBreakdown result={lineWin}
        denominationSen={denominationSen} showTotal={false}/></div>}
      <footer className="game-footer">
        <span>Virtual Malaysian Ringgit (MYR)</span>
        <span className="keyboard"><kbd>Space</kbd> to spin</span>
        {saveFailed && <span role="status">Saving is unavailable. Progress lasts until this tab closes.</span>}
      </footer>
    </main>

    {needsBankroll && <Bankroll session={session} action={action}/>}
    {!needsBankroll && bankrollPanel && <Bankroll key={panel} session={session} action={action} quickReset={panel === 'bankrollReset'}
      close={panel === 'bankrollReset' ? close : () => open('settings')} onSaved={() => { setScenario(undefined); close() }}/>}
    {!needsBankroll && panel && !bankrollPanel && <Panels key={panel} panel={panel} open={open} close={close} session={session} action={action} commit={commit}
      preview={preview} setPreview={setPreview} scenario={scenario} setScenario={setScenario} developer={developer}
      setDeveloper={enabled => { setDeveloper(enabled); if (!enabled) setScenario(undefined) }}/>}
  </div>
}
