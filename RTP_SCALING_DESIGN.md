# Dragon Fortune wager scaling design

## Recommendation

Adopt **Design B, a published ordinary-orb distribution indexed by total credits wagered**, combined with line awards that scale with bet size. It produces **91.2709–92.6926% theoretical RTP across all 200 presets**, including **92.6164% at RM0.08** and **92.4616% at RM880**. The ordinary-orb distribution varies with the wagered credits. The same credits receive the same mix at every denomination. The four jackpot amounts, Proposal C jackpot odds, genuine Hold & Spin landings, and feature entry rates are common to all presets.

Changing line payouts to scale with bet size is necessary for this design. On its own it raises Proposal C's RM880 example from **41.0799% to 72.8990%**. Higher wagers still get a much smaller share of expected return from the jackpots. All four models in this report keep the stated prize amounts and reach the target across the full matrix by allocating the remaining return differently.

The scope is the current eight denominations, five bet sizes, and five line presets. Every model uses the isolated audit Proposal C's line award hierarchy, Panda stack settings, and Free Spins symbol pool. All four retain the cabinet, controls, graphics, sounds, and in-feature timing. Any wager-dependent rule or global odds change would be published in the existing Paytable or Help, along with the applicable values. No game changes are part of this proposal.

## Why the gap exists

Let **d** be the denomination in sen, **b** the credits per line, **l** the selected active lines, **c = b × l** the total credits, and **W = d × c** the paid wager in sen.

The current credit evaluator prices each award at **listed credits × d**. Buying additional credits per line increases **W**, and the payout for the same line result stays fixed. Using **listed credits × b × d** for both paid and free lines removes the inverse-bet-size effect from line RTP. The paid and free games both use the saved triggering wager in the model.

If **L(l)** is expected line RTP at bet size 1, the current contribution is **L(l) ÷ b**. With bet-size scaling it is **L(l)**. Additional active lines buy additional paths, so the expected prize sums increase with line count. The paths have different row patterns and share cells and stacks. The average value per active line therefore varies slightly, and the win events remain correlated.

| Active lines | Proposal C paid lines after scaling | Free lines after scaling | Combined line RTP |
|---:|---:|---:|---:|
| 8 | 24.9980% | 14.2470% | 39.2450% |
| 18 | 25.2962% | 14.3972% | 39.6934% |
| 38 | 24.9566% | 14.2246% | 39.1813% |
| 58 | 25.3083% | 14.3957% | 39.7040% |
| 88 | 25.3522% | 14.4216% | 39.7738% |

The entire active-line difference is about **0.59 percentage point** after bet-size scaling. A separate line normalization multiplier is unnecessary for Design B.

At constant odds, MINI and MINOR return is proportional to **1 ÷ c**, because their prize amounts scale with denomination only. MAJOR and GRAND return is proportional to **1 ÷ W**, because their prize amounts are fixed. Ordinary orbs and Lantern Scatters already pay multiples of total bet, so each contributes a constant share when the board odds and multiplier distribution are fixed.

At 1¢ and eight lines with Proposal C jackpot odds, the jackpots contribute **20.6434 pp** at size 1 and **2.0643 pp** at size 10. Scaling the line table makes line RTP identical for those two wagers, leaving an **18.58 pp** gap from the jackpots alone. At RM880 the four jackpots together add **0.3509 pp**. With the production odds and paytable, merely multiplying by bet size produces **126.66–154.08%** across the matrix. With audit Proposal C it produces **72.36–92.66%**. An unchanged jackpot schedule, common orb mix, and simple bet-size line scaling cannot fit both ends of the target band. The jackpot amounts themselves are compatible with 91–93%, as the four alternatives show. [Wager definitions](src/game/config.ts) · [Current payout path](src/game/session.ts#L127) · [Original audit](DRAGON_FORTUNE_FULL_AUDIT.md)

## Model and validation

**Shared gameplay assumptions.** Proposal C retains natural **2.003382% Hold & Spin entry per reel board**, occupancy-based independent respins at **7.2% / 2% / 1% / 0.3%** for 6–7 / 8–9 / 10–11 / 12–14 held, and GRAND for every naturally full grid. Qualifying boards may finish with their starting orbs. The modeled **8.238** mean final count across all entries emerges from the configured rolls. Every design retains **six automatic Lantern Free Spins**, the three-spin retrigger, no card ranks on new free boards, and Panda stacks on reels 2–5. Proposal C requests Wild stacks at **13% paid and 20% free** on eligible reels. Lantern Scatter remains **2× / 5× / 25×**, with **1.713113%** paid entry and **3.073416%** free-board retrigger.

**Expected return.** One paid spin includes all descendant free boards and Hold & Spin prizes. There are **0.11322658** expected free boards per paid spin. Let **N = 0.183724995150177** be expected awarded orb positions per paid spin across all Hold features, **G = 8.15999946297 × 10⁻¹⁰** be expected GRAND awards per paid spin, **S = 0.0527906569833014** be paid and free Scatter return, and **μ** be the conditional mean ordinary multiplier. For the three special orb probabilities **pⱼ**, with prizes **Jⱼ** in sen:

```text
RTP fraction = paid line return + free line return + S
             + N × (1 − Σpⱼ) × μ
             + N × Σ(pⱼ × Jⱼ / W)
             + G × 20,000,000 / W
```

The jackpot prices are **5,000d sen for MINI**, **20,000d sen for MINOR**, **5,000,000 sen for MAJOR**, and **20,000,000 sen for GRAND**. MINI, MINOR, and MAJOR each replace an ordinary orb prize. GRAND adds to the existing orb prizes. The factor **N** counts the expected number of orb positions and therefore handles multiple special orbs on the same board. The **G** term includes both paid and free boards.

**Exact line computation.** For each active path, a finite enumeration accumulates the probability of consecutive matches from reel 1. It includes the original orb masks, capped Lantern count and placement, adjacent Wild stack requests and fitting, and paying-symbol weights. In free mode it accounts for the extra-orb rule. If a matched prefix needs **m** regular cells out of **T** eligible regular cells and the original board allows the optional extra orb, it survives that replacement with probability **1 − 0.35 × m ÷ T**. The difference between successive prefix probabilities gives the frequency of each exact match length. Multiplying each frequency by its award and summing across paths gives the expected line contribution, including overlapping wins. The enumeration considers each path's expectation, so no independence between paylines is assumed.

The totals are theoretical values under the configured nominal probabilities. The implementation's 32-bit RNG word introduces negligible threshold discretization for the target band. The earlier audit's **154.35%** was a finite-sample hybrid estimate. Computing the paid and free line means by enumeration gives **154.0782%** for the installed rules at the default wager and **92.6626%** for unscaled audit Proposal C. The equivalent theoretical RM880 results closely match the earlier simulation. The calculations and browser checks ran in isolated temporary copies or fresh profiles. [Board generation and path evaluation](src/game/engine.ts) · [Hold recurrence](src/game/bonusConfig.ts)

As a separate check on the enumeration, an independent seeded generator sampled **five million installed paid boards and five million installed free boards** at eight lines. The paid mean was **3.715337 credits per board** against **3.713024** enumerated. The free mean was **29.093788 credits** against **29.100949** enumerated. They differed by **0.33 and 0.23 standard errors**, respectively. Free boards were sampled directly for this validation to get a precise check on the conditional mean.

## Four feasible scaling designs

The letters in this report are independent of **audit Proposal C**, which is the common starting point. All designs use the same gameplay odds and award hierarchy described above. The only levers here are line award scaling, special orb type weights, and the distribution of the nine ordinary multipliers.

| Design | Balancing lever | Full-grid min–max RTP | Presets in 91–93% | Main cost |
|---|---|---:|---:|---|
| A. Published per-wager jackpot odds | Size-scaled lines and wager-indexed MINI/MINOR/MAJOR probabilities | **92.0000–92.0000%** | 200 / 200 | High wagers show substantially more special jackpot orbs. |
| **B. Published ordinary-orb mix by credits** | Size-scaled lines and one ordinary mix per total-credit entry | **91.2709–92.6926%** | **200 / 200** | Larger credit totals produce larger ordinary multipliers more often. |
| C. Published wager paytable factor | Size-scaled lines with a visible fixed extra award factor per preset | **91.5307–92.2659%** | 200 / 200 | The same symbol match has an additional wager-dependent payout factor. |
| D. Universal adjustments | Size-scaled lines, globally rarer jackpots, and one common ordinary mix | **91.1321–92.8671%** | 200 / 200 | MINI/MINOR become 16× rarer and MAJOR 4× rarer than in audit Proposal C. |

### A. Published per-wager jackpot odds

Keep the audit Proposal C ordinary mix at **μ = 1.49852×** and leave the GRAND occurrence rule alone. After pricing all held positions as ordinary, the remaining return budget is **K = 0.92 − L(l) − S − Nμ − G × 20,000,000 ÷ W**. Allocate **50% of K to MINI**, **40% to MINOR**, and **10% to MAJOR**. For each special tier use **pⱼ = shareⱼ × K ÷ [N × (Jⱼ ÷ W − μ)]**. The subtraction inside the denominator accounts for the ordinary orb the special award replaces.

All probabilities are positive and the ordinary type still has at least **84.9852%** probability per awarded orb across the matrix. The per-orb odds range from **0.08616% to 12.63085% for MINI**, **0.01720% to 1.99121% for MINOR**, and **0.00001719% to 0.39270% for MAJOR**. For the maximum RM1,760 wager this yields approximately **one MINI award per 43 paid spins** in expectation, counting multiple awards separately. GRAND remains equally rare per board at every wager. Publish the current three probabilities, the formula, and the difference between per-orb odds and per-spin frequency. This option provides a uniform headline return while materially changing jackpot prominence with stake.

### B. Published ordinary-orb mix by total credits

Use Proposal C's **0.12% MINI, 0.012% MINOR, and 0.00001% MAJOR** per awarded orb. These probabilities are common to every wager. They are the audit proposal values. In the currently installed game MINI and MINOR are **0.15% and 0.02%**. The solution budgets those proposed global reductions explicitly and keeps MAJOR and the natural GRAND event as they are in production.

Halfway between the fixed-jackpot RTP at the lowest and highest denominations for a given credit total, the inverse-denomination factor is **a = (1 + 1/200) ÷ 2 = 0.5025**. The fixed MYR tiers contribute **F = 5,000,000 × N × pMAJOR + 20,000,000 × G = 0.1081824965 sen** per paid spin before dividing by the wager. Pick **Lref = 0.393** as a common line anchor. It centers the range when the actual line rates and fixed-jackpot effects are restored. Then the target conditional ordinary multiplier for **c** credits is:

```text
μ(c) = [0.92 − 0.393 − S − (N × (5,000 × pMINI + 20,000 × pMINOR) + 0.5025 × F) / c]
       / [N × (1 − pMINI − pMINOR − pMAJOR)]
```

Use two published distributions over the current multipliers. Let **h = round(10,000 × (μ(c) − 1.147) ÷ (2.634 − 1.147))**. Each ordinary multiplier's probability is **(1 − h/10,000) × low weight + (h/10,000) × high weight**. This can be implemented as one weighted draw. The equation fixes the mean, while the two ends preserve nonzero odds for every multiplier. Rounding to basis points is included in the results.

| Multiplier | Low mix, % | High mix, % |
|---:|---:|---:|
| 1× | 90 | 40.7 |
| 2× | 8 | 25 |
| 3× | 1.5 | 16 |
| 5× | 0.35 | 14 |
| 10× | 0.10 | 3.7 |
| 20× | 0.04 | 0.45 |
| 50× | 0.008 | 0.13 |
| 100× | 0.0015 | 0.018 |
| 200× | 0.0005 | 0.002 |
| **Mean** | **1.147×** | **2.634×** |

The actual preset mixtures range from **1.4960× to 2.5747×**. At 8 credits the high-mix share is 23.47%. At 440 credits, including RM880, it is 95.34%. At 880 credits it is 96.01%. The full 25-entry schedule is appended below. Every denomination uses that same schedule. The playable UI can preserve its present layout and show the active per-multiplier weights in the current wager's Paytable. Higher wagers recover the lost jackpot share in ordinary orb prizes while keeping the same line probabilities, jackpot frequency, and bonus pacing. The absolute jackpots still have more relative impact at low wagers.

### C. Published wager paytable factor

Keep both the Proposal C ordinary mix at **1.49852×** and the global Proposal C jackpot odds. Use the base paytable times bet size, then a published extra factor **k/10,000** per preset. Each winning line pays **floor((listed credits × d × b × k + 5,000) ÷ 10,000)** sen. This is deterministic, half-up rounding per winning line. Compute return from exact frequencies of each symbol and match length and choose the closest achievable **k** to 92%, breaking ties toward the lower factor. The integer factors range from **9,749 to 15,018**. The full table includes them. The largest residual is **0.4693 pp** at 1¢ × 2 × 8 due to whole-sen payout steps.

For example, at **RM880** the extra factor is **1.4802**. Paid and free line contribution rises to about **58.87 pp**, versus **39.77 pp** under size scaling alone. The feature pays less of the expected return than Design B, and line wins are relatively more valuable at high wagers. The existing Paytable would need to show the actual rounded amounts for the selected preset. This is a viable choice if stronger high-wager line payouts matter more than having one intuitive line formula.

### D. Universal adjustments with fixed rules at every wager

Use size-scaled lines and a common ordinary mix at **2.5391294×**. It is the low/high mixture defined in B, with **h = 9,362** at every wager. Set MINI to **0.0075%**, MINOR to **0.00075%**, and MAJOR to **0.0000025%** per awarded orb. Keep GRAND's natural odds. The reductions shrink the jackpot share enough that the remaining spread fits within 2 percentage points. The common ordinary mix then centers the full range.

For each wager, compute the subtotal of size-scaled lines and all jackpots, excluding ordinary orbs and Scatter. The minimum is **39.20672%** and the maximum **40.94172%**. Set the common ordinary return to **92% − S − midpoint** and round the mixture to basis points as in Design B. This keeps all prizes accessible and all odds common, but MINI frequency drops from about **one award per 4,536 to one per 72,572 paid spins** compared with B. MINOR drops from about one per 45,358 to one per 725,722. This design prioritizes a uniform published rulebook and moves most jackpot return into ordinary Hold & Spin prizes.

### Other transparent alternatives

- **Explicit eligibility tiers.** A higher-wager jackpot can be reserved for published credit bands, or the same prize can have published odds bands. Restricting eligibility would remove a live tier at some presets and introduce jumps at band boundaries. All four modeled designs keep every tier accessible at every preset. A banded quote for B is already possible with 25 distinct credit totals, with the expected distribution shown before a wager.
- **Revised prize structure.** If prize amounts could scale with total wager, setting each tier to a constant multiple of **W** would remove the inverse-wager terms. A fixed guaranteed floor on those prizes would reintroduce the stake effect wherever it applies. This would change the stated prizes and is outside the four designs. Keeping amounts fixed is feasible with either a disclosed allocation of return or globally reduced fixed odds, as above.
- **Keep installed MINI/MINOR odds.** Those odds would add approximately **7.12 pp** at the smallest wager compared with Design B's adopted Proposal C odds. The same ordinary-mix method could absorb the increase by moving the smallest-wager mean to about **1.11×**, below B's published low endpoint. That requires a new low distribution with much less everyday orb variety. Design B deliberately uses the previously proposed global odds and publishes the change.

## Reference wagers and rare tiers

The full matrix below uses percentages. The headline sensitivities are visible in the original reference settings.

| Denom × size × lines | Wager | Installed | Audit Proposal C | Audit C × bet size | A | B | C | D |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 1¢ × 1 × 8 | RM0.08 | 154.078 | 92.663 | 92.663 | 92.000 | 92.616 | 91.954 | 92.867 |
| 10¢ × 1 × 8 | RM0.80 | 152.861 | 91.446 | 91.446 | 92.000 | 91.399 | 92.001 | 92.425 |
| 20¢ × 1 × 18 | RM3.60 | 139.480 | 81.072 | 81.072 | 92.000 | 92.122 | 92.050 | 92.166 |
| 50¢ × 2 × 38 | RM38.00 | 85.194 | 54.398 | 73.989 | 92.000 | 91.814 | 92.000 | 91.235 |
| RM1 × 3 × 58 | RM174.00 | 69.596 | 46.897 | 73.366 | 92.000 | 92.375 | 92.001 | 91.685 |
| RM2 × 5 × 88 | RM880.00 | 57.037 | 41.080 | 72.899 | 92.000 | 92.462 | 91.999 | 91.721 |
| RM2 × 10 × 88 | RM1,760.00 | 47.876 | 36.927 | 72.724 | 92.000 | 92.469 | 91.998 | 91.710 |

| Design and wager | Ordinary orb RTP pp | MINI pp | MINOR pp | MAJOR pp | GRAND pp |
|---|---:|---:|---:|---:|---:|
| A at RM0.08 | 27.5031 | 9.8939 | 7.9009 | 1.9741 | 0.2040 |
| B at RM0.08 | 27.4490 | 13.7794 | 5.5117 | 1.1483 | 0.2040 |
| C at RM0.08 | 27.4952 | 13.7794 | 5.5117 | 1.1483 | 0.2040 |
| D at RM0.08 | 46.6463 | 0.8612 | 0.3445 | 0.2871 | 0.2040 |
| A at RM880 | 25.7396 | 11.1824 | 8.0310 | 1.9942 | 0.000019 |
| B at RM880 | 47.0579 | 0.2505 | 0.1002 | 0.000104 | 0.000019 |
| C at RM880 | 27.4952 | 0.2505 | 0.1002 | 0.000104 | 0.000019 |
| D at RM880 | 46.6463 | 0.0157 | 0.0063 | 0.000026 | 0.000019 |

The GRAND event is about one per **1.23 billion paid spins after counting free-board opportunities**, regardless of wager or design. B and C have around one MAJOR award per **54.4 million** paid spins. D has around one per **217.7 million**. For A the MAJOR rarity changes with stake and is included through its per-orb formula. Zero sampled rare awards would leave their theoretical return positive.

### Volatility check

A separate **two-million-paid-cycle** simulation sampled five representative presets for each design, using common reel and occupancy draws and an independent prize stream. It compared dispersion and profitability while the full matrix used exact expectations. The table shows the sample standard deviation of awards divided by wager **with MAJOR and GRAND payouts omitted** and the observed share of B and C cycles that paid more than the wager.

| Preset | A SD | B SD | C SD | D SD | B profitable | C profitable |
|---|---:|---:|---:|---:|---:|---:|
| 1¢ × 1 × 8 | 15.37× | 15.63× | 15.64× | 5.42× | 9.17% | 9.17% |
| 1¢ × 1 × 18 | 11.01× | 7.84× | 7.67× | 4.39× | 9.96% | 11.69% |
| RM2 × 1 × 8 | 15.77× | 15.63× | 15.65× | 5.42× | 9.17% | 11.52% |
| RM2 × 5 × 88 | 4.36× | 4.11× | 3.58× | 4.06× | 10.17% | 13.49% |
| RM2 × 10 × 88 | 4.06× | 4.11× | 3.57× | 4.06× | 10.17% | 13.49% |

B assigns **39.18–39.77 pp** of theoretical return to regular paid and free lines across the menu, retaining the three credit tiers and the two-Tiger award. The simulated profitable-cycle share and the 4.11× to 15.63× core dispersion across these B examples support a medium-high-volatility playtest target. C gives high-wager players more profitable cycles by reallocating return to their lines. D is less dispersed at low wagers because it sharply reduces the denomination-based jackpot tail.

The same RTP band does not imply the same volatility at every stake. In B the RM200,000 GRAND is **2.5 million times** the default wager and about **227×** the RM880 wager. The simulations observed no MAJOR or GRAND in B, consistent with just **0.037 MAJOR** and **0.0016 GRAND** expected per two million paid cycles. B's raw returns were **90.47% at RM0.08** and **92.13% at RM880** in this run. The exact calculations above include the full contribution of awards that were absent. Use theoretical means and measure the common experience separately when evaluating the game feel.

## Continue/Spin gesture fix proposal

The existing bug was reproduced in a fresh Chromium context with two tabs sharing LocalStorage and Web Locks. With both tabs showing Continue, tab B began a pointer press on that button. Tab A dismissed the result. After the storage update, tab B displayed Spin on the same DOM button. Pointer release in B grew the ledger from **one spin and 8 sen wagered** to **two spins and 16 sen wagered**, with the new state `SPINNING`. The accepted 300-credit result remained credited.

The button invokes the latest `spin()` branch on click. A cross-tab state update can change that branch between press and release. The Web Lock serializes writes after click and protects settlement, while the player's initial intent lives outside that transaction. [Main action handler](src/ui/App.tsx#L65) · [Shared button](src/ui/App.tsx#L194) · [Save synchronization](src/game/useSession.ts#L49)

1. **Create an explicit action descriptor.** Derive `continue(resultId)`, `respin(spinId, turn)`, or `newSpin(idleRevision, betSnapshot)` from the rendered control. Give the existing styled button a React key based on the action and identity so a remembered Continue element is removed when the mode changes. Keep the current visual position and styles.
2. **Bind the gesture.** Capture the descriptor and pointer ID on press, then dispatch only that descriptor if the gesture still matches at activation. Cancel on pointer cancel, loss of the action identity, disabled state, or opening a dialog. Apply the same identity check to keyboard Space and Enter, including key release for Space. A standalone native activation from assistive technology uses the descriptor of its currently mounted semantic button and the same transactional preconditions. A cancelled pointer sequence stays cancelled through its compatibility click. Ignore held-key repeats. Document-level Space resolves one explicit descriptor per new key press.
3. **Validate inside the Web Lock.** On the latest session, require the captured result ID and compatible phase for Continue, the exact bonus spin ID and turn for a manual Respin, and the same idle gameplay revision and wager for Spin. Use a persisted gameplay revision or equivalent token that changes on paid actions, round transitions, bankroll reset, and wager selection. Stale intents return a no-op with no wager or RNG draw. Continue has no route into Spin. Add a dedicated manual-respin precondition instead of routing the descriptor through the existing automatic-only respin guard.
4. **Land regression coverage.** Add the two-tab press/relabel/release browser test and require the ledger to stay at one paid spin and 8 sen wagered. A fresh, intentional Spin should then bring the ledger to two and 16 sen. Test concurrent Continue, a stale manual Respin after the other tab advances it, focused Space and Enter, touch cancel, keyboard repeat, a wager change mid-press, and a pending-round refresh. Run separate tests for the single-writer fallback where Web Locks are unavailable.

This UI fix can ship separately after approval. It does not require a change to jackpot math, saved awards, collection sequencing, or audio.

## Approval and implementation gates

1. Confirm Design B and the explicit Proposal C reductions to MINI/MINOR. The report's **91.27–92.69%** range covers the 200 supported presets rather than adding new options.
2. Publish wager calculation, bet-size-scaled line awards, the ordinary mix schedule and actual active distribution, and the fixed jackpot odds within the existing rules surface. Describe RTP as a theoretical range across the menu.
3. Version and lock the rules at the paid spin. Save the wager and math profile once, then use it for all descendant Free Spins and respins. Settle previously committed spins using their stored prices and original rules.
4. Re-run the exact checker for all 200 presets against the implementation, including integer pay arithmetic and rare jackpot payouts. Keep representative simulations for dispersion and use fixed browser cases for action intent and persistence. Recheck round compatibility and presentation before release.

## Numerical appendices

### Design B ordinary-orb schedule

The high-mix basis points apply to every denomination for the given total credits. Divide by 10,000 to get the high-mix share. The rest uses the low mix.

| Credits | High-mix basis points | Conditional mean |
|---:|---:|---:|
| 8 | 2347 | 1.495999× |
| 16 | 6007 | 2.040241× |
| 18 | 6414 | 2.100762× |
| 24 | 7227 | 2.221655× |
| 36 | 8041 | 2.342697× |
| 38 | 8126 | 2.355336× |
| 40 | 8203 | 2.366786× |
| 54 | 8583 | 2.423292× |
| 58 | 8657 | 2.434296× |
| 76 | 8897 | 2.469984× |
| 80 | 8935 | 2.475634× |
| 88 | 9002 | 2.485597× |
| 90 | 9016 | 2.487679× |
| 114 | 9153 | 2.508051× |
| 116 | 9162 | 2.509389× |
| 174 | 9331 | 2.534520× |
| 176 | 9334 | 2.534966× |
| 180 | 9342 | 2.536155× |
| 190 | 9359 | 2.538683× |
| 264 | 9445 | 2.551472× |
| 290 | 9465 | 2.554445× |
| 380 | 9513 | 2.561583× |
| 440 | 9534 | 2.564706× |
| 580 | 9566 | 2.569464× |
| 880 | 9601 | 2.574669× |

### Full 200-preset theoretical RTP matrix

All RTP columns include ordinary orbs, all four jackpot tiers, and paid and free line and Scatter payouts. Audit C is the prior proposal at fixed credit awards. Audit C × size applies bet-size scaling alone. C factor is the additional line factor in basis points for Design C. Percentages are rounded for display.

#### Denomination 1¢

| Bet size | Lines | Wager (RM) | Installed | Audit C | Audit C × size | A | B | C | D | C factor |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 8 | 0.08 | 154.078% | 92.663% | 92.663% | 92.000% | 92.616% | 91.954% | 92.867% | 9749 |
| 1 | 18 | 0.18 | 140.051% | 81.643% | 81.643% | 92.000% | 92.693% | 92.016% | 92.373% | 12563 |
| 1 | 38 | 0.38 | 131.951% | 76.302% | 76.302% | 92.000% | 92.023% | 92.035% | 91.464% | 14250 |
| 1 | 58 | 0.58 | 131.544% | 75.326% | 75.326% | 92.000% | 92.495% | 91.701% | 91.863% | 14374 |
| 1 | 88 | 0.88 | 130.447% | 74.425% | 74.425% | 92.000% | 92.536% | 92.015% | 91.853% | 14563 |
| 2 | 8 | 0.16 | 96.397% | 62.718% | 82.341% | 92.000% | 92.281% | 91.531% | 92.019% | 12499 |
| 2 | 18 | 0.36 | 89.383% | 57.208% | 77.055% | 92.000% | 92.544% | 91.998% | 91.996% | 13781 |
| 2 | 38 | 0.76 | 85.333% | 54.538% | 74.129% | 92.000% | 91.953% | 92.191% | 91.285% | 14500 |
| 2 | 58 | 1.16 | 85.129% | 54.050% | 73.902% | 92.000% | 92.450% | 92.203% | 91.746% | 14500 |
| 2 | 88 | 1.76 | 84.581% | 53.600% | 73.486% | 92.000% | 92.503% | 92.046% | 91.776% | 14625 |
| 3 | 8 | 0.24 | 77.170% | 52.737% | 78.900% | 92.000% | 92.169% | 92.005% | 91.736% | 13355 |
| 3 | 18 | 0.54 | 72.494% | 49.064% | 75.526% | 92.000% | 92.494% | 91.999% | 91.870% | 14124 |
| 3 | 38 | 1.14 | 69.794% | 47.283% | 73.404% | 92.000% | 91.927% | 91.849% | 91.226% | 14791 |
| 3 | 58 | 1.74 | 69.658% | 46.958% | 73.427% | 92.000% | 92.436% | 92.004% | 91.707% | 14758 |
| 3 | 88 | 2.64 | 69.292% | 46.658% | 73.174% | 92.000% | 92.493% | 91.899% | 91.751% | 14791 |
| 5 | 8 | 0.40 | 61.788% | 44.752% | 76.148% | 92.000% | 92.079% | 92.005% | 91.510% | 14055 |
| 5 | 18 | 0.90 | 58.982% | 42.548% | 74.303% | 92.000% | 92.452% | 92.005% | 91.770% | 14410 |
| 5 | 38 | 1.90 | 57.362% | 41.480% | 72.825% | 92.000% | 91.910% | 92.009% | 91.178% | 14929 |
| 5 | 58 | 2.90 | 57.281% | 41.285% | 73.048% | 92.000% | 92.422% | 91.987% | 91.676% | 14785 |
| 5 | 88 | 4.40 | 57.062% | 41.104% | 72.923% | 92.000% | 92.486% | 91.989% | 91.730% | 14849 |
| 10 | 8 | 0.80 | 50.251% | 38.763% | 74.084% | 92.000% | 92.012% | 91.993% | 91.340% | 14562 |
| 10 | 18 | 1.80 | 48.849% | 37.661% | 73.385% | 92.000% | 92.424% | 91.999% | 91.694% | 14693 |
| 10 | 38 | 3.80 | 48.039% | 37.127% | 72.390% | 92.000% | 91.896% | 91.999% | 91.142% | 15018 |
| 10 | 58 | 5.80 | 47.998% | 37.029% | 72.763% | 92.000% | 92.413% | 92.051% | 91.653% | 14834 |
| 10 | 88 | 8.80 | 47.888% | 36.939% | 72.736% | 92.000% | 92.481% | 92.058% | 91.715% | 14834 |

#### Denomination 2¢

| Bet size | Lines | Wager (RM) | Installed | Audit C | Audit C × size | A | B | C | D | C factor |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 8 | 0.16 | 153.402% | 91.986% | 91.986% | 92.000% | 91.940% | 91.992% | 92.622% | 10031 |
| 1 | 18 | 0.36 | 139.750% | 81.342% | 81.342% | 92.000% | 92.392% | 92.014% | 92.264% | 12594 |
| 1 | 38 | 0.76 | 131.809% | 76.159% | 76.159% | 92.000% | 91.880% | 91.967% | 91.412% | 14107 |
| 1 | 58 | 1.16 | 131.450% | 75.232% | 75.232% | 92.000% | 92.402% | 92.266% | 91.830% | 14167 |
| 1 | 88 | 1.76 | 130.385% | 74.363% | 74.363% | 92.000% | 92.474% | 91.952% | 91.831% | 14431 |
| 2 | 8 | 0.32 | 96.059% | 62.380% | 82.003% | 92.000% | 91.942% | 91.991% | 91.896% | 12568 |
| 2 | 18 | 0.72 | 89.233% | 57.058% | 76.905% | 92.000% | 92.394% | 92.104% | 91.941% | 13750 |
| 2 | 38 | 1.52 | 85.262% | 54.467% | 74.057% | 92.000% | 91.882% | 91.882% | 91.259% | 14583 |
| 2 | 58 | 2.32 | 85.083% | 54.003% | 73.855% | 92.000% | 92.403% | 91.919% | 91.729% | 14583 |
| 2 | 88 | 3.52 | 84.550% | 53.569% | 73.456% | 92.000% | 92.473% | 92.001% | 91.765% | 14603 |
| 3 | 8 | 0.48 | 76.944% | 52.512% | 78.675% | 92.000% | 91.943% | 91.965% | 91.654% | 13437 |
| 3 | 18 | 1.08 | 72.394% | 48.964% | 75.426% | 92.000% | 92.394% | 92.174% | 91.834% | 14167 |
| 3 | 38 | 2.28 | 69.746% | 47.236% | 73.357% | 92.000% | 91.880% | 92.022% | 91.208% | 14723 |
| 3 | 58 | 3.48 | 69.627% | 46.927% | 73.396% | 92.000% | 92.405% | 91.997% | 91.696% | 14708 |
| 3 | 88 | 5.28 | 69.272% | 46.637% | 73.153% | 92.000% | 92.473% | 92.099% | 91.743% | 14723 |
| 5 | 8 | 0.80 | 61.653% | 44.617% | 76.013% | 92.000% | 91.944% | 92.006% | 91.461% | 14082 |
| 5 | 18 | 1.80 | 58.922% | 42.488% | 74.243% | 92.000% | 92.392% | 91.979% | 91.748% | 14499 |
| 5 | 38 | 3.80 | 57.334% | 41.451% | 72.796% | 92.000% | 91.881% | 91.984% | 91.168% | 14899 |
| 5 | 58 | 5.80 | 57.262% | 41.266% | 73.029% | 92.000% | 92.403% | 91.998% | 91.669% | 14806 |
| 5 | 88 | 8.80 | 57.049% | 41.092% | 72.911% | 92.000% | 92.474% | 92.023% | 91.726% | 14813 |
| 10 | 8 | 1.60 | 50.184% | 38.696% | 74.016% | 92.000% | 91.944% | 92.031% | 91.315% | 14584 |
| 10 | 18 | 3.60 | 48.819% | 37.631% | 73.355% | 92.000% | 92.394% | 92.000% | 91.683% | 14706 |
| 10 | 38 | 7.60 | 48.025% | 37.113% | 72.376% | 92.000% | 91.881% | 92.002% | 91.137% | 15013 |
| 10 | 58 | 11.60 | 47.989% | 37.020% | 72.754% | 92.000% | 92.404% | 91.993% | 91.649% | 14849 |
| 10 | 88 | 17.60 | 47.882% | 36.933% | 72.730% | 92.000% | 92.475% | 91.998% | 91.712% | 14846 |

#### Denomination 5¢

| Bet size | Lines | Wager (RM) | Installed | Audit C | Audit C × size | A | B | C | D | C factor |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 8 | 0.40 | 152.996% | 91.581% | 91.581% | 92.000% | 91.535% | 92.021% | 92.474% | 10125 |
| 1 | 18 | 0.90 | 139.570% | 81.162% | 81.162% | 92.000% | 92.212% | 91.998% | 92.198% | 12737 |
| 1 | 38 | 1.90 | 131.723% | 76.074% | 76.074% | 92.000% | 91.795% | 91.996% | 91.381% | 14124 |
| 1 | 58 | 2.90 | 131.394% | 75.176% | 75.176% | 92.000% | 92.346% | 92.005% | 91.809% | 14238 |
| 1 | 88 | 4.40 | 130.349% | 74.326% | 74.326% | 92.000% | 92.438% | 91.994% | 91.818% | 14387 |
| 2 | 8 | 0.80 | 95.856% | 62.178% | 81.800% | 92.000% | 91.740% | 91.997% | 91.822% | 12574 |
| 2 | 18 | 1.80 | 89.143% | 56.968% | 76.815% | 92.000% | 92.304% | 91.976% | 91.909% | 13833 |
| 2 | 38 | 3.80 | 85.219% | 54.424% | 74.015% | 92.000% | 91.839% | 91.991% | 91.244% | 14568 |
| 2 | 58 | 5.80 | 85.055% | 53.975% | 73.827% | 92.000% | 92.375% | 92.042% | 91.719% | 14563 |
| 2 | 88 | 8.80 | 84.532% | 53.550% | 73.437% | 92.000% | 92.454% | 91.992% | 91.758% | 14687 |
| 3 | 8 | 1.20 | 76.809% | 52.376% | 78.540% | 92.000% | 91.808% | 91.992% | 91.605% | 13444 |
| 3 | 18 | 2.70 | 72.333% | 48.903% | 75.366% | 92.000% | 92.334% | 91.995% | 91.812% | 14199 |
| 3 | 38 | 5.70 | 69.718% | 47.207% | 73.328% | 92.000% | 91.851% | 91.983% | 91.198% | 14777 |
| 3 | 58 | 8.70 | 69.608% | 46.908% | 73.378% | 92.000% | 92.386% | 91.991% | 91.689% | 14708 |
| 3 | 88 | 13.20 | 69.260% | 46.625% | 73.141% | 92.000% | 92.461% | 92.008% | 91.739% | 14743 |
| 5 | 8 | 2.00 | 61.571% | 44.536% | 75.932% | 92.000% | 91.863% | 92.000% | 91.431% | 14089 |
| 5 | 18 | 4.50 | 58.886% | 42.452% | 74.206% | 92.000% | 92.356% | 91.981% | 91.735% | 14474 |
| 5 | 38 | 9.50 | 57.317% | 41.434% | 72.779% | 92.000% | 91.864% | 92.000% | 91.162% | 14907 |
| 5 | 58 | 14.50 | 57.251% | 41.255% | 73.018% | 92.000% | 92.392% | 91.984% | 91.665% | 14774 |
| 5 | 88 | 22.00 | 57.042% | 41.085% | 72.904% | 92.000% | 92.466% | 91.999% | 91.723% | 14803 |
| 10 | 8 | 4.00 | 50.143% | 38.655% | 73.975% | 92.000% | 91.904% | 92.003% | 91.301% | 14588 |
| 10 | 18 | 9.00 | 48.801% | 37.613% | 73.337% | 92.000% | 92.376% | 92.018% | 91.677% | 14700 |
| 10 | 38 | 19.00 | 48.016% | 37.104% | 72.367% | 92.000% | 91.873% | 92.003% | 91.134% | 15013 |
| 10 | 58 | 29.00 | 47.983% | 37.014% | 72.748% | 92.000% | 92.398% | 92.000% | 91.647% | 14847 |
| 10 | 88 | 44.00 | 47.879% | 36.929% | 72.726% | 92.000% | 92.471% | 92.000% | 91.711% | 14841 |

#### Denomination 10¢

| Bet size | Lines | Wager (RM) | Installed | Audit C | Audit C × size | A | B | C | D | C factor |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 8 | 0.80 | 152.861% | 91.446% | 91.446% | 92.000% | 91.399% | 92.001% | 92.425% | 10160 |
| 1 | 18 | 1.80 | 139.510% | 81.102% | 81.102% | 92.000% | 92.152% | 92.020% | 92.176% | 12750 |
| 1 | 38 | 3.80 | 131.695% | 76.045% | 76.045% | 92.000% | 91.766% | 92.000% | 91.371% | 14081 |
| 1 | 58 | 5.80 | 131.376% | 75.158% | 75.158% | 92.000% | 92.328% | 91.996% | 91.802% | 14227 |
| 1 | 88 | 8.80 | 130.336% | 74.314% | 74.314% | 92.000% | 92.425% | 92.007% | 91.813% | 14465 |
| 2 | 8 | 1.60 | 95.788% | 62.110% | 81.732% | 92.000% | 91.672% | 91.998% | 91.798% | 12604 |
| 2 | 18 | 3.60 | 89.113% | 56.938% | 76.785% | 92.000% | 92.274% | 91.998% | 91.898% | 13843 |
| 2 | 38 | 7.60 | 85.205% | 54.410% | 74.000% | 92.000% | 91.825% | 92.003% | 91.239% | 14588 |
| 2 | 58 | 11.60 | 85.045% | 53.966% | 73.818% | 92.000% | 92.366% | 91.967% | 91.716% | 14583 |
| 2 | 88 | 17.60 | 84.526% | 53.544% | 73.431% | 92.000% | 92.448% | 92.003% | 91.756% | 14660 |
| 3 | 8 | 2.40 | 76.764% | 52.331% | 78.495% | 92.000% | 91.763% | 92.014% | 91.589% | 13438 |
| 3 | 18 | 5.40 | 72.313% | 48.883% | 75.346% | 92.000% | 92.314% | 92.000% | 91.805% | 14188 |
| 3 | 38 | 11.40 | 69.708% | 47.198% | 73.319% | 92.000% | 91.842% | 92.007% | 91.195% | 14767 |
| 3 | 58 | 17.40 | 69.602% | 46.902% | 73.371% | 92.000% | 92.380% | 92.000% | 91.687% | 14694 |
| 3 | 88 | 26.40 | 69.256% | 46.621% | 73.137% | 92.000% | 92.457% | 92.003% | 91.737% | 14735 |
| 5 | 8 | 4.00 | 61.544% | 44.509% | 75.905% | 92.000% | 91.836% | 92.020% | 91.421% | 14100 |
| 5 | 18 | 9.00 | 58.874% | 42.440% | 74.194% | 92.000% | 92.344% | 92.006% | 91.730% | 14488 |
| 5 | 38 | 19.00 | 57.311% | 41.428% | 72.774% | 92.000% | 91.859% | 91.999% | 91.159% | 14903 |
| 5 | 58 | 29.00 | 57.247% | 41.251% | 73.014% | 92.000% | 92.389% | 91.990% | 91.664% | 14779 |
| 5 | 88 | 44.00 | 57.039% | 41.082% | 72.901% | 92.000% | 92.464% | 91.998% | 91.722% | 14804 |
| 10 | 8 | 8.00 | 50.130% | 38.641% | 73.962% | 92.000% | 91.890% | 92.002% | 91.296% | 14594 |
| 10 | 18 | 18.00 | 48.795% | 37.607% | 73.331% | 92.000% | 92.370% | 92.000% | 91.675% | 14706 |
| 10 | 38 | 38.00 | 48.013% | 37.101% | 72.365% | 92.000% | 91.870% | 92.002% | 91.133% | 15012 |
| 10 | 58 | 58.00 | 47.981% | 37.013% | 72.746% | 92.000% | 92.396% | 91.989% | 91.647% | 14849 |
| 10 | 88 | 88.00 | 47.877% | 36.928% | 72.725% | 92.000% | 92.470% | 92.000% | 91.711% | 14848 |

#### Denomination 20¢

| Bet size | Lines | Wager (RM) | Installed | Audit C | Audit C × size | A | B | C | D | C factor |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 8 | 1.60 | 152.794% | 91.378% | 91.378% | 92.000% | 91.332% | 91.988% | 92.401% | 10156 |
| 1 | 18 | 3.60 | 139.480% | 81.072% | 81.072% | 92.000% | 92.122% | 92.050% | 92.166% | 12750 |
| 1 | 38 | 7.60 | 131.681% | 76.031% | 76.031% | 92.000% | 91.752% | 91.981% | 91.366% | 14083 |
| 1 | 58 | 11.60 | 131.366% | 75.148% | 75.148% | 92.000% | 92.318% | 91.960% | 91.799% | 14249 |
| 1 | 88 | 17.60 | 130.330% | 74.308% | 74.308% | 92.000% | 92.419% | 92.001% | 91.811% | 14447 |
| 2 | 8 | 3.20 | 95.754% | 62.076% | 81.699% | 92.000% | 91.638% | 91.969% | 91.785% | 12624 |
| 2 | 18 | 7.20 | 89.098% | 56.923% | 76.770% | 92.000% | 92.259% | 92.000% | 91.892% | 13832 |
| 2 | 38 | 15.20 | 85.198% | 54.403% | 73.993% | 92.000% | 91.818% | 92.000% | 91.236% | 14597 |
| 2 | 58 | 23.20 | 85.041% | 53.961% | 73.813% | 92.000% | 92.361% | 91.989% | 91.714% | 14578 |
| 2 | 88 | 35.20 | 84.523% | 53.541% | 73.428% | 92.000% | 92.445% | 92.012% | 91.755% | 14672 |
| 3 | 8 | 4.80 | 76.741% | 52.309% | 78.472% | 92.000% | 91.740% | 92.005% | 91.580% | 13448 |
| 3 | 18 | 10.80 | 72.303% | 48.873% | 75.336% | 92.000% | 92.304% | 92.000% | 91.801% | 14196 |
| 3 | 38 | 22.80 | 69.704% | 47.193% | 73.314% | 92.000% | 91.837% | 92.000% | 91.193% | 14768 |
| 3 | 58 | 34.80 | 69.599% | 46.899% | 73.368% | 92.000% | 92.377% | 91.991% | 91.686% | 14694 |
| 3 | 88 | 52.80 | 69.253% | 46.619% | 73.135% | 92.000% | 92.455% | 91.998% | 91.736% | 14746 |
| 5 | 8 | 8.00 | 61.531% | 44.495% | 75.891% | 92.000% | 91.822% | 91.994% | 91.416% | 14106 |
| 5 | 18 | 18.00 | 58.868% | 42.434% | 74.188% | 92.000% | 92.338% | 91.999% | 91.728% | 14486 |
| 5 | 38 | 38.00 | 57.308% | 41.426% | 72.771% | 92.000% | 91.856% | 91.999% | 91.158% | 14909 |
| 5 | 58 | 58.00 | 57.245% | 41.249% | 73.012% | 92.000% | 92.387% | 91.998% | 91.663% | 14783 |
| 5 | 88 | 88.00 | 57.038% | 41.081% | 72.900% | 92.000% | 92.463% | 92.000% | 91.722% | 14803 |
| 10 | 8 | 16.00 | 50.123% | 38.635% | 73.955% | 92.000% | 91.883% | 92.002% | 91.293% | 14597 |
| 10 | 18 | 36.00 | 48.792% | 37.604% | 73.328% | 92.000% | 92.367% | 91.998% | 91.673% | 14704 |
| 10 | 38 | 76.00 | 48.012% | 37.100% | 72.363% | 92.000% | 91.868% | 92.000% | 91.133% | 15011 |
| 10 | 58 | 116.00 | 47.980% | 37.012% | 72.745% | 92.000% | 92.395% | 92.001% | 91.646% | 14849 |
| 10 | 88 | 176.00 | 47.877% | 36.928% | 72.724% | 92.000% | 92.470% | 92.000% | 91.710% | 14846 |

#### Denomination 50¢

| Bet size | Lines | Wager (RM) | Installed | Audit C | Audit C × size | A | B | C | D | C factor |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 8 | 4.00 | 152.753% | 91.337% | 91.337% | 92.000% | 91.291% | 92.011% | 92.386% | 10167 |
| 1 | 18 | 9.00 | 139.462% | 81.054% | 81.054% | 92.000% | 92.104% | 91.994% | 92.159% | 12762 |
| 1 | 38 | 19.00 | 131.672% | 76.023% | 76.023% | 92.000% | 91.744% | 92.001% | 91.363% | 14079 |
| 1 | 58 | 29.00 | 131.361% | 75.143% | 75.143% | 92.000% | 92.313% | 92.001% | 91.797% | 14241 |
| 1 | 88 | 44.00 | 130.326% | 74.304% | 74.304% | 92.000% | 92.415% | 92.000% | 91.810% | 14448 |
| 2 | 8 | 8.00 | 95.734% | 62.056% | 81.678% | 92.000% | 91.618% | 92.003% | 91.778% | 12630 |
| 2 | 18 | 18.00 | 89.089% | 56.914% | 76.761% | 92.000% | 92.250% | 92.001% | 91.889% | 13841 |
| 2 | 38 | 38.00 | 85.194% | 54.398% | 73.989% | 92.000% | 91.814% | 92.000% | 91.235% | 14594 |
| 2 | 58 | 58.00 | 85.038% | 53.959% | 73.811% | 92.000% | 92.358% | 92.002% | 91.713% | 14583 |
| 2 | 88 | 88.00 | 84.521% | 53.539% | 73.426% | 92.000% | 92.443% | 91.996% | 91.754% | 14669 |
| 3 | 8 | 12.00 | 76.728% | 52.295% | 78.459% | 92.000% | 91.727% | 91.999% | 91.575% | 13451 |
| 3 | 18 | 27.00 | 72.297% | 48.867% | 75.330% | 92.000% | 92.298% | 92.000% | 91.799% | 14199 |
| 3 | 38 | 57.00 | 69.701% | 47.190% | 73.311% | 92.000% | 91.834% | 92.001% | 91.192% | 14769 |
| 3 | 58 | 87.00 | 69.597% | 46.897% | 73.366% | 92.000% | 92.375% | 91.999% | 91.685% | 14694 |
| 3 | 88 | 132.00 | 69.252% | 46.618% | 73.133% | 92.000% | 92.453% | 91.997% | 91.736% | 14744 |
| 5 | 8 | 20.00 | 61.523% | 44.487% | 75.883% | 92.000% | 91.814% | 91.998% | 91.413% | 14107 |
| 5 | 18 | 45.00 | 58.865% | 42.430% | 74.185% | 92.000% | 92.334% | 91.998% | 91.727% | 14487 |
| 5 | 38 | 95.00 | 57.307% | 41.424% | 72.769% | 92.000% | 91.854% | 92.002% | 91.158% | 14908 |
| 5 | 58 | 145.00 | 57.244% | 41.248% | 73.011% | 92.000% | 92.386% | 91.999% | 91.663% | 14782 |
| 5 | 88 | 220.00 | 57.037% | 41.080% | 72.899% | 92.000% | 92.462% | 92.002% | 91.721% | 14803 |
| 10 | 8 | 40.00 | 50.119% | 38.631% | 73.951% | 92.000% | 91.879% | 92.001% | 91.292% | 14599 |
| 10 | 18 | 90.00 | 48.790% | 37.602% | 73.326% | 92.000% | 92.365% | 92.000% | 91.673% | 14704 |
| 10 | 38 | 190.00 | 48.011% | 37.099% | 72.362% | 92.000% | 91.868% | 92.001% | 91.132% | 15012 |
| 10 | 58 | 290.00 | 47.980% | 37.011% | 72.745% | 92.000% | 92.395% | 91.996% | 91.646% | 14849 |
| 10 | 88 | 440.00 | 47.876% | 36.927% | 72.724% | 92.000% | 92.469% | 91.999% | 91.710% | 14846 |

#### Denomination RM1

| Bet size | Lines | Wager (RM) | Installed | Audit C | Audit C × size | A | B | C | D | C factor |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 8 | 8.00 | 152.739% | 91.324% | 91.324% | 92.000% | 91.278% | 92.001% | 92.381% | 10171 |
| 1 | 18 | 18.00 | 139.456% | 81.048% | 81.048% | 92.000% | 92.098% | 92.001% | 92.157% | 12757 |
| 1 | 38 | 38.00 | 131.669% | 76.020% | 76.020% | 92.000% | 91.741% | 91.998% | 91.362% | 14081 |
| 1 | 58 | 58.00 | 131.359% | 75.141% | 75.141% | 92.000% | 92.311% | 92.000% | 91.796% | 14248 |
| 1 | 88 | 88.00 | 130.325% | 74.303% | 74.303% | 92.000% | 92.414% | 91.989% | 91.809% | 14449 |
| 2 | 8 | 16.00 | 95.727% | 62.049% | 81.672% | 92.000% | 91.611% | 92.000% | 91.776% | 12632 |
| 2 | 18 | 36.00 | 89.085% | 56.911% | 76.758% | 92.000% | 92.247% | 92.001% | 91.888% | 13841 |
| 2 | 38 | 76.00 | 85.192% | 54.397% | 73.988% | 92.000% | 91.812% | 91.997% | 91.234% | 14596 |
| 2 | 58 | 116.00 | 85.037% | 53.958% | 73.810% | 92.000% | 92.357% | 91.999% | 91.713% | 14581 |
| 2 | 88 | 176.00 | 84.520% | 53.539% | 73.426% | 92.000% | 92.443% | 91.999% | 91.754% | 14671 |
| 3 | 8 | 24.00 | 76.723% | 52.291% | 78.454% | 92.000% | 91.722% | 92.000% | 91.574% | 13451 |
| 3 | 18 | 54.00 | 72.295% | 48.865% | 75.328% | 92.000% | 92.296% | 91.999% | 91.798% | 14200 |
| 3 | 38 | 114.00 | 69.700% | 47.189% | 73.310% | 92.000% | 91.833% | 92.000% | 91.192% | 14770 |
| 3 | 58 | 174.00 | 69.596% | 46.897% | 73.366% | 92.000% | 92.375% | 92.001% | 91.685% | 14694 |
| 3 | 88 | 264.00 | 69.252% | 46.617% | 73.133% | 92.000% | 92.453% | 91.996% | 91.736% | 14743 |
| 5 | 8 | 40.00 | 61.520% | 44.484% | 75.880% | 92.000% | 91.811% | 91.999% | 91.412% | 14107 |
| 5 | 18 | 90.00 | 58.863% | 42.429% | 74.184% | 92.000% | 92.333% | 92.001% | 91.726% | 14489 |
| 5 | 38 | 190.00 | 57.306% | 41.423% | 72.768% | 92.000% | 91.854% | 92.002% | 91.158% | 14909 |
| 5 | 58 | 290.00 | 57.244% | 41.248% | 73.011% | 92.000% | 92.385% | 92.000% | 91.663% | 14783 |
| 5 | 88 | 440.00 | 57.037% | 41.080% | 72.899% | 92.000% | 92.462% | 92.001% | 91.721% | 14803 |
| 10 | 8 | 80.00 | 50.118% | 38.629% | 73.950% | 92.000% | 91.878% | 91.999% | 91.291% | 14599 |
| 10 | 18 | 180.00 | 48.789% | 37.602% | 73.326% | 92.000% | 92.364% | 92.003% | 91.673% | 14705 |
| 10 | 38 | 380.00 | 48.011% | 37.099% | 72.362% | 92.000% | 91.867% | 92.001% | 91.132% | 15012 |
| 10 | 58 | 580.00 | 47.980% | 37.011% | 72.745% | 92.000% | 92.394% | 92.001% | 91.646% | 14850 |
| 10 | 88 | 880.00 | 47.876% | 36.927% | 72.724% | 92.000% | 92.469% | 91.998% | 91.710% | 14846 |

#### Denomination RM2

| Bet size | Lines | Wager (RM) | Installed | Audit C | Audit C × size | A | B | C | D | C factor |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 8 | 16.00 | 152.733% | 91.317% | 91.317% | 92.000% | 91.271% | 91.997% | 92.378% | 10174 |
| 1 | 18 | 36.00 | 139.453% | 81.045% | 81.045% | 92.000% | 92.095% | 91.999% | 92.156% | 12759 |
| 1 | 38 | 76.00 | 131.668% | 76.018% | 76.018% | 92.000% | 91.739% | 91.997% | 91.361% | 14078 |
| 1 | 58 | 116.00 | 131.358% | 75.140% | 75.140% | 92.000% | 92.310% | 92.000% | 91.796% | 14246 |
| 1 | 88 | 176.00 | 130.325% | 74.302% | 74.302% | 92.000% | 92.414% | 92.001% | 91.809% | 14449 |
| 2 | 8 | 32.00 | 95.724% | 62.046% | 81.668% | 92.000% | 91.608% | 92.003% | 91.774% | 12633 |
| 2 | 18 | 72.00 | 89.084% | 56.909% | 76.756% | 92.000% | 92.245% | 91.999% | 91.887% | 13840 |
| 2 | 38 | 152.00 | 85.192% | 54.396% | 73.987% | 92.000% | 91.812% | 91.999% | 91.234% | 14597 |
| 2 | 58 | 232.00 | 85.037% | 53.957% | 73.809% | 92.000% | 92.357% | 92.001% | 91.713% | 14582 |
| 2 | 88 | 352.00 | 84.520% | 53.538% | 73.425% | 92.000% | 92.442% | 91.997% | 91.754% | 14670 |
| 3 | 8 | 48.00 | 76.721% | 52.289% | 78.452% | 92.000% | 91.720% | 91.999% | 91.573% | 13452 |
| 3 | 18 | 108.00 | 72.294% | 48.864% | 75.327% | 92.000% | 92.295% | 92.000% | 91.798% | 14201 |
| 3 | 38 | 228.00 | 69.699% | 47.189% | 73.310% | 92.000% | 91.833% | 92.001% | 91.191% | 14770 |
| 3 | 58 | 348.00 | 69.596% | 46.896% | 73.366% | 92.000% | 92.374% | 92.000% | 91.685% | 14693 |
| 3 | 88 | 528.00 | 69.252% | 46.617% | 73.133% | 92.000% | 92.453% | 91.999% | 91.736% | 14743 |
| 5 | 8 | 80.00 | 61.519% | 44.483% | 75.879% | 92.000% | 91.810% | 92.000% | 91.412% | 14108 |
| 5 | 18 | 180.00 | 58.863% | 42.428% | 74.183% | 92.000% | 92.332% | 92.002% | 91.726% | 14489 |
| 5 | 38 | 380.00 | 57.306% | 41.423% | 72.768% | 92.000% | 91.853% | 91.997% | 91.158% | 14908 |
| 5 | 58 | 580.00 | 57.244% | 41.247% | 73.011% | 92.000% | 92.385% | 92.001% | 91.663% | 14783 |
| 5 | 88 | 880.00 | 57.037% | 41.080% | 72.899% | 92.000% | 92.462% | 91.999% | 91.721% | 14802 |
| 10 | 8 | 160.00 | 50.117% | 38.629% | 73.949% | 92.000% | 91.877% | 92.002% | 91.291% | 14600 |
| 10 | 18 | 360.00 | 48.789% | 37.601% | 73.325% | 92.000% | 92.364% | 92.001% | 91.672% | 14705 |
| 10 | 38 | 760.00 | 48.010% | 37.099% | 72.362% | 92.000% | 91.867% | 91.999% | 91.132% | 15012 |
| 10 | 58 | 1,160.00 | 47.979% | 37.011% | 72.744% | 92.000% | 92.394% | 92.001% | 91.646% | 14850 |
| 10 | 88 | 1,760.00 | 47.876% | 36.927% | 72.724% | 92.000% | 92.469% | 91.998% | 91.710% | 14846 |

