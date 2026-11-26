# Dragon Fortune full audit and 92% RTP recommendation

**Scope** — Current local Dragon Fortune implementation and production build. All amounts are virtual MYR. The candidate configurations ran in isolated temporary copies of the game engine.

## A. Executive summary

- **The current default wager returns about 154.35% in expectation.** The audit's 10-million-paid-spin run returned 153.14% in raw awards. Using exact Scatter and Hold & Spin math and sampled line returns gives **154.35%**, with an approximate **154.13–154.56%** sampling interval for the line-return estimate. The previously reported **154.12%** reproduces as a one-million-spin estimate using a slightly different mix of sampled and modeled components.
- **Hold & Spin is the largest grouped contribution at 61.20 percentage points.** Regular paid paylines are the largest of the nine individual categories at **46.40 points**. Free Spins lines add **41.47 points** by themselves. The high RTP comes from several generous rules acting together. The audit found no systematic double counting in normal settlement or simulation.
- **The current Hold & Spin results follow from random draws.** The exact mean is **8.1693** final orbs from six, and the 10-million-spin run observed **8.1754** across 172,768 six-orb starts. The current rates depend on the number already held. A bonus can finish with the six original orbs.
- **The recommended balanced proposal reaches 92.69% at 1¢ × 1 × 8 and 91.47% at 10¢ × 1 × 8.** It keeps the four jackpot amounts, current bonus entry rates, and current respin schedule. It changes the line awards, Wild requests, Free Spins Tiger weight, ordinary orb multiplier mix, and MINI/MINOR type odds. It substantially reduces RTP at larger bet sizes, so the wager menu needs a separate design decision if the target applies across the menu.
- **The main functional priority is the shared Continue/Spin button.** An isolated two-tab QA run produced an unintended new paid spin when the first tab dismissed a result while the second tab was interacting with its Continue button. Ordinary Hold & Spin collection and refresh tests preserved the settled prize.

## B. Game architecture

| Responsibility | Implementation |
|---|---|
| Rules and data | `config.ts` holds denominations, bet settings, paths, paytables, and jackpot amounts. `probabilityConfig.ts` configures symbol weights, Wild requests, Lanterns, and Gold Orbs. |
| Math and random outcomes | `engine.ts` generates boards, evaluates line and Scatter wins, prices orbs through `orbPrizes.ts`, and settles Hold & Spin. `bonusConfig.ts` implements binomial board expectations. |
| Ledger and persistence | `session.ts` handles state transitions and integer-sen accounting. `storage.ts` validates and migrates saves. `useSession.ts` coordinates React state, LocalStorage, and Web Locks when supported. |
| Presentation | `App.tsx`, `Reels.tsx`, `HoldCollection.tsx`, and `FreeSpinsDisplay.tsx` render cabinet, controls, and features. `useRoundAnimation.ts`, `roundCues.ts`, and `automaticRound.ts` schedule reveals and automatic transitions. |
| Audio and tooling | Web Audio synthesizes effects and the score. React, TypeScript, Vite, CSS, and Motion drive the app. The CLI simulator and Vitest suites use the game modules. |

[Game engine](src/game/engine.ts) · [Session state](src/game/session.ts) · [LocalStorage validation](src/game/storage.ts) · [Application](src/ui/App.tsx) · [Simulator](src/game/simulation.ts)

## C. Current mathematical model

| Setting | Verified rule |
|---|---|
| Denomination | 1, 2, 5, 10, 20, 50, 100, or 200 sen per credit |
| Bet size | 1, 2, 3, 5, or 10 credits per active line |
| Active lines | First 8, 18, 38, 58, or 88 paths |
| Paid wager | Denomination × bet size × active lines. Default 8 sen. |
| Line payout | Listed credits × denomination for each winning active line. In the current credit rules the award for a given match stays fixed when the bet-size selector changes. |
| Scatter and ordinary orb payout | Scatter multiplier × total triggering wager, or stored orb multiplier × total triggering wager. |
| Jackpot payout | MINI/MINOR scale with denomination. MAJOR/GRAND are fixed MYR amounts. |

On each paid board, the engine rolls independently for the 15 original Gold Orb positions. Among the remaining positions it draws a Lantern count, caps the count by the number of open reels, chooses that many distinct reels, and places one Lantern on an open cell per chosen reel. It then requests a contiguous Wild stack on each eligible reel and fills remaining cells from its paying-symbol pool. The Free Spins generator uses a separate pool and Wild weights. It may replace one regular symbol with an extra orb on a board with four or fewer original orbs, which preserves the distribution of qualifying six-or-more starts.

The audit counts one **paid cycle** as the paid spin plus all descendant Free Spins, Scatters, and Hold & Spin awards. The denominator is the sum of the initial wagers only. Payout categories use full awards in sen, including a return equal to the wager when applicable. [Betting and paytables](src/game/config.ts) · [Board and payout engine](src/game/engine.ts) · [Orb pricing](src/game/orbPrizes.ts)

## D. Verification of the reported 154.12%

The existing CLI with **1,000,000 spins, 1¢, bet size 1, eight lines, seed 2026** reproduced **153.5247% raw** and **154.1215% with modeled Hold & Spin**. Its headline estimate combines sampled paid and free lines and Scatters with expected ordinary orb and jackpot payouts. The 154.12% figure is therefore a reproducible hybrid estimate. The current CLI groups free lines with free Scatters and all jackpot tiers together.

An independent audit harness reproduced the same **RM122,819.77** in total awards on the same million-spin stream. It used the game's production draw and payout functions, accumulated nine categories separately, and applied a separate calculation for Scatter probabilities and Hold & Spin ending distributions. A separate payline evaluator agreed with the game on **60,000 paid and free boards** covering all line presets. The actual session state machine and the CLI also matched total awards, feature counts, jackpot counts, and ledger identities on **60,000 additional paid cycles** across the six requested wagers, with **2,643 serialized restore checks** during those cycles. The play session used production transition functions with seeded randomness in memory, and the simulator used the same seeds per wager.

The audit's modeled column uses exact paid and free Scatter expectations and exact Hold & Spin expectations. It estimates paid-line return per paid board and free-line return per free board, then multiplies the latter by the exact expected number of free boards per paid spin. This trims noise from how many feature and jackpot events happened to appear in a sample. [Current simulation](src/game/simulation.ts) · [CLI](scripts/simulate.ts) · [Session transitions](src/game/session.ts)

## E. Actual RTP, uncertainty, and session metrics

### Reproducible samples

The rows are nested prefixes of the audit's seed-2026 stream at the default **RM0.08** wager. The independent six-wager matrix uses seed **91373**. The interval is an approximate 95% sampling interval for the modeled estimate, with exact Scatter, feature volume, and Hold & Spin means treated as fixed. Score per paid cycle was adjusted for the sampled number of free boards when estimating line-return variance.

| Paid spins | Virtual wagers | Total awards | Raw RTP | RTP using exact bonus means | Modeled 95% half-width |
|---:|---:|---:|---:|---:|---:|
| 10,000 | RM800.00 | RM1,335.57 | 166.95% | 153.03% | ±7.16 pp |
| 100,000 | RM8,000.00 | RM12,109.21 | 151.37% | 151.11% | ±2.11 pp |
| 1,000,000 | RM80,000.00 | RM122,819.77 | 153.52% | 153.77% | ±0.68 pp |
| 10,000,000 | RM800,000.00 | RM1,225,143.60 | 153.14% | **154.35%** | **±0.22 pp** |

The ten-million raw sample has a nominal ±1.21 pp standard-error interval. The sample contained zero MAJOR and GRAND awards, so this raw interval under-represents their long-tail risk. The second seed yielded **154.46% ±0.68 pp** at the default wager. The estimated payout per paid cycle is **RM0.1235** from the modeled return, and the observed average was **RM0.1225**.

| Default-wager metric | 10-million-spin result |
|---|---:|
| Paid spin with a line win | 17.4936% |
| Paid spin with at least two winning lines | 6.7176%, or 38.40% of paid line hits |
| A paid cycle returning any amount | 20.8366% |
| A paid cycle returning strictly more than RM0.08 | 16.9512% |
| Completed zero-payout streak, average / longest observed | 4.80 / 59 paid cycles |
| Completed net-loss streak, average / longest observed | 5.42 / 75 paid cycles |
| Paid Lantern trigger | 1.71562% observed / 1.71311% exact |
| Paid Hold & Spin trigger | 1.99716% observed / 2.00338% exact |
| Hold & Spin triggers including free boards | 222,190 observed, 2.23022 expected per 100 paid spins |

### Representative wagers

The default column below uses the larger run. The other current estimates use the one-million-spin matrix. At the same line count and bet size, a higher denomination reduces the fixed MAJOR and GRAND share of RTP. At the same denomination and lines, a higher bet size lowers the relative contribution of line wins and every jackpot tier. The ordinary orb and Scatter percentages stay constant.

| Denom × size × lines | Total wager | Current estimated RTP | Relative to 92% | Balanced proposal RTP |
|---|---:|---:|---|---:|
| 1¢ × 1 × 8 | RM0.08 | **154.35%** | Above | **92.69%** |
| 10¢ × 1 × 8 | RM0.80 | **153.25%** | Above | **91.47%** |
| 20¢ × 1 × 18 | RM3.60 | **139.98%** | Above | **81.06%** |
| 50¢ × 2 × 38 | RM38.00 | **85.47%** | Below | **54.39%** |
| RM1 × 3 × 58 | RM174.00 | **69.75%** | Below | **46.89%** |
| RM2 × 5 × 88 | RM880.00 | **57.12%** | Below | **41.07%** |

With fixed denomination and active lines, the RTP fraction has the form **proportional return + fixed-award return ÷ bet size**, where the latter is defined at size 1. For sizes 1 and 10 to both fall within 91–93%, the size-1 share from all lines and jackpots would have to be at most **2.22 percentage points**. At default lines and denomination, current MAJOR plus GRAND alone add about **1.35 points**, and all line categories together add **87.87 points**. A single set of global weights is therefore unsuitable for a consistent 92% across the full existing menu if regular line wins and meaningful jackpots remain a goal. A common target across wagers would require a visible wager/payout redesign, published wager-tier rules, or a narrower set of calibrated combinations.

## F. Mutually exclusive RTP components

The Free Spins columns exclude the opening paid Scatter. All Hold & Spin prizes go in their own columns regardless of whether their board was paid or free. Each special orb replaces an ordinary orb payout in this accounting, and GRAND adds a separate award on a full board.

| Component | Actual awards in the 10M run | Raw RTP pp | Audit estimate pp |
|---|---:|---:|---:|
| Regular paid lines | RM371,206.87 | 46.401 | **46.401** |
| Paid Scatter | RM34,679.20 | 4.335 | **4.332** |
| Free Spins lines | RM331,987.45 | 41.498 | **41.469** |
| Free Spins Scatter | RM7,524.72 | 0.941 | **0.947** |
| Hold & Spin ordinary orbs | RM266,895.36 | 33.362 | **33.436** |
| MINI | RM139,450.00 | 17.431 | **17.224** |
| MINOR | RM73,400.00 | 9.175 | **9.186** |
| MAJOR | RM0.00 | 0 | **1.148** |
| GRAND | RM0.00 | 0 | **0.204** |
| **Total** | **RM1,225,143.60** | **153.143** | **154.347** |

### Ranked drivers of excess return

1. **Line awards and Panda stacks across both modes.** Together the two line categories contribute **87.87 pp**. An isolated 450,000-spin diagnostic with Wild requests disabled estimated **88.02% total RTP**, down about **66.3 pp**, and cut paid line hits from 17.49% to 8.56%. Its purpose is to measure the current Wild effect. The proposal retains stacks. Removing only the two-Tiger tier in a 600,000-spin diagnostic likewise reduced estimated total RTP by about **8.1 pp** and paid line hits to **12.80%**. These sensitivities overlap.
2. **Free Spins symbol concentration.** Four eligible paying symbols, a 39% Wild stack request on eligible reels, and up to 300 credits for Tiger produce **52.47% observed free-board line hits**. Free lines alone add **41.47 pp** at the default wager, almost as much as all paid lines.
3. **The ordinary orb floor and multiplier mix.** The mean ordinary multiplier of **1.823×** contributes **33.44 pp** at every wager. At the current entry and ending-occupancy rates, the mathematical 1× floor would still contribute **18.34 pp**. A less aggressive mix preserves high-value orbs but can remove only part of the excess.
4. **Denomination-based MINI and MINOR odds against a small total wager.** These tiers add **26.41 pp** at eight lines and size 1. MAJOR and GRAND together add **1.35 pp** at the default wager. Fixed rare jackpots are a tail-risk concern and a smaller long-run mean driver.
5. **The wager scaling mismatch.** Lines and jackpots shrink as a percentage when players buy more credits per line, while Scatter and ordinary orbs scale with the whole wager. Separately, reducing initial orb frequency opens positions for matching symbols and Lanterns. This offsets part of the Hold & Spin reduction, as proposal B demonstrates.

The 2.00% Hold trigger and tiered respin rates increase spending on ordinary orbs and MINI/MINOR, but the settings produce their documented probabilities. The paid and free Scatters together contribute **5.28 pp**. The audit found no incorrect Wild substitutions, duplicate path definitions, or systematic wager-base errors in the current credit rules.

## G. Symbol distribution and paytable

Both tables show observed percentages **per visible cell on each reel**, averaged over its three rows. Paid sample **10,000,000 boards**. Free sample **1,133,082 boards**. Regular symbols are equally weighted within their respective pool. Reel 1 has more regular symbols because it cannot host Panda Wilds. In Free Spins the extra-orb replacement can affect reel 1 more often because it retains more regular cells.

**Paid boards**

| Reel | 9 | 10 | J | Q | K | Chicken | Boat | Lotus | Tiger | Panda | Lantern | Orb |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 8.956 | 8.964 | 8.960 | 8.966 | 8.960 | 8.958 | 8.975 | 8.969 | 8.965 | 0.000 | 3.751 | 15.577 |
| 2 | 7.987 | 7.965 | 7.972 | 7.975 | 7.972 | 7.983 | 7.984 | 7.964 | 7.979 | 8.888 | 3.757 | 15.573 |
| 3 | 7.981 | 7.978 | 7.978 | 7.972 | 7.976 | 7.977 | 7.978 | 7.975 | 7.981 | 8.873 | 3.756 | 15.576 |
| 4 | 7.984 | 7.971 | 7.976 | 7.975 | 7.979 | 7.977 | 7.984 | 7.982 | 7.977 | 8.876 | 3.751 | 15.567 |
| 5 | 7.977 | 7.977 | 7.976 | 7.975 | 7.979 | 7.975 | 7.968 | 7.979 | 7.974 | 8.887 | 3.752 | 15.581 |

**Free boards**

| Reel | 9 | 10 | J | Q | K | Chicken | Boat | Lotus | Tiger | Panda | Lantern | Orb |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 0 | 0 | 0 | 0 | 0 | 19.228 | 19.196 | 19.194 | 19.288 | 0.000 | 4.662 | 18.432 |
| 2 | 0 | 0 | 0 | 0 | 0 | 14.151 | 14.190 | 14.176 | 14.187 | 21.050 | 4.685 | 17.562 |
| 3 | 0 | 0 | 0 | 0 | 0 | 14.181 | 14.189 | 14.140 | 14.210 | 21.038 | 4.682 | 17.559 |
| 4 | 0 | 0 | 0 | 0 | 0 | 14.203 | 14.194 | 14.159 | 14.154 | 21.037 | 4.683 | 17.570 |
| 5 | 0 | 0 | 0 | 0 | 0 | 14.149 | 14.191 | 14.164 | 14.213 | 21.032 | 4.696 | 17.554 |

| Current credit paytable | 2 | 3 | 4 | 5 |
|---|---:|---:|---:|---:|
| 9, 10, J, Q, K, Chicken, Boat, Lotus | — | 10 | 25 | 100 |
| Tiger | 4 | 30 | 75 | 300 |

Chicken, Boat, and Lotus currently have the same paying power as any card rank. A visible middle pay tier would make their artwork and Free Spins role more meaningful. The proposed tiered values in section S were tested with accompanying changes so their contribution is included in the 92% analysis. [Symbol probabilities](src/game/probabilityConfig.ts) · [Credit paytable](src/game/config.ts)

## H. Panda Wilds and paylines

The implementation requests stacks of zero, one, two, or three cells on reels 2–5. Paid request weights are **84 / 5.7 / 5 / 5.3**, and free weights are **61 / 15 / 12 / 12**. The longest available adjacent run up to the requested size is used. Lanterns and Gold Orbs split possible runs. The realized Panda percentages above are lower than requested stack probabilities per reel. Across the full audit sample there were **zero Wilds on reel 1, zero disconnected two-Wild stacks, and zero reels with multiple Lanterns**.

Independent path inspection found **88 distinct five-reel paths**, one valid row per reel on each, with zero duplicate paths. The game and oracle agreed on active-line gating, fixed-credit conversion, simultaneous wins, and the longest eligible Tiger tiers. The existing tests explicitly covered substitutions, a two-cell Tiger/Wild payout, an inactive path excluded at 58 lines, and distinct overlapping line awards. The engine only substitutes Wilds in the line evaluator. Lanterns and Gold Orbs use separate counts and conditions.

Stacks and overlapping paths correlate results. Multiple paylines on the same stack can each pay, as designed. That raises payout dispersion and contributes to the observed **38.40%** multiple-win share among paid line hits. The simulator generates actual whole boards and runs each active path against them. Per-cell symbol percentages alone would understate this correlation if used to reconstruct a line-win model. [Stack placement and line evaluation](src/game/engine.ts#L108) · [Paylines](src/game/config.ts#L73) · [Line tests](src/game/engine.test.ts)

## I. Lantern Free Spins

| Visible Lanterns | Exact paid-board probability | Exact free-board probability | Award |
|---:|---:|---:|---:|
| 3 | 1.519156% | 2.638086% | 2× total wager |
| 4 | 0.177765% | 0.389730% | 5× total wager |
| 5 | 0.016192% | 0.045600% | 25× total wager |
| **3 or more** | **1.713113%** | **3.073416%** | Six Free Spins on entry, three more on a retrigger |

The audit independently enumerated all 32,768 original open-cell masks and applied the configured Lantern count distribution. The totals agreed with the engine. A paid entry occurs roughly once per 58 paid spins. Each free board adds an expected **0.09220** offspring spins, for **6.609** expected free boards per feature and **0.11323** free boards per paid spin. The audit observed **171,562 features**, **1,133,082 free boards**, **34,570 retriggers** (3.0510% per observed free board), and **6.605** boards per feature. The 25× paid tier adds about **0.405 pp** on its own due to its rarity.

| Free Spins payout metric | Default-wager sample |
|---|---:|
| Average | RM2.26, or 28.25× |
| Median | RM1.60, or 20× |
| Zero award | 0.76% |
| Below 1× the triggering wager | 1.23%, including zero |
| Above 5× | 88.38% |
| Above 10× | 74.73% |
| Highest observed | RM209.04, or 2,613× |

These feature totals include wins and Hold & Spin earned on free boards. They exclude the opening paid Scatter and any Hold & Spin initiated on the paid opening board, even when it plays after the free boards. Free Spins draw four paying symbols in a separate weighted reel generator and use the same active paths and credit paytable. Card ranks were **absent** from all sampled free boards. The concentrated pool and higher Wild request rate explain the high feature return and very low zero rate. A moderate cut to free Wild requests and Tiger weight achieves much more than cutting the 25× Scatter.

The browser and session tests validated automatic play, the locked wager, retriggers, the running feature balance, and automatic resumption after a queued Hold & Spin. A Hold & Spin originating on the opening paid board runs after free boards finish. A free-board Hold & Spin interrupts the feature and then returns to it automatically. [Free Spins math](src/game/lanternConfig.ts) · [Feature state](src/game/session.ts#L189) · [Automatic steps](src/ui/automaticRound.ts)

## J. Hold & Spin mathematical analysis

The initial orb count is binomial with **15** trials and **15.5722%** chance per cell. The distribution below is exact for paid boards and the original orb roll on free boards. The free extra orb can change counts below six.

| Initial orbs | Probability per board | Initial orbs | Probability per board |
|---:|---:|---:|---:|
| 0 | 7.89368% | 8 | 0.0680382% |
| 1 | 21.83918% | 9 | 0.00976054% |
| 2 | 28.19681% | 10 | 0.00108017% |
| 3 | 22.53656% | 11 | 0.00009056% |
| 4 | 12.47023% | 12 | 0.00000557% |
| 5 | 5.06014% | 13 | 2.370 × 10⁻⁹ |
| 6 | 1.55552% | 14 | 6.244 × 10⁻¹¹ |
| 7 | 0.368882% | 15 | 7.678 × 10⁻¹³ |

Values written in scientific notation in the last three rows are probabilities as fractions. The sum of counts six through fifteen is **2.003382%**.

At state `(h, r)`, with `h` held orbs and `r` respins remaining, the number of new orbs is binomial with `15 − h` trials and the rate shown below. If zero land, the next state is `(h, r − 1)`. On any hit the next state is `(h + k, 3)`, with all 15 held as an immediate terminal state. Because hits increase `h` and misses decrease `r`, a finite backward recurrence gives the exact ending histogram and expected turns. The audit independently computed the full histogram and matched the engine's expected-orb and full-grid moments.

| Held at respin start | Chance per empty cell | Chance of resetting with at least one landing |
|---:|---:|---:|
| 6 | 7.2% | 48.96% |
| 7 | 7.2% | 45.00% |
| 8 | 2.0% | 13.19% |
| 9 | 2.0% | 11.42% |
| 10 | 1.0% | 4.90% |
| 11 | 1.0% | 3.94% |
| 12 | 0.3% | 0.90% |
| 13 | 0.3% | 0.60% |
| 14 | 0.3% | 0.30% |

From six orbs on the first respin, the chances are **51.0425%** for zero, **35.6417%** for one, **11.0612%** for two, **2.0025%** for three, and **0.2521%** for four or more. Raising the early rates gives more action and resets. Raising the late rates has an outsized effect on the full-board tail. In the ten-million-spin sample, there were **1,251,602 respins**, with 900,561 misses, 275,991 single landings, 63,625 doubles, and 11,425 turns with at least three new orbs.

| Initial held | Share of exact Hold entries | Expected final orbs | Final count variance | Expected respins | Observed starts | Observed avg final |
|---:|---:|---:|---:|---:|---:|---:|
| 6 | 77.645% | 8.169 | 1.551 | 5.858 | 172,768 | 8.175 |
| 7 | 18.413% | 8.445 | 1.039 | 5.039 | 40,699 | 8.446 |
| 8 | 3.396% | 8.490 | 0.594 | 3.886 | 7,533 | 8.487 |
| 9 | 0.487% | 9.368 | 0.376 | 3.678 | 1,071 | 9.330 |
| 10 | 0.054% | 10.159 | 0.174 | 3.307 | 108 | 10.194 |
| 11 | 0.00452% | 11.118 | 0.114 | 3.230 | 10 | 11.100 |
| 12 | 0.00028% | 12.027 | 0.028 | 3.054 | 1 | 12.000 |
| 13 | <0.00002% | 13.018 | 0.018 | 3.035 | 0 | — |
| 14 | <0.00001% | 14.009 | 0.009 | 2.991 | 0 | — |
| 15 | <0.00001% | 15.000 | 0.000 | 0.000 | 0 | — |
| **All** | **100%** | **8.238** | **1.440** | **5.628** | **222,190** | **8.242** |

From exactly six, the exact chances of ending with **8+** orbs, **10+**, and **12+** are **76.1986%**, **13.8130%**, and **0.3502%**. Across all starts they are **78.4555%**, **14.2386%**, and **0.3613%**. A randomly triggered bonus fills all 15 with probability **3.659 × 10⁻⁸**, or about once per **27.3 million Hold & Spin features**. From six the chance of finishing with the same six orbs is **13.30%**.

At the default wager, an ordinary orb averages **14.584 sen**. The theoretical average complete Hold & Spin pays **RM2.195**, including about **RM1.199 in ordinary orbs** and **RM0.996 in jackpots**. The observed average was **RM2.159**. These payouts are generous in combination with a 2% entry rate. The number of orbs at the end remains a useful presentation trait. Cutting entry or respins sacrifices feature exposure while leaving strong line-payout drivers intact.

The production game uses `crypto.getRandomValues` for each draw. It commits one spin or respin result before its animation so a reload can replay that exact turn. Subsequent respins draw fresh values. The draw uses the current held count and configured rates, and the **8.17** emerges from repeating that process. A bonus can remain on six through all three turns, regardless of the player's previous results. Debug scenarios can force outcomes when explicitly enabled. [Live RNG and respins](src/game/engine.ts#L314) · [Exact Hold & Spin model](src/game/bonusConfig.ts) · [Probability configuration](src/game/probabilityConfig.ts)

## K. Hold & Spin animation and state

| Behaviour | Evidence |
|---|---|
| Six- and seven-orb starts, misses, hits, and full grid | Vitest passed on six, seven, jackpot, all-miss, and full-board scenarios. Engine coverage includes simultaneous multi-cell landings. The 10M sample recorded 75,050 respins adding two or more orbs. |
| Individual cells and landing cues | In Chromium the first respin from six showed independent empty-cell mini-reels with passing gold decoration while six actual orbs stayed held. Only the stored new orb locked. After refreshing during the respin, the board still reached seven and reset to three. The next misses reduced the counter to two and one, then settled. |
| Sequential collection | The browser showed a dragon leaving a held orb for the counter. `holdCollectionPrizes` walks stored cells in display row order, includes ordinary and special awards, and appends GRAND as the last prize. Cues are tied to lift and arrival. The counter accumulates integer sen. |
| Skip, Continue, and reload | At RM1 denomination, seven 2× orbs at an RM8 wager produced **RM112.00**. Skip showed RM112.00, and refresh restored the same completed presentation. One Continue returned to idle with **RM1,104.00** and one paid spin. Desktop Space and mobile-viewport controls worked. |
| Full-board GRAND presentation | The 14-orb test started a one-cell respin and filled the final slot. Full collection without Skip showed the separate GRAND pass and finished at **RM200,002.40** at the default wager. Refresh preserved exactly one GRAND award. |
| Hold & Spin inside Free Spins | Browser test played the first free board, entered a queued Hold & Spin with five remaining free spins, then resumed all five automatically. No Continue was displayed during the queued result. |

The mini-reel art is intentionally indicative, so a passing visual orb can suggest a win before the cell locks. An extra settling cue for misses, or quieter passing gold accents, would make the distinction clearer. The collection can be long on a full board at 1× animation speed. The current timings budget 0.615 seconds per ordinary orb and 1.52 seconds for the separate GRAND flight and count, plus rendering delays. Skip remains available throughout collection. The main stationarity and payout-display checks passed. [Cell rendering](src/ui/Reels.tsx) · [Animation and reveal scheduling](src/ui/useRoundAnimation.ts) · [Collection](src/ui/HoldCollection.tsx)

## L. Jackpot and multiplier audit

| Tier | Current prize | Exact chance of at least one per Hold & Spin | Exact expected awards per million paid cycles | Observed awards / winning cycles in 10M |
|---|---:|---:|---:|---:|
| MINI | 5,000 × denomination | 1.22885% | 275.59 | 2,789 / 2,773 |
| MINOR | 20,000 × denomination | 0.16464% | 36.745 | 367 / 367 |
| MAJOR | RM50,000 | 8.238 × 10⁻⁷ | 0.01837 | 0 / 0 |
| GRAND | RM200,000 | 3.659 × 10⁻⁸ | 0.000816 | 0 / 0 |

The table distinguishes awards from winning paid cycles because a cycle can include multiple orbs of the same tier. The exact per-Hold probabilities for the three orb-based tiers average `1 − (1 − p)ⁿ` over the ending board size `n`. Their expected counts use `n × p`, so the result counts every award. GRAND is the full-board event. This works because prize type draws are independent of occupancy and continuation. The current orb type weights are **99.82999% ordinary, 0.15% MINI, 0.02% MINOR, and 0.00001% MAJOR**. GRAND has no standalone orb type.

A ten-million-spin run expects about **0.184 MAJOR awards and 0.0082 GRAND awards**. Seeing neither is consistent with the model. The current GRAND happens about once per **1.36 billion reel boards**, or once per **1.23 billion paid cycles** when free boards are included. The default wager gives MAJOR and GRAND positive expected returns of **1.148 pp** and **0.204 pp**. The nominal RNG probabilities are continuous-model values and are subject to the engine's 32-bit threshold discretization.

| Ordinary multiplier | Configured probability | Observed eligible ordinary orbs in 10M |
|---:|---:|---:|
| 1× | 62.300% | 1,138,850 |
| 2× | 24.000% | 438,395 |
| 3× | 8.600% | 157,839 |
| 5× | 3.300% | 60,033 |
| 10× | 1.200% | 22,156 |
| 20× | 0.450% | 8,128 |
| 50× | 0.130% | 2,421 |
| 100× | 0.018% | 339 |
| 200× | 0.002% | 39 |

Special orb amounts are stored at landing. The evaluator sums ordinary stored payouts, adds matching special awards, and adds GRAND on top when the grid is full. The audit verified denomination pricing, award counts, the full-grid rule, and the distinct amounts in the presentation. [Jackpot amounts](src/game/config.ts#L21) · [Orb draws and settlement](src/game/engine.ts#L285)

## M. Bankroll and duplicate-payout protection

- **Ledger and units.** Wagers and prizes use integer sen. The starting balance defaults to RM1,000.00, and input accepts RM0.00 through RM1,000,000.00 with at most two decimals. The state machine deducts the initial wager once, locks the betting snapshot, and credits the complete result once. The main display temporarily withholds the settled standalone bonus award until the collection animation finishes. The observed ledger matched opening funds minus paid wagers plus total awards in the 60,000-cycle cross-check.
- **Persistence and recovery.** LocalStorage holds the current round, stored board, respin results, ledger, and statistics in one record. Spin, turn, and phase guards reject stale callbacks. Pure session tests cover rejected duplicate callbacks, staged reload, frozen historical paytables, saved orb prices, and repeated settlement attempts. Reset to initial bankroll was verified in an isolated browser session. It cleared the last win and statistics and retained the saved game settings.
- **Presentation separation.** The collection animation, Skip, and Continue update presentation or phase flags only. Refresh during a pending respin restored the same landing, and refresh after collection retained the same payout. Free Spins updates the feature counters and pays the aggregate to the ledger once.
- **Storage failure behaviour.** A failed write falls back to memory and shows a warning. An unreadable or unsupported payload falls back to a fresh session. A redundant validated backup and visible recovery state would improve data-loss resilience. Web Locks serialize the tested Chromium tab mutations. The code has no equivalent cross-tab serialization when Web Locks are unavailable.
- **Numeric boundary.** The validated supported wagers and current payouts are comfortably within JavaScript's safe-integer range. Stored fields are checked for safe integers, but indefinitely growing balance and statistics are added without a pre-commit aggregate boundary check. Treat this as a hardening concern for extreme saved totals. Invalid snapshot recovery matters sooner for normal use.

### Confirmed unintended wager across tabs

1. Open the same funded test session in two Chromium tabs and settle an ordinary 300-credit result at the 1¢ denomination. Both display **Continue**.
2. Press and hold the main button in tab B while it reads **Continue**. Dismiss the result in tab A. Tab B changes the same button to **Spin** after the shared save updates.
3. Release the pointer in tab B. The ledger moved from **one spin and 8 sen wagered** to **two spins and 16 sen wagered**, and the round entered `SPINNING`. The first payout was preserved.

The reused DOM control reads the current React action when the click fires on release. Locking the ledger serializes the second action but does not preserve what the player originally selected. Bind the gesture to its original action and observed round identity. Cancel an in-flight gesture if the mode changes, and require the commit to validate the intended phase and result ID. Give keyboard and touch tests the same coverage. Consider separate keyed controls when the role changes to prevent the browser from completing the gesture on the new action. [Main action](src/ui/App.tsx#L65) · [Reused button](src/ui/App.tsx#L194) · [Web Locks and sync](src/game/useSession.ts) · [Settlement](src/game/session.ts)

## N. Cabinet, controls, and accessibility

- **Visual hierarchy.** The imperial dragon framing, burgundy-and-gold reels, lit frame, and color-coded jackpot cards keep the presentation cohesive. The most important amounts remain legible at desktop and the tested mobile sizes. The two largest values stay strong focal points without blocking reels. Orb faces provide readable credit amounts at normal denominations and RM labels on the higher denominations.
- **Controls and rules.** Denomination, size, lines, total bet, and last win are grouped together. Paytable and Paylines open separate inspectable panels. The Tiger row correctly has four pay tiers, and the payline preview selected path 88 without changing which lines were active. At 1280 × 720 the desktop Denomination label broke mid-word in the inspected capture. A modestly wider control column or deliberate compact label would improve readability.
- **Credit clarity.** The selector says “Bet size” and its choices are numeric, while payline prizes are fixed credits. “Credits per line” on the selector would clarify why selecting a larger wager does not increase those awards. At a new selected denomination, “Last win” expresses the previous MYR award in the current denomination's credits. Label that conversion or preserve the winning denomination beside it.
- **Access.** Native modal dialogs, named controls, visible status, keyboard Space, and reduced-motion handling provide useful foundations. The colour and animated-line treatments should be checked with a screen reader, keyboard-only focus traversal, high zoom, and larger text. An explicit text summary of winning symbols, payline, match length, and credits would make the outcome easier to understand without visual overlays.

[Cabinet and controls](src/ui/App.tsx) · [Paytable and dialogs](src/ui/Panels.tsx) · [Cabinet styles](src/styles.css)

## O. Reel timing, effects, and audio

**Reel timing.** Each reel uses a CSS transform and easing curve with staggered stops. At speed 1 the configured delays span **710–1,330 ms**. The strip gives a quick acceleration/deceleration impression and the stopped cells bounce into place. The game observes animation completion and schedules a timeout fallback. It deduplicates each reel stop, queues genuine Lantern and orb cues, and scopes callbacks to the current round. Individual stops and the bonus lock impact were visible on desktop and mobile captures. The explicit anticipation treatment tracks likely Hold & Spin, based on revealed Gold Orbs. A separate unobtrusive two-Lantern cue would make the free feature as legible as the orb feature.

**Audio.** The game uses distinct generated loops for normal play, Free Spins, Hold & Spin, dragon collection, collection celebration, and GRAND. Track changes use a 0.55-second crossfade with a cap of one incoming and one outgoing track. A master gain, category gains, compressor, and ducking cover effects and music. The event mapping has specific reel stop, Lantern entry/retrigger/complete, orb, jackpot-tier, and dragon lift/arrival cues. The result fanfare starts after collection. In isolated desktop and mobile-viewport Chromium, the audit saw zero AudioContexts before a gesture and one running after it. The GRAND flow created four music sources across phases and 164 effect oscillators. The free flow created two music sources across entry and return. The Vitest suite covers routing, transitions, and event deduplication. Loudness, speaker quality, and iOS interruption/resume remain device-level checks.

The first render of a score mode synthesizes and caches PCM synchronously on the main thread. Headless callback timing shows occasional stalls but does not isolate their cause. Profile first entry into each bonus on a mobile device before moving synthesis off-thread or replacing it with pre-generated audio. Fixed inter-orb reveal gaps can extend a spin's presentation even when the user raises animation speed. Consider scaling the visual reveal rhythm separately from minimum audible cue separation. [Timing and cap](src/ui/useRoundAnimation.ts) · [Cue scheduling](src/ui/roundCues.ts) · [Music manager](src/ui/music.ts) · [Mixer](src/ui/audio.ts)

## P. Desktop, mobile, and responsiveness

Built app tested locally with **Chrome 158 headless on Windows** in fresh contexts. Mobile viewport sizes used touch-capable emulation. The matrix exercised initial bankroll, paytable, payline preview, reset dialog, denomination change, six-to-seven Hold & Spin, reload, Skip, and Continue. Separate checks exercised touch events and a portrait-to-landscape resize during collection.

| Emulated viewport | Reel cells in view | Horizontal overflow | Main button height | Smallest console control |
|---|---:|---|---:|---:|
| 1280 × 720 desktop | 15 | None | 70 px | 70 px |
| 375 × 667 portrait | 15 | None | 51 px | 46 px |
| 390 × 844 portrait | 15 | None | 58 px | 50 px |
| 430 × 932 portrait | 15 | None | 58 px | 50 px |
| 844 × 390 landscape | 15 | None | 44 px | 44 px |

The paytable had equal client and scroll widths at each viewport. Collection used the same centered counter, with the dragon path recalculated from measured element positions. The inspected phone-sized views kept all 15 cells visible and the landscape layout fit the controls beside the reels. Header icons and small caption text remain worth testing with real fingers and larger text settings. The page declares viewport fitting and uses CSS safe-area insets. Physical iPhone Safari, Android Chrome, and notch geometry were outside this browser run. [Viewport metadata](index.html) · [Responsive CSS](src/styles.css) · [Collection resize handling](src/ui/HoldCollection.tsx#L80)

## Q. Performance, code quality, and deployment

| Area | Evidence and assessment |
|---|---|
| Runtime cost | Uses transforms for most reel movement. Compact mode shortens strips and strips out several filters. Collection updates React on each animation frame and renders path effects, particles, and a counter in the same component. Profile mobile scrolling and collection with slow CPU and battery-saver settings. Keep layout measurement in the existing resize path and animate flight independently of changes to the displayed count if device profiles warrant it. |
| Measured callback intervals | During one desktop natural-completion GRAND test, 1,535 headless animation-frame callback intervals had a 6.7 ms 95th percentile and one interval above 25 ms. Five viewport smoke runs showed occasional long callback intervals during reel play. These are sampled host callback intervals under the audit workload. They do not measure sustained displayed FPS, mobile GPU load, or a memory plateau. |
| Resource cleanup | Viewport and gesture listeners, phase timer arrays, RAF loops, and ResizeObservers have explicit cleanup paths. Fading music sources disconnect on completion. The module retains one reusable AudioContext and cached mode buffers for the page lifetime. Heap growth, hidden-tab behaviour, and real-device audio recovery need longer profiles. |
| Bundle and assets | Vite output about **472 kB JS** (154.29 kB gzip), **32 kB CSS** (8.92 kB gzip), and a **1.88 MB** dragon backdrop PNG. The PNG represents about **72%** of the emitted asset bytes and is the largest immediate mobile-loading opportunity. Self-hosted fonts and the artwork loaded without failed requests in the preview. Audio is generated in JavaScript and has no external audio file URLs. |
| Architecture and tests | Pure typed config/engine/session layers make determinism and settlement testable. There are **103 passing tests across six files**. Legacy versions, special developer paths, and the runtime/simulation feature-loop duplication make some changes harder to review. Add single-source payout reporting and durable browser regression tests, including expected-intent guards. |
| Production deployment | Vite's base is `/dragon-fortune/`. The build passed and the generated JS/CSS and asset URLs loaded under that prefix in production preview. The workflow is configured for pushes to `main` and manual runs, with `npm ci`, a build job, official Pages upload/deploy actions, and `dist` as the artifact. The audit checked configuration and local payloads. GitHub-hosted execution and repository Pages settings were outside the run. Adding `npm test` before packaging would gate deploys on current checks. |

[Build configuration](vite.config.ts) · [Deployment workflow](.github/workflows/deploy.yml) · [Production scripts](package.json) · [Round timer cleanup](src/ui/useRoundAnimation.ts)

## R. Confirmed defects and prioritized findings

The tested payout paths settled correctly. The most serious functional fault observed is action intent changing between pointer press and release when another tab updates the shared result. The measured 154.35% RTP is a balance issue for the target and follows from the current rules.

| Severity | Issue and evidence | Source and root cause | Recommendation and expected benefit | Effort |
|---|---|---|---|---|
| High | Default expected RTP is **154.35%**. The reference matrix spans **57.12–154.35%**. | `config.ts`, `probabilityConfig.ts`, `session.ts:spinOutcome`. Fixed line credits combine with strong Wild effects, concentrated free reels, full-wager orbs, and fixed or denomination-only jackpots. | Validate proposal C for eight-line references and decide which wagers should share the target. Removes about 61.7 pp at default. | Medium |
| High | **Confirmed** unintended second paid spin when Continue changes to Spin during interaction across tabs. | `App.tsx:spin` and the reused spin button. A click at release can read a changed handler after shared-state synchronization. | Lock intent to the pressed action and expected phase/round ID. Add a two-tab browser regression. Prevents an unintended wager. | Medium |
| Medium | Session updates rely on Web Locks for serialization. Cross-tab protection is weaker where they are unavailable. | `useSession.ts:commit` and storage events. Direct fallback has no atomic cross-tab read/modify/write protocol. | Add a supported transactional persistence path or enforce a single active writer and show status on other tabs. | Medium |
| Medium | Corrupted or unrecognized saves can appear as a fresh bankroll. Storage failure leaves progress in memory. | `storage.ts:parseSession/loadSession`, `useSession.ts:commit`. Single active snapshot and fallback. | Retain an independently validated backup and a visible recovery state. Test disabled storage, quota failures, and migration recovery. | Medium |
| Medium | Simulator's headline cannot explain separate free Scatters and four jackpots. Very rare tiers can disappear from raw samples. | `simulation.ts:components`, `scripts/simulate.ts`. Aggregation and sample-derived regular payout terms. | Publish nine-category RTP, exact rare rates, confidence intervals, and seed/config labels. Cross-check against session code in CI. | Medium |
| Medium | 1.88 MB backdrop and unprofiled first-use audio/collection cost. | `src/assets/dragons.png`, `music.ts:bufferFor`, `HoldCollection.tsx`. Full-size image and synchronous synthesis/per-frame rendering. | Make appropriately sized WebP/AVIF variants and profile real devices before changing audio or RAF. Faster initial asset transfer and evidence for targeting stalls. | Medium |
| Low | Denomination wraps mid-word at 1280 px. “Bet size” and historical win credits can be misread. | `App.tsx`, `Panels.tsx`, `styles.css:.meter`. Narrow grid columns and generic units. | Resize or shorten the label, name credits per line, and label the basis of the last-win conversion. | Low |
| Low | Browser and accessibility matrix missing from automated release checks. | `.github/workflows/deploy.yml`, current Vitest suite. Unit tests pass and deployment builds only. | Add a production browser smoke gate and physical mobile checks for audio and accessibility. | Medium |

## S. Recommended mathematical plan

**Use proposal C for the two eight-line reference wagers.** The two-million-spin validation used a different seed from the first calibration pass. It estimates **92.69% ±0.22 pp** at 1¢ and **91.47% ±0.22 pp** at 10¢, both with bet size 1 and eight lines. The observed default raw RTP for the validation run was **93.02%**. All figures below describe an isolated candidate.

| Lever | Proposed configuration | Rationale |
|---|---|---|
| Paid paying-symbol distribution | Keep all nine equally weighted within the paying-symbol draw on each reel. | Retains the current symbol variety and equal rank/animal draw rates. |
| Credit awards | Card ranks **5 / 14 / 55** for 3/4/5. Chicken, Boat, Lotus **8 / 20 / 80**. Tiger **3 / 22 / 55 / 200** for 2/3/4/5. | Keeps the distinctive two-Tiger win and gives the picture symbols a meaningful middle tier. |
| Panda stacks | Paid zero/one/two/three request weights **87 / 4.7 / 4 / 4.3**. Free weights **80 / 8 / 6 / 6**. Reels 2–5 only. | Lowers the requested stack rate from 16% to 13% paid and 39% to 20% free. All stack sizes remain possible. |
| Free Spins symbols | Chicken, Boat, Lotus, Tiger weighted **1 / 1 / 1 / 0.8**. Card ranks remain outside the feature pool. | Tiger takes about **21.05%** of regular free draws instead of 25%. The other three each take about 26.32%. |
| Lanterns | Keep weights 4 paid and 5 free, equal tier adjustments, and 2× / 5× / 25× prizes. | Entry stays **1.71311%**, and free retriggers stay **3.07342%** per free board. Players keep their feature access and Scatter award schedule. |
| Hold & Spin entry | Keep base orb weight **16.6 against 90**, entry at **2.00338%**, and current extra free-orb rule. | Preserves bonus availability and the upstream balance between empty cells, Scatter, and lines. |
| Respin landings | Retain **7.2% / 2% / 1% / 0.3%** per empty cell for initial held ranges 6–7 / 8–9 / 10–11 / 12–14. | Bonus filling remains driven entirely by independent rolls. The price changes address the budget without altering this occupancy process. |
| Jackpot type weights | **99.86799% ordinary / 0.12% MINI / 0.012% MINOR / 0.00001% MAJOR**. GRAND follows the existing full-board rule. | Reduces disproportionate MINI and MINOR return at small wagers. All four prize amounts stay the same. |

### Proposed ordinary multiplier distribution

The shares are probabilities conditional on an ordinary orb. They keep the full 1×–200× range. The proposed mixture uses 52% of the installed distribution and 48% of the conservative distribution tested in proposal A. Its mean is **1.49852×**, down from **1.823×**. The preliminary candidate with the full original multiplier distribution estimated **98.54%** at the default and **97.32%** at 10¢. Once the line, Wild, and jackpot settings fixed their share of the return, the ordinary multiplier mean supplied the remaining adjustment. The tuner targeted both eight-line references inside the intended range. The two-million-spin validation used the finished distribution below.

| Multiplier | Proposed weight in percent |
|---:|---:|
| 1× | 75.596 |
| 2× | 16.32 |
| 3× | 5.192 |
| 5× | 1.884 |
| 10× | 0.672 |
| 20× | 0.2532 |
| 50× | 0.07144 |
| 100× | 0.01008 |
| 200× | 0.00128 |

### Expected impact at the default wager

The line changes are reported jointly because paytable, Wilds, and Tiger frequency interact. The ordinary orb change includes the slight rise in ordinary type probability when MINI and MINOR are reduced.

| Payout source | Current RTP pp | Proposal C pp | Change pp |
|---|---:|---:|---:|
| Paid lines | 46.401 | 25.034 | −21.367 |
| Paid Scatter | 4.332 | 4.332 | 0 |
| Free lines | 41.469 | 14.239 | −27.230 |
| Free Scatter | 0.947 | 0.947 | 0 |
| Ordinary orbs | 33.436 | 27.495 | −5.941 |
| MINI | 17.224 | 13.779 | −3.445 |
| MINOR | 9.186 | 5.512 | −3.674 |
| MAJOR | 1.148 | 1.148 | 0 |
| GRAND | 0.204 | 0.204 | 0 |
| **Total** | **154.347** | **92.690** | **−61.657** |

The payline hit rate falls by about **1.75 percentage points**, while the profitable paid-cycle rate falls from **16.95%** to **9.24%**. A common small win may recover only part of the wager. The bonus still averages **RM1.73**, about **21.6× the default wager**, compared with RM2.20 now. Each tier retains its own prize and the GRAND tail remains. This is consistent with a medium-high-volatility design for regular play, with a very rare extreme tail. Assess that player feel explicitly before rollout.

## T. Alternative balancing scenarios

Candidate A lowers ordinary multiplier weights alone, using **90 / 8 / 1.5 / 0.35 / 0.10 / 0.04 / 0.008 / 0.0015 / 0.0005** across the current nine tiers. It preserves 1× through 200×, with a mean of **1.147×**. The isolated 250,000-spin run verified the shape and a 17.45% base line-hit rate. The table uses the exact modeled orb reduction with the better-sampled unchanged baseline lines. Ordinary orb return falls from **33.44 to 21.04 pp**. Even the mathematical all-1× limiting case leaves total RTP around **139.25%**.

Candidate B reduces base orb weight from 16.6 to **13.5** and the 6–7-held respin rate from 7.2% to **5.5%**, with the remaining tiers unchanged. It reduces Hold & Spin entry to **0.85860%**. From six held, the chance of any first-respin landing falls from **48.96% to 39.90%**, and the chance of multiple landings falls from **13.32% to 8.42%**. The exact all-start ending mean falls to **7.904** as a result of those rates. With fewer blocked cells, paid Lantern entry rises to **1.853%** and free retriggers to **3.315%**. The 700,000-spin run measured the resulting effect on lines and found the reduction insufficient. It makes Hold & Spin less frequent but leaves the average individual prize relatively high.

| Default-wager configuration | Estimated RTP | Paid line-hit rate | Free lines + Scatter RTP | All Hold & Spin RTP | Avg final orbs, all starts | Avg complete Hold payout | Hold entry / paid Lantern entry |
|---|---:|---:|---:|---:|---:|---:|---:|
| Current, 10M | 154.35% | 17.49% | 42.42 pp | 61.20 pp | 8.238 | RM2.20 | 2.003% / 1.713% |
| A. Orb multipliers only | 141.95% | 17.49% | 42.42 pp | 48.80 pp | 8.238 | RM1.75 | 2.003% / 1.713% |
| B. Hold entry and respins | 131.93% | 18.56% | 50.95 pp | 25.37 pp | 7.904 | RM2.10 | 0.859% / 1.853% |
| **C. Balanced adjustment** | **92.69%** | **15.75%** | **15.19 pp** | **48.14 pp** | **8.238** | **RM1.73** | **2.003% / 1.713%** |

- **A** preserves both bonuses and leaves line wins frequent. It reduces orb variety in practice because 90% of ordinary orbs are 1×, and the high-return line rules still dominate. The tail remains high because jackpot odds are unchanged.
- **B** produces more ordinary line hits and more Lantern features while Hold & Spin appears less than half as often. Its ordinary and feature volatility shifts away from orbs. The measured payout standard deviation excluding MAJOR and GRAND was about **13.0× the wager**, versus **19.5×** in the current 10M run.
- **C** retains both bonus frequencies, stacked pandas, and large prizes. Its measured payout standard deviation excluding MAJOR and GRAND was about **16.3× the wager**, with the extreme tail still theoretically present. It meets the two low-stake references with the least damage to bonus access of the three tested approaches. The stake-scaling gap remains a separate design problem.

## U. Improvement roadmap

1. **Address action intent first.** Bind Continue, Respin, and Spin to the gesture's original phase. Re-run rapid input, two-tab, touch, and refresh cases and require one explicit paid-spin gesture per wager.
2. **Decide the target's wager scope.** Use the two size-1 eight-line references for proposal C. If 91–93% should apply across the visible menu, model a published stake/payout redesign first. Treat line and jackpot scaling explicitly.
3. **Approve and validate the balanced rules in an isolated branch.** Keep entry and respin logic unconditional. Add nine-category accounting and publish a range of stake-specific estimates with sampling uncertainty. Check that the versioned save path continues old rounds with their original prices and odds.
4. **Add durability and release gates.** Build browser regression coverage into CI, test unavailable storage and inter-tab writer ownership, and verify both a fresh and restored snapshot on a second browser engine.
5. **Polish the presentation.** Fix the broken desktop label, clarify credits per line and last-win units, optimize the backdrop, and profile first bonus entry, collection, and audio recovery on real phones before choosing changes to runtime effects.

## V. Validation limits and reproducibility

- **Source and scope.** This report reflects the current local working tree, including the credit paytable update. Candidate calculations were executed in temporary copies. No production rules were changed, no deployment ran, and browser tests used fresh local profiles and virtual ledgers.
- **Reproduction.** The existing one-million headline reproduces from `npm.cmd run simulate -- 1000000 1 1 8 2026`. The audit collector used production `generateBoard`, `evaluateLines`, `evaluateScatter`, `startingOrbs`, `respin`, and `settleBonus` in the same call order as the current CLI. It used seed **2026** for the ten-million run and A/B diagnostics, **91373** for the independent current matrix, and **48739** for the final two-million C run. Raw totals in section E can be cross-checked with the same CLI count and seed. The audit's separate category splits and controlled estimate require the extra aggregation described in sections D and F.
- **Theoretical and sample limits.** Hold & Spin and Scatter results use exact finite-distribution calculations under the configured probabilities. Payline expectations and distribution metrics use simulation. Intervals reflect line sampling uncertainty and do not quantify RNG implementation drift or browser/UI behaviour. The seeded harness uses the game's deterministic simulation generator. Live play uses Web Crypto.
- **Functional limits.** The 103 automated tests, 60,000 oracle boards, 60,000 session/CLI cycles, and isolated Chromium browser scenarios cover the cases listed. Manual listening, physical mobile browsers, accessibility tools, long-run heap and GPU testing, and hosted Pages deployment were outside the run. The volatility rating weighs observed common returns and modeled rare prizes. Real-device playtesting is still needed for how the new cadence feels.

## Summary scorecard

These scores describe the current game before implementing the proposed changes.

| Category | Score | Reason |
|---|---:|---|
| Mathematical correctness | 9/10 | Independent payline, Scatter, Hold, and ledger checks agreed with the implementation. |
| RTP balance | 3/10 | Default is roughly 62 points above target, while larger wagers fall well below it. |
| Paytable design | 6/10 | Tiger adds character and early hits. Rank and picture symbols outside Tiger share all payouts. |
| Base-game experience | 7/10 | Stacks and multiple paths create distinct wins. Wager and award scaling are difficult to infer. |
| Free Spins | 7/10 | Automatic retriggers and bonus chaining pass. The current four-symbol and Wild setup concentrates a large share of return. |
| Hold & Spin | 8/10 | The random feature is active, visually clear, and stable across tested reloads. The payout mix has room to improve. |
| Jackpot system | 7/10 | Clear tiers and distinct full-grid award. Small wagers carry a disproportionately large denomination-only jackpot contribution. |
| Animation quality | 8/10 | Individual cell spins, dragon flight, and Skip work. Long collections and passing flashes can be clarified. |
| Audio quality | 7/10 provisional | Gesture unlock and routing are supported by tests. Music and effects need a real-device listening pass. |
| UI/UX | 7/10 | Clear cabinet and useful panels. The two-tab action fault and label/credit clarity can affect play. |
| Mobile compatibility | 8/10 provisional | Portrait, landscape, screen resize, and touch emulation passed in Chromium. Physical browser coverage is pending. |
| Performance | 7/10 provisional | Compact effects and cleanup are in place. Large artwork and synchronous audio generation merit device profiles. |
| Code quality | 8/10 | Good separation and test coverage. Simulation loop parity and storage recovery could be easier to maintain. |
| Overall game quality | 7/10 | Playable and distinctive, with mathematical balance and gesture safety the highest priorities. |

## Final answers

1. **Is 154.12% accurate?** Yes as the original one-million-spin hybrid estimate. The original CLI reproduced it at the default wager.
2. **What is the best estimate?** **154.35%** at the default wager, with an approximate **154.13–154.56%** sampling interval after modeling bonuses.
3. **What contributes the most?** Hold & Spin as a group at **61.20 pp**, and regular paid paylines as an individual category at **46.40 pp**.
4. **What are the five biggest mathematical problems?** High line credits with stacked Wilds, concentrated free reels and high Wild requests, full-wager orb generosity, relatively costly MINI/MINOR odds at small wagers, and incompatible scaling across stake settings.
5. **What are the five biggest functional or technical problems?** The confirmed cross-tab Continue/Spin gesture fault, weaker cross-tab persistence without Web Locks, limited backup/recovery for lost saves, insufficient reporting for rare jackpots and separate payouts, and a large backdrop plus device-level profiling gaps.
6. **Is Hold & Spin properly random?** Normal production respins use fresh independent secure random draws per empty cell at configured occupancy-based rates. Debug scenarios deliberately exercise fixed cases.
7. **Is 8.17 genuine?** Yes. **8.1693** is the exact mean from six, and **8.1754** was measured in 172,768 natural six-orb starts.
8. **Can the game approach 92%?** The tested balanced proposal reaches **92.69%** and **91.47%** at the two eight-line references. A common target across all six representative wagers needs a different wager-scale design.
9. **Which changes have the greatest impact?** The coordinated line credit, Panda stack, and Free Spins changes remove approximately **48.6 pp** combined. The revised orb and MINI/MINOR mix removes about **13.1 pp** more.
10. **What should improve first?** Correct the unintended paid-spin gesture, then decide the wager target scope before applying a mathematical change.
