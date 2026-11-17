// Take the entry's screenshots: serves game/ on localhost, opens each ?shot= scene in
// a desktop browser at 1280x720, waits for window.__shotReady, and saves a JPEG of at
// most 256 KiB under screenshots/.
//
// Needs a desktop Chromium: either Playwright's own (`npx playwright install chromium`)
// or a system Chrome, named by CHROME_PATH. Run from the entry's root:
//   node tools/capture.mjs
//   CHROME_PATH=/usr/bin/google-chrome node tools/capture.mjs
//
// The shots are real renders of the game's own code: each ?shot= scene plays the real
// rules forward from a fixed seed, so the same seed always gives the same frame.

import { spawn } from 'node:child_process';
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const here = fileURLToPath(new URL('..', import.meta.url));
const shots = JSON.parse(readFileSync(join(here, 'shots.json'), 'utf8'));
const port = 8123;

const server = spawn('node', ['serve.ts', '--port', String(port)], { cwd: here, stdio: 'ignore' });
await new Promise((resolve) => setTimeout(resolve, 1200));

const launchOpts = { headless: true };
if (process.env.CHROME_PATH) launchOpts.executablePath = process.env.CHROME_PATH;
const browser = await chromium.launch(launchOpts);
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
for (const shot of shots) {
  await page.goto(`http://localhost:${port}/${shot.query}`, { waitUntil: 'load' });
  await page.waitForFunction('window.__shotReady === true', null, { timeout: 30000 });
  const out = join(here, 'screenshots', shot.name);
  await page.screenshot({ path: out, type: 'jpeg', quality: 82 });
  const size = statSync(out).size;
  console.log(`${shot.name}: ${size} bytes${size > 262144 ? ' — OVER THE 256 KiB CAP, re-encode smaller' : ''}`);
}
await browser.close();
server.kill();
console.log('done');
