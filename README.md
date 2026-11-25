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
npm run build
npm run preview
npm run simulate -- 1000000 10 1 8 2026
```

The developer simulation accepts a paid spin count such as 10,000, 100,000, or 1,000,000, followed by denomination in sen, bet size, active lines, and a seed. A decimal second argument such as `0.80` selects the original fixed-bet argument format with active lines and seed. In that mode orb and jackpot prices use a 1¢ denomination and bet size 1. The simulator runs without reading or writing browser saves. It reports paid line hits, Hold & Spin entries, Lantern triggers and retriggers, average feature payouts, estimated return, and jackpot counts and frequencies.

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

Choose a denomination, bet size, and line count, then select **Spin** or press Space. A new game starts at 1¢ × 1 × 8 lines for a total wager of RM 0.08. **Paylines** previews all 88 numbered paths, and **Paytable** shows line multipliers, Scatter prizes, and orb values. **Last win** clears when you start a paid spin and updates when its full payout settles. Standalone Hold & Spin uses **Respin**. Use **Continue** to close a regular win or a standalone bonus result.

Red Lanterns on three or more reels of a paid board start six automatic Free Spins. Each reel can show at most one Lantern. Each qualifying Free Spin adds three more. The feature displays the remaining spins and the amount earned by Free Spins and their Hold & Spin rounds. The original wager stays locked until the feature ends. A Hold & Spin triggered on the opening paid spin waits until the Free Spins finish. One triggered on a Free Spin plays automatically at the next break, then any remaining Free Spins resume. The final celebration closes automatically and the balance and **Last win** reflect the combined payout.

The settings include mute, master volume, separate music, reel-stop, orb, and jackpot volume, animation speed, reduced motion, game statistics, game reset, and developer tools. Enable **Developer test mode** under **Settings → Developer tools** to force an exact Lantern count, retriggers, a losing feature, or overlapping bonuses. The GRAND-on-first-respin scenario starts with 14 locked orbs and lands the last one on its first respin. These tests use the current virtual ledger. The selection applies to the next paid spin and its feature. The developer panel displays the active phase, counts, feature win, queued bonuses, and wager.

## Original demo mathematics

- Each of the 15 cells has an independent Gold Orb draw with weight 16.6 out of 106.6. Hold & Spin requires at least six visible orbs. The modeled entry rate is 2.0034% per paid spin or Lantern Free Spin.
- Each reel draws one stack of zero to three adjacent Panda Wilds. If a Lantern or Gold Orb blocks the requested stack, the longest stack that fits is used. Free Spins have higher stack weights.
- During Lantern Free Spins, a board with four or fewer Gold Orbs has a 35% roll to replace one regular paying symbol with an extra Gold Orb. Wilds and Lanterns stay in place. The extra orb can bring a board up to five orbs, preserving the six-orb trigger and the original distribution of starting orbs for Hold & Spin.
- Bet per line is denomination × bet size. Total bet is bet per line × active lines. The first N paths are active. Each pays its strongest applicable left-to-right match, including wild substitutions and wild-only combinations. Each line payout is its multiplier × bet per line, in integer sen.
- During Hold & Spin, each empty position has an independent 4% chance to land an orb each respin. Existing orbs stay fixed. A hit restores three respins and a miss uses one.
- An ordinary orb stores its multiplier, displayed number, and payout when it lands. **Displayed number = base units × bet size × multiplier. Payout in sen = displayed number × denomination in sen.** Default base units are 8, and `BASE_ORB_UNITS_BY_DENOMINATION` can override them. The number of lines enters the wager calculation only. At RM 2 with bet size 3 and a 5× orb, the face shows 120 and pays RM 240.
- The configurable multiplier and weight pairs are 1× (35), 2× (25), 3× (16), 5× (10), 10× (7), 20× (4), 50× (2), 100× (0.8), and 200× (0.2). The engine normalizes enabled weights. `maxOrbMultiplier` defaults to 200 and may be raised to enable new tiers.
- Once an orb lands in Hold & Spin or on a qualifying starting board, one weighted type draw gives ordinary 99%, MINI 0.8%, MINOR 0.19%, or MAJOR 0.01%. Each special orb pays its stored jackpot. Ordinary and special prizes use separate rules.
- MINI pays 5,000 × denomination in sen and MINOR pays 20,000 × denomination in sen. MAJOR pays RM 50,000 and GRAND pays RM 200,000. Filling all 15 Hold & Spin cells adds GRAND to the board’s other prizes.
- Lantern Scatter pays 2× the total bet for exactly three, 4× for exactly four, or a configurable 8× demo prize for five. The scatter count is capped by the number of reels with room. The Lantern count draw preserves the Gold Orb distribution. Paid and free weights govern entry and retrigger rates, and tier weights tune the count. Free Spin settings must keep expected retrigger awards below one additional spin per spin played.
- These rules and probabilities are original demo math. The game has no payments or cashouts.

Change reel, Lantern, orb, and jackpot type weights in `src/game/probabilityConfig.ts`. The simulator compares the entry rate set by `baseOrbWeight` with `targetEntryChance`. The separate `landingChance` controls respins and influences how often Hold & Spin boards fill.

Before the Free Spins reel tuning, seed 2026 produced these results at 10¢ denomination, bet size 1, and 8 lines.

| Paid spins | Paid Hold & Spin entries | Entry rate | GRAND awards including Free Spins |
|---:|---:|---:|---:|
| 10,000 | 204 | 2.0400% | 0 |
| 100,000 | 2,014 | 2.0140% | 3 |
| 1,000,000 | 19,947 | 1.9947% | 10 |

The modeled GRAND rate per reel board is approximately 0.000920%. The million-spin run observed GRAND on 0.001000% of paid spins including their Free Spins. This sample remains sparse for estimating GRAND. The million-spin run recorded 26 MAJOR, 352 MINOR, and 1,475 MINI awards. It averaged RM 246.81 per Hold & Spin and RM 37.88 per Lantern feature’s Free Spins. Estimated virtual RTP was 701.89% at this wager. Large jackpots and the selected wager strongly affect this demo figure.

After the Gold Orb tuning and before Panda Wild stacks, the same million-spin simulation measured Hold & Spin on 1.9869% of paid spins and 2.0168% of Free Spins. The 114,141 Free Spins averaged 2.652 Gold Orbs per spin and hit a payline on 12.0877% of spins with eight active lines.

With Panda Wild stacks, 200,000 simulated spins in each mode produced at least one full Panda reel on 7.72% of paid spins and 14.60% of Free Spins. Hold & Spin triggered on 1.982% of paid spins and 1.997% of Free Spins.

## Recovery

A single versioned LocalStorage record holds the virtual ledger and current phase. The wager and predetermined spin are committed together at spin start. The saved round also includes held orbs and any predetermined respin results. Reloading lets the outstanding animation finish or resumes from the saved Hold & Spin board. Settlement writes the new balance, statistics, result and spin/bonus identifiers in the same record. Timers verify the round ID and respin number before changing the state. Browsers supporting Web Locks serialize writes across tabs. Use one tab at a time on browsers without Web Locks. Corrupted records fall back to a fresh virtual session. If browser storage is unavailable, the game retains the current session in memory and displays a saving notice after a failed write.

Version 1 saves retain their current balance, statistics, and settings. The update assigns the former RM 1,000.00 starting bankroll and selects the closest supported line count, then the closest total bet for that line count. In-progress rounds settle using their original total wager, active lines, and fractional payout rule.

Version 3 stores the face value of every landed orb. On older saves, already rolled multiplier prizes convert to face values that keep their MYR amounts. Old base-game orbs without saved prize values receive sample face numbers. Newly generated orbs use the current table.

Version 4 persists the locked Free Spins wager, remaining spins, accumulated payouts, and queued Hold & Spin boards. An unfinished feature resumes automatically on reload. Settlement writes the combined payout once, and the saved completion state can show the final celebration again after a reload without awarding it again.

Version 5 adds stored orb payouts and music volume. Existing in-progress rounds retain their previous jackpot schedule and banked orb values. New orbs rolled after the update use the dynamic ordinary prize formula. New rounds receive the denomination-based jackpot schedule.

## Sound timing

Each reel's CSS animation completion triggers one mechanical stop cue. A fallback completes any outstanding reels if their events never arrive. One reveal sequence shows and sounds each new Lantern or orb in order, with a tier-specific accent for jackpot orbs. Lanterns use a metallic chime and separate melodies for entry, retrigger, and completion. Orb pitch rises slightly within each spin or respin. Locked orbs stay silent. Unique keys per spin, phase, reel, and cell prevent repeated callbacks from replaying sounds. Audio begins after a browser interaction unlocks Web Audio.

Original synthesized loops cover normal play, Hold & Spin, Free Spins, and jackpot celebrations. Tracks retain their playheads across spins and retriggers. When a queued bonus changes modes, the mixer crossfades over 550 ms and resumes the appropriate loop. Hold & Spin impacts add a bass drop, metal collision, shimmer, and short reflected taps. Heavy hits temporarily lower the music. A compressor limits peaks, and master mute silences music and effects together.

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

