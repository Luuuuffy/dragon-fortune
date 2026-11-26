import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import type { Browser, Page } from 'playwright'
import { preview } from 'vite'
import type { Scenario } from '../src/game/engine'
import type { Session } from '../src/game/session'
import { SAVE_KEY } from '../src/game/storage'

const previewServer = await preview({ preview: { host: '127.0.0.1', port: 0 } })
const url = previewServer.resolvedUrls!.local[0]
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true })

function read(page: Page) {
  return page.evaluate(async key => navigator.locks.request(key, () =>
    JSON.parse(localStorage.getItem(key)!) as Session), SAVE_KEY)
}

async function waitForPhase(page: Page, phase: Session['round']['phase']) {
  await page.waitForFunction(({ key, phase }) => JSON.parse(localStorage.getItem(key) ?? '{}').round?.phase === phase,
    { key: SAVE_KEY, phase }, { timeout: 35_000 })
}

async function initialize(page: Page) {
  await page.goto(url)
  await button(page, 'Start game').click()
  await button(page, 'Settings').click()
  await page.getByLabel('Animation speed').selectOption('2')
  await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)!).settings.speed === 2, SAVE_KEY)
  await button(page, 'Close').click()
}

async function chooseScenario(page: Page, scenario: Scenario) {
  await button(page, 'Settings').click()
  await button(page, 'Developer tools').click()
  await page.getByRole('checkbox', { name: 'Enable developer mode' }).check()
  await page.getByRole('combobox', { name: 'Next outcome' }).selectOption(scenario)
  await button(page, 'Close').click()
}

async function verifyTwoTabs(browser: Browser, input: 'mouse' | 'keyboard' | 'touch') {
  const context = await browser.newContext({ reducedMotion: 'reduce', hasTouch: input === 'touch' })
  try {
    const first = await context.newPage()
    const second = await context.newPage()
    await initialize(first)
    await second.goto(url)
    await chooseScenario(first, 'line')
    await button(first, 'Spin').click()
    await button(first, 'Continue').waitFor()
    const otherContinue = button(second, 'Continue')
    await otherContinue.waitFor()
    const original = await read(second)
    assert.equal(original.last?.total, 200)
    const bounds = (await otherContinue.boundingBox())!
    const x = bounds.x + bounds.width / 2
    const y = bounds.y + bounds.height / 2
    const touch = input === 'touch' ? await context.newCDPSession(second) : null
    if (touch) await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
    else if (input === 'mouse') {
      await second.mouse.move(x, y)
      await second.mouse.down()
    } else {
      await otherContinue.focus()
      await second.keyboard.down('Space')
    }

    await button(first, 'Continue').click()
    await button(second, 'Spin').waitFor()
    if (touch) await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    else if (input === 'mouse') await second.mouse.up()
    else await second.keyboard.up('Space')

    const afterRelease = await read(second)
    assert.equal(afterRelease.round.phase, 'IDLE')
    assert.equal(afterRelease.stats.spins, 1)
    assert.equal(afterRelease.stats.wagered, 8)
    assert.equal(afterRelease.balance, original.balance)
    assert.deepEqual(afterRelease.last, original.last)

    if (input === 'touch') await button(second, 'Spin').tap()
    else if (input === 'keyboard') await button(second, 'Spin').press('Enter')
    else await button(second, 'Spin').click()
    await second.waitForFunction(key => JSON.parse(localStorage.getItem(key)!).stats.spins === 2, SAVE_KEY)
    assert.equal((await read(second)).stats.wagered, 16)
    console.log(`PASS two-tab ${input} Continue and deliberate Spin`)
  } finally {
    await context.close()
  }
}

async function verifyBonuses(browser: Browser, mobile: boolean) {
  const page = await browser.newPage(mobile
    ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }
    : { viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' })
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const activate = (name: string) => mobile ? button(page, name).tap() : button(page, name).click()
  try {
    await initialize(page)
    await activate('Bet size 1')
    await activate('2')
    await button(page, 'Bet size 2').waitFor()
    await activate('Paytable')
    const paytable = page.getByRole('dialog', { name: 'Paytable' })
    const tiger = paytable.getByRole('row', { name: /Tiger/ })
    assert.deepEqual(await tiger.getByRole('cell').allTextContents(), ['6', '44', '110', '400'])
    const paytableText = await paytable.innerText()
    assert.match(paytableText, /16-credit/)
    assert.match(paytableText, /2\.00% per paid spin and 4\.90% per Lantern Free Spin/)
    assert.match(paytableText, /About 28% of complete Lantern features/)
    assert.match(paytableText, /6–7 held 7% per empty cell/)
    assert.match(paytableText, /8 held 6\.3% per empty cell/)
    assert.match(paytableText, /10 held 4\.4% per empty cell/)
    assert.match(paytableText, /0\.03% per qualifying orb/)
    assert.match(paytableText, /0\.003% per qualifying orb/)
    assert.match(paytableText, /4× 64 credits/)
    assert.match(paytableText, /8× 128 credits/)
    await activate('Close')

    await chooseScenario(page, 'sixThenHit')
    await activate('Spin')
    await button(page, 'Respin').waitFor()
    assert.equal(await page.locator('.locked').count(), 6)
    await activate('Respin')
    if (mobile) await page.locator('.cell-mini-reel').first().waitFor()
    await page.reload()
    await button(page, 'Respin').waitFor()
    assert.equal(await page.locator('.locked').count(), 7)
    for (let turn = 2; turn <= 4; turn++) {
      await activate('Respin')
      if (turn === 2) await activate('Stop')
      await page.waitForFunction(({ key, turn }) => {
        const round = JSON.parse(localStorage.getItem(key)!).round
        return turn === 4 ? round.phase === 'BONUS_RESULT' : round.phase === 'BONUS_READY' && round.bonus.turn === turn
      }, { key: SAVE_KEY, turn })
    }
    if (mobile) await page.locator('.collection-dragon').waitFor()
    await activate('Skip')
    const settled = await read(page)
    assert.equal(settled.last?.bonus, 224)
    await page.reload()
    await button(page, 'Continue').waitFor()
    await activate('Continue')
    await waitForPhase(page, 'IDLE')
    assert.equal((await read(page)).balance, 100_000 - 16 + 224)

    await chooseScenario(page, mobile ? 'lanternQueued' : 'lanternRepeat')
    await activate('Spin')
    await waitForPhase(page, 'FREE_INTRO')
    if (mobile) {
      await waitForPhase(page, 'FEATURE_HOLD_RESULT')
      assert.equal(await button(page, 'Continue').count(), 0)
    }
    await waitForPhase(page, 'FREE_COMPLETE')
    await waitForPhase(page, 'IDLE')
    const final = await read(page)
    assert.equal(final.stats.spins, 2)
    assert.equal(final.stats.wagered, 32)
    assert.equal(final.stats.freePlayed, mobile ? 6 : 15)
    assert.equal(final.stats.freeRetriggers, mobile ? 0 : 3)
    assert.equal(final.stats.bonuses, mobile ? 2 : 1)
    assert.equal(final.balance, 100_000 - final.stats.wagered + final.stats.won)
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    assert.deepEqual(errors, [])
    console.log(`PASS ${mobile ? 'mobile touch' : 'desktop'} Paytable, Hold & Spin, reload and automatic Free Spins`)
  } finally {
    await page.close()
  }
}

async function verifyReelChanges(browser: Browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  try {
    await initialize(page)
    await button(page, 'Settings').tap()
    await page.getByLabel('Animation speed').selectOption('0.75')
    await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)!).settings.speed === 0.75, SAVE_KEY)
    await button(page, 'Close').tap()
    await button(page, 'Denomination 1¢').tap()
    await button(page, 'RM1').tap()
    await button(page, 'Denomination RM1').waitFor()
    assert.equal(await page.locator('.orb-value').textContent(), 'RM8')
    await button(page, 'Denomination RM1').tap()
    await button(page, 'RM2').tap()
    await button(page, 'Denomination RM2').waitFor()
    assert.equal(await page.locator('.orb-value').textContent(), 'RM16')
    await button(page, 'Bet size 1').tap()
    await button(page, '5').tap()
    await button(page, 'Bet size 5').waitFor()
    await button(page, 'Denomination RM2').tap()
    await button(page, '10¢').tap()
    await button(page, 'Denomination 10¢').waitFor()
    assert.equal((await read(page)).betting.betSize, 1)
    assert.equal(await page.locator('.orb-value').textContent(), '8')
    await button(page, 'Bet size 1').tap()
    await button(page, '2').tap()
    await button(page, 'Bet size 2').waitFor()
    assert.equal(await page.locator('.orb-value').textContent(), '16')

    await chooseScenario(page, 'lanternBoth')
    await button(page, 'Spin').tap()
    await button(page, 'Stop').waitFor()
    const pending = await read(page)
    assert.equal(pending.round.phase, 'SPINNING')
    assert(await page.locator('.reel-strip .reel-cell').evaluateAll(cells =>
      cells.length > 0 && cells.every(cell => cell.childElementCount === 1)))
    await page.waitForFunction(() => document.querySelector('.reel')?.classList.contains('stopped'))
    const firstReel = page.locator('.reel').first()
    assert.deepEqual(await firstReel.locator('.orb-value').allTextContents(), ['32', '32'])
    assert.equal(await firstReel.locator('.symbol-lantern').count(), 1)
    assert((await page.locator('.reel.spinning').count()) > 0)
    await button(page, 'Stop').tap()
    await waitForPhase(page, 'FREE_INTRO')
    const stopped = await read(page)
    assert.deepEqual(stopped.board, pending.round.spin.board)
    assert.deepEqual(stopped.boardOrbs, pending.round.orbs)
    assert.equal(stopped.stats.spins, 1)
    assert.equal(stopped.stats.wagered, 160)
    console.log('PASS denomination reset, credit and MYR orb faces, visible landing symbols, and touch fast stop')
  } finally {
    await page.close()
  }
}

try {
  const browser = await chromium.launch({ channel: process.env.DRAGON_FORTUNE_BROWSER_CHANNEL })
  try {
    console.log(`Browser ${browser.version()} at ${url}`)
    for (const input of ['mouse', 'keyboard', 'touch'] as const) await verifyTwoTabs(browser, input)
    await verifyReelChanges(browser)
    await verifyBonuses(browser, false)
    await verifyBonuses(browser, true)
  } finally {
    await browser.close()
  }
} finally {
  await new Promise<void>((resolve, reject) => previewServer.httpServer.close(error => error ? reject(error) : resolve()))
}
