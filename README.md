# Dragon Fortune

Dragon Fortune is a browser-based slot machine for single-player virtual MYR gameplay. The React and TypeScript app runs locally with Vite, animates with CSS and Motion, and saves to LocalStorage.

## Run locally

Use Node.js 22.12+ or Node.js 24 LTS.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite, normally `http://localhost:5173/dragon-fortune/`. On Windows PowerShell, use `npm.cmd` if the execution policy blocks `npm.ps1`.

```sh
npm test
npm run verify:rtp
npm run build
npm run preview
npm run simulate -- 1000000 10 1 8 2026
```

The developer simulation accepts a paid spin count such as 10,000, 100,000, or 1,000,000, followed by denomination in sen, bet size, active lines, and a seed. A decimal second argument such as `0.80` selects the original fixed-bet argument format with active lines and seed. In that mode orb and jackpot prices use a 1¢ denomination and bet size 1. The simulator runs without reading or writing browser saves. It reports paid line hits, Hold & Spin entries, Lantern triggers and retriggers, average feature payouts, estimated return, and jackpot counts and frequencies.

The theoretical checker independently calculates nine payout components for all 200 current wagers. Pass an output path after `--` to save the results as JSON. Use `--design-b` or `--profile-5` to check earlier math profiles. After building, run `npx playwright install chromium` and `npm run test:browser` to check the production build in isolated browser sessions. Set `DRAGON_FORTUNE_BROWSER_CHANNEL=chrome` to use installed Google Chrome.

## Play from a phone on the same Wi-Fi

1. Connect the phone and computer to the same trusted Wi-Fi network. In the Dragon Fortune folder, run:

   ```powershell
   npm.cmd run dev -- --host 0.0.0.0 --port 5173
   ```

   On macOS or Linux, use `npm` in place of `npm.cmd`. [Vite network settings](https://vite.dev/config/server-options#server-host)
2. Open Vite’s **Network** URL in Safari or Chrome on your phone. It will look like `http://192.168.1.20:5173/dragon-fortune/`. On Windows, `ipconfig` lists the computer’s IPv4 address under its connected Wi-Fi adapter. Use the port Vite prints.
3. If the phone cannot connect, check whether Windows Firewall allows Node.js on private networks and whether the Wi-Fi isolates connected devices. Tap any game control to enable audio.

## Deploy to GitHub Pages

1. In the `dragon-fortune` repository on GitHub, open **Settings → Pages**. Under **Build and deployment → Source**, choose **GitHub Actions**. [GitHub Pages setup](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site#publishing-with-a-custom-github-actions-workflow)
2. Push the project, including `.github/workflows/deploy.yml` and `package-lock.json`, to `main`. The workflow builds and publishes `dist` on every push to `main`. If the files are already on `main` when you enable Pages, open **Actions → Deploy Dragon Fortune to GitHub Pages → Run workflow** and select `main`.
3. Open the published URL shown in **Settings → Pages** or the successful deployment. It typically looks like `https://<owner>.github.io/dragon-fortune/`.

To preview the same production build locally, run `npm run build`, then `npm run preview` and open `http://localhost:4173/dragon-fortune/`. Vite prefixes the generated asset URLs with `/dragon-fortune/`. Virtual balances and audio preferences are stored in each browser for that site's origin.

### Deploy to the root of another static host

1. Run `npm run build -- --base /` to produce a root-path build in `dist`. Use `npm.cmd` on Windows PowerShell if needed. [Vite static deployment guide](https://vite.dev/guide/static-deploy.html)
2. In Cloudflare’s **Workers & Pages** dashboard, create a Pages project using **Drag and drop your files**, and upload the `dist` folder. [Cloudflare Pages Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/#drag-and-drop)
3. Open the `https://<project-name>.pages.dev` URL Cloudflare provides. Each browser keeps its own virtual MYR balance and settings. The public URL starts a separate local save from the Wi-Fi preview.

## Play

Set your initial virtual bankroll on first launch. The default is RM 1,000.00 and the allowed range is RM 0.00 to RM 1,000,000.00. **Reset bankroll** next to the balance opens a confirmation showing the current balance and reset amount. Restore the saved initial bankroll there or choose **Change initial bankroll**. A confirmed reset starts a new session and clears statistics and the last result. Betting and audio preferences carry over.

Choose a denomination, bet size, and line count, then select **Spin** or press Space. Changing denomination resets Bet Size to 1 and keeps the active lines. A new game starts at 1¢ × 1 × 8 lines for a total wager of eight credits (RM 0.08). Balance, total bet, and last win also show their equivalents in credits. **Paylines** previews all 88 numbered paths, and **Paytable** shows line credit awards, Scatter prizes, and orb values. In a standalone Hold & Spin, tap **Respin** to spin the empty cells. Press **Stop** or Space while reels are moving to reveal the committed result immediately. When Hold & Spin ends, dragons deliver the held prizes to **Bonus win**. **Skip** reveals the completed tally. The main control becomes **Continue** to return to the reels.

Red Lanterns on three or more reels of a paid board start six automatic Free Spins. Each reel can show at most one Lantern. Each qualifying Free Spin adds three more. New Free Spins use Chicken, Boat, Lotus, and Tiger alongside Panda Wilds, Lanterns, and Gold Orbs. The feature displays the remaining spins and the amount earned by Free Spins and their Hold & Spin rounds. The original wager stays locked until the feature ends. A Hold & Spin triggered on the opening paid spin waits until the Free Spins finish. One triggered on a Free Spin plays automatically at the next break, then any remaining Free Spins resume. The final celebration closes automatically and the balance and **Last win** reflect the combined payout.

The settings include mute, master volume, separate music, reel-stop, orb, and jackpot volume, animation speed, reduced motion, game statistics, game reset, and developer tools. Enable **Developer test mode** under **Settings → Developer tools** to force an exact Lantern count, retriggers, a losing feature, or overlapping bonuses. The GRAND-on-first-respin scenario starts with 14 locked orbs and lands the last one on its first respin. These tests use the current virtual ledger. The selection applies to the next paid spin and its feature. The developer panel displays the active phase, counts, feature win, queued bonuses, and wager.

To check a new orb landing, select **Six orbs → seventh on first respin**, close the developer panel, then choose **Spin** and **Respin**. The separate **Six-orb trigger (all respins miss)** scenario checks the three-miss ending.

## Current game mathematics

- Each of the 15 cells rolls independently for a Gold Orb, at 16.2% on paid spins and 18.5% in Free Spins. Hold & Spin requires at least six visible orbs.
- Reels 2–5 can each draw a stack of one to three adjacent Panda Wilds. The longest stack that fits is used when a Lantern or Gold Orb blocks the requested size. The stack roll requests a Wild on 13% of eligible paid reels and 20% of eligible Free Spin reels. The weight order is no stack, one Wild, two Wilds, then three Wilds. The paid weights are 87, 8, 3, and 2. The Free Spin weights are 80, 12, 5, and 3.
- During Lantern Free Spins, a board with four or fewer Gold Orbs has a 35% roll to replace one regular paying symbol with an extra Gold Orb. Wilds and Lanterns stay in place. This roll can bring a board up to five orbs. The six-orb trigger comes from the independent cell draws.
- One credit equals the selected denomination. Bet Size sets the credits wagered per active line. Total bet is denomination × Bet Size × Active Lines. The first N paths are active. Panda Wilds substitute for standard symbols when matching from the first reel. Each winning paid or free line pays base credits × Bet Size × denomination.
- During Hold & Spin, each empty position rolls independently. The chance per empty cell is 9.1% with 6–7 held, 4.3% with 8–9, 1.0% with 10–11, and 0.105% with 12–14 at the start of the respin. A hit restores three respins and a miss uses one.
- An ordinary orb stores its multiplier, credit value, and payout when it lands. Its payout equals the triggering total wager × multiplier. The face shows credits below RM1 denomination and virtual MYR at RM1 and RM2. At eight lines and Bet Size 1, a 1× orb shows **8** credits at 10¢, **RM8** at RM1, and **RM16** at RM2. Raising Bet Size to 2 at 10¢ gives a 1× orb value of **16** credits.
- Ordinary orbs can pay 1×, 2×, 3×, 4×, 5×, 8×, 10×, 20×, 50×, 100×, or 200×. Total Credits Wagered equals Bet Size × Active Lines. Each supported credit total uses a mix of the two ordinary-orb distributions. The Paytable displays the active distribution. [Ordinary orb schedule](src/game/probabilityConfig.ts)
- Each orb on a qualifying starting board or in Hold & Spin draws its type once. The chances are ordinary 99.98349%, MINI 0.015%, MINOR 0.0015%, and MAJOR 0.00001%. Each special orb pays its stored jackpot.
- MINI pays 5,000 × denomination in sen and MINOR pays 20,000 × denomination in sen. MAJOR pays RM 50,000 and GRAND pays RM 200,000. Filling all 15 Hold & Spin cells adds GRAND to the board’s other prizes.
- Lantern Scatter pays 2× the total wager for three, 5× for four, and 25× for five. The scatter count is capped by the number of reels with room. The Lantern count draw preserves the Gold Orb distribution. Paid and free weights govern entry and retrigger rates, and tier weights tune the count. Free Spin settings must keep expected retrigger awards below one additional spin per spin played.
- These rules and probabilities are original demo math. The game has no payments or cashouts.

### Paytable and reel weights

| Symbol | 2 matches | 3 matches | 4 matches | 5 matches |
|---|---:|---:|---:|---:|
| 9, 10, J, Q, K | — | 5 | 14 | 55 |
| Chicken, Boat, Lotus Flower | — | 8 | 20 | 80 |
| Tiger | 3 | 22 | 55 | 200 |

The nine paying symbols share the paid draw equally. On free boards, Chicken, Boat, Lotus, and Tiger use relative weights 1, 1, 1, and 0.8. Wild stacks, Lanterns, and Gold Orbs use separate probabilities. [Reel weights](src/game/probabilityConfig.ts)

### Hold & Spin rebalance

| Theoretical result | Profile 4 | Profile 5 | Current |
|---|---:|---:|---:|
| Hold & Spin per paid spin | 2.00% | 2.00% | 2.41% |
| Hold & Spin per Lantern Free Spin | 2.00% | 4.37% | 4.37% |
| Lantern features with at least one Hold & Spin, including retriggers | 12.50% | 25.28% | 25.28% |
| Average final orbs from exactly six | 8.17 | 8.87 | 8.87 |
| Chance of finishing with at least 10 orbs from exactly six | 13.81% | 37.45% | 37.45% |
| Median Hold & Spin at 10¢ × 1 × 8 lines | RM8.80 | RM10.40 | RM13.60 |
| Mean ordinary-orb portion of Hold & Spin at 10¢ × 1 × 8 lines | RM9.85 | RM10.95 | RM14.10 |
| Mean Hold & Spin including jackpots at 10¢ × 1 × 8 lines | RM16.81 | RM17.24 | RM15.08 |
| Theoretical RTP across all 200 wagers, including jackpots | 91.27–92.69% | 91.21–92.80% | 91.08–92.92% |

In profile 5, the higher Free Spin orb density raised Hold & Spin entries and reduced the Lantern retrigger rate from 3.07% to 2.81%. Shorter Panda stacks directed more return from line wins into Hold & Spin. The current profile retains those Free Spin and respin rules and raises the paid Gold Orb density. The extra paid orbs reduce opening Lantern entry from 1.71% to 1.68%. Each line match still pays the same number of credits.

At the RM0.80 wager, the chance of a Hold & Spin payout below RM10 fell from 39.17% to 13.06%. The new 4× and 8× orbs pay 32 and 64 credits at this wager. MINI and MINOR fell from 0.10% and 0.01% per awarded orb to 0.015% and 0.0015%, shifting return from rare jackpot awards into ordinary payouts. Jackpot prize amounts stay the same. MAJOR's per-orb odds stay the same, while the extra boards and orbs raise its expected awards per paid spin. GRAND's full-board rate moves from 0.830 to 0.961 awards per billion paid spins including Free Spins. Larger wagers also get more entries, with the average ordinary payout per entry decreasing up to 12.1% at the highest credit total. [RTP checker](scripts/verifyRtp.ts)

### Rebalancing audit

The previous 10¢ × 1 × 8-line game hit a payline on 10.11% of paid spins and had a 27.69% zero-payout Free Spins rate, excluding the opening Scatter. The one-million-spin baseline returned 549.00% overall, with 429.00 percentage points from jackpots. Rare wins explain why short sessions could feel dry despite the high overall return. The audit found that the ordinary evaluator already paid the best eligible match on each enabled line and the settlement already included bonus prizes.

The historical table uses seed 2026. The modeled estimate combines simulated line and Scatter returns with Hold & Spin expectations calculated from the distribution of initial orbs, possible landings on every respin, and the three-miss end condition. It includes each jackpot, even when the run observes zero awards for a tier.

| Configuration and wager | Paid spins | Sample RTP | RTP with modeled Hold & Spin | Paid line hits | Zero-payout Free Spins |
|---|---:|---:|---:|---:|---:|
| Original, 10¢ × 1 × 8 | 1,000,000 | 549.00% | — | 10.11% | 27.69% |
| Rank-weighted, 10¢ × 1 × 8 | 100,000 | 91.01% | 91.40% | 31.69% | 4.40% |
| Rank-weighted, 10¢ × 1 × 8 | 1,000,000 | 92.57% | 91.63% | 31.56% | 4.93% |
| Rank-weighted, 1¢ × 1 × 8 | 1,000,000 | 92.57% | 92.76% | 31.56% | 4.93% |
| Rank-weighted, 50¢ × 5 × 38 | 1,000,000 | 40.67% | 40.67% | 49.12% | 0.74% |
| Equal weights with original Wild odds, 10¢ × 1 × 8 | 1,000,000 | 77.26% | 76.32% | 8.66% | 34.92% |
| Equal weights with revised Wild odds, 10¢ × 1 × 8 | 1,000,000 | 99.00% | 91.45% | 12.82% | 11.91% |
| Equal weights with revised Wild odds, 1¢ × 1 × 8 | 1,000,000 | 155.25% | 92.58% | 12.82% | 11.91% |
| Tiered Hold & Spin rates before credit paytable, 10¢ × 1 × 8 | 1,000,000 | 91.92% | 91.30% | 12.82% | 11.52% |
| Tiered Hold & Spin rates before credit paytable, 1¢ × 1 × 8 | 1,000,000 | 91.92% | 92.51% | 12.82% | 11.52% |

Before the Hold & Spin landing-rate change, the 10¢ × 1 × 8 million-spin sample with revised Wild odds returned 19.02% from paid lines, 3.90% from opening Scatters, 8.50% from Free Spins lines and Scatters, 38.77% from ordinary Hold & Spin orbs, and 28.81% from jackpots. Hold & Spin entered on 2.0108% of paid spins, and Free Spins retriggered on 3.0658% of free boards. The averages were RM 24.19 per Hold & Spin and RM 10.03 per Lantern feature after the opening Scatter. There were 229 MINI, 33 MINOR, one MAJOR, and zero GRAND awards. That one MAJOR contributed 6.25 percentage points to the raw 10¢ return and 62.50 points at 1¢. A second million-spin run at 10¢ with seed 6026 measured 89.84% sample RTP and 91.32% with modeled Hold & Spin prizes. The prior GRAND rate was about 1.20 per billion reel boards.

With the previous Hold & Spin rates, the seed 2026 runs averaged 8.17 final orbs from exactly six and 8.24 across all starts. About 76.1% of six-orb starts reached eight or more. The exact model gives 8.17, 8.24, and 76.2%, respectively, with about 0.73 GRAND awards per billion reel boards.

Before Design B, the fixed-credit paytable at 1¢ × 1 × 8 returned 153.52% over one million paid spins and 154.12% with modeled Hold & Spin prizes. Design B corrects the stake-scaling gap by scaling line credits with Bet Size and applying the published ordinary-orb distributions.

## Recovery

A single versioned LocalStorage record holds the virtual ledger and current phase. The wager and predetermined spin are committed together at spin start. The saved round also includes held orbs and any predetermined respin results. Reloading lets the outstanding animation finish or resumes from the saved Hold & Spin board. Settlement writes the new balance, statistics, result and spin/bonus identifiers in the same record. Timers verify the round ID and respin number before changing the state. Browsers supporting Web Locks serialize writes across tabs. Use one tab at a time on browsers without Web Locks. Corrupted records fall back to a fresh virtual session. If browser storage is unavailable, the game retains the current session in memory and displays a saving notice after a failed write.

Version 1 saves retain their current balance, statistics, and settings. The update assigns the former RM 1,000.00 starting bankroll and selects the closest supported line count, then the closest total bet for that line count. In-progress rounds settle using their original total wager, active lines, and fractional payout rule.

Version 3 stores the face value of every landed orb. On older saves, already rolled multiplier prizes convert to face values that keep their MYR amounts. Old base-game orbs without saved prize values receive sample face numbers. Newly generated orbs use the current table.

Version 4 persists the locked Free Spins wager, remaining spins, accumulated payouts, and queued Hold & Spin boards. An unfinished feature resumes automatically on reload. Settlement writes the combined payout once, and the saved completion state can show the final celebration again after a reload without awarding it again.

Version 5 adds stored orb payouts and music volume. Existing in-progress rounds retain their previous jackpot schedule and banked orb values. New orbs rolled after the update use the dynamic ordinary prize formula. New rounds receive the denomination-based jackpot schedule.

New wagers save math profile 6. In-progress rounds keep the profile and wager they started with through Free Spins and Hold & Spin. The same LocalStorage record carries a gameplay revision so a control press can be checked against the saved phase, round and wager after taking the save lock. A settled Hold & Spin saves its award before presentation. Reloading during collection replays the animation against that award. Once collection finishes or is skipped, the presentation completion flag is saved with the round.

## Sound timing

Each reel's CSS animation completion triggers one short mechanical stop cue. A fallback covers missed events. All symbols on the reel appear together. Lantern landings are silent, and the separate Free Spins entry, retrigger, and completion melodies signal feature events. A reel with Gold Orbs chimes while the displayed count plus the maximum on moving reels can still reach six. New Hold & Spin landings keep their own cues. Locked orbs stay silent. Audio begins after a browser interaction unlocks Web Audio.

Original synthesized loops cover normal play, Hold & Spin, dragon collection, Hold & Spin celebration, Free Spins, and GRAND. Tracks retain their playheads across spins and retriggers. The mixer crossfades over 550 ms when the mode changes. Flying dragons have separate takeoff and arrival cues, and the celebration score starts once the counter reaches the saved total. Heavy impacts temporarily lower the music. A compressor limits peaks, and master mute silences music and effects together.

## Structure

```text
src/
  assets/              Original dragon backdrop
  game/                Configuration, payout engine, session transitions, saves and Vitest suites
  ui/                  Cabinet, symbols, animation, audio, settings and results
  main.tsx
  styles.css
scripts/
  simulate.ts          Seeded command-line simulation
```

The built-in image generator created `src/assets/dragons.png`. The SVG symbols, animations, and Web Audio sounds are original to the project.

> Landscape 16:9 backdrop illustration for an original premium Chinese fantasy slot game named Dragon Fortune (do not render any text). Moody near-black and deep burgundy lacquer scene. Two extremely intricate antique gold sculpted imperial Chinese dragons with long sinuous bodies and whiskers frame the image from the outer left and outer right edges, facing inward, with subdued red cloud patterns and a few ember flecks. Keep middle 66% completely dark, quiet, and empty for an HTML game cabinet overlay. Heads sit around 28% from the top, at far left/right. Full bleed, symmetrical luxury game concept art, gold-metal scales, dark cinematic lighting. No text, numbers, reels, UI, borders, lanterns or watermarks.

