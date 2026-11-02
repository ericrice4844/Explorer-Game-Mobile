// Headless smoke test: plays the opening of a game on a phone-sized viewport
// and fails on any page error. Screenshots go to ./screenshots/.
// Usage: npm run smoke   (requires Playwright + Chromium)
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { startServer } from './serve.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const out = new URL('../screenshots/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });

const port = 8123;
const server = await startServer(port);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

const shot = (name) => page.screenshot({ path: `${out}${name}.png` });
const click = (sel) => page.click(sel);

try {
  await page.goto(`http://localhost:${port}/index.html`);
  await page.waitForTimeout(300);
  await shot('01-title');
  await click('[data-action="new-game"]');
  // Pick nomadic + warlike to get the steppe horde style.
  await click('[data-set="lifestyle"][data-val="nomadic"]');
  await click('[data-set="temperament"][data-val="warlike"]');
  await shot('02-setup');
  await click('[data-action="begin"]');
  await page.waitForTimeout(300);
  await shot('03-start');
  await click('[data-action="close-modal"]');

  // Plan an expedition a few tiles from the capital.
  const target = await page.evaluate(() => {
    const s = window.__game.state;
    const c = s.cities[0];
    return { x: c.x, y: c.y };
  });
  await click('[data-action="mode-explore"]');
  const box = await page.locator('#map').boundingBox();
  // Capital is centred; tap 4 tiles east.
  const ts = await page.evaluate(() => 34);
  await page.mouse.click(box.x + box.width / 2 + ts * 4, box.y + box.height / 2 + ts * 1);
  await page.waitForTimeout(200);
  await shot('04-plan');
  const canLaunch = await page.locator('[data-action="launch"]').isEnabled();
  if (canLaunch) await click('[data-action="launch"]');
  else {
    // Fall back to scouts.
    await click('[data-action="exp-size"][data-id="scouts"]');
    if (await page.locator('[data-action="launch"]').isEnabled()) await click('[data-action="launch"]');
  }
  for (let i = 0; i < 8; i++) {
    await click('[data-action="end-turn"]');
    await page.waitForTimeout(60);
    while (await page.locator('#modal:not(.hidden)').count()) {
      await shot(`05-event-${i}`);
      await click('[data-action="close-modal"]');
    }
  }
  await shot('06-after-turns');
  // Zoom out to see the world.
  for (let i = 0; i < 4; i++) await click('[data-action="zoom-out"]');
  await page.waitForTimeout(150);
  await shot('07-zoomed-out');
  await click('[data-action="advances"]');
  await shot('08-advances');
  await click('#sheet [data-action="close-sheet"].icon-btn');
  await click('[data-action="cities"]');
  await click('#sheet-body [data-action="open-city"]');
  await page.waitForTimeout(100);
  await shot('09-city');
  await click('#sheet [data-action="close-sheet"].icon-btn');
  await click('[data-action="empire"]');
  await shot('10-empire');
  await click('#sheet [data-action="close-sheet"].icon-btn');
  await click('[data-action="peoples"]');
  const civBtn = page.locator('#sheet-body [data-action="open-civ"]').first();
  if (await civBtn.count()) {
    await civBtn.click();
    await page.waitForTimeout(100);
    await shot('11-civ');
  }
  console.log('target', target, 'state', await page.evaluate(() => {
    const s = window.__game.state;
    return { turn: s.turn, explored: s.exploredCount, exps: s.expeditions.length, met: s.civs.filter((c) => c.met).length, log: s.log.map((l) => l.text) };
  }));
} catch (e) {
  errors.push(`Test step failed: ${e.message}`);
  await shot('99-failure').catch(() => {});
} finally {
  await browser.close();
  server.close();
}

if (errors.length) {
  console.error('Smoke test FAILED:\n' + errors.join('\n'));
  process.exit(1);
}
console.log(`Smoke test passed. Screenshots in ${out}`);
