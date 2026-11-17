// Screenshot capture for Solmar Streets (Node 22, standard library only).
// Drives the system Chromium over the DevTools protocol with the built-in
// WebSocket client: for each scene in shots.json it opens the game with
// ?shot=<name>&seed=7, waits for window.__shotReady, and saves a JPEG.
// Run: node tools/capture.mjs
//
// The game is loaded from file:// with --allow-file-access-from-files
// because the sandbox browser blocks localhost pages. No browser download
// is needed: the system Chromium at /opt/meta-chromium/chrome is used.

import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const CHROME = '/opt/meta-chromium/chrome';
const here = fileURLToPath(new URL('.', import.meta.url));
const repo = resolve(here, '..');
const shots = JSON.parse(readFileSync(join(repo, 'shots.json'), 'utf8'));

// This Chromium build refuses to start without a WebGL domain policy: a
// file whose first line is the contract version and the rest is a strictly
// sorted list of registrable domains, plus its lowercase hex SHA-256.
const POLICY_FILE = '/home/hatch/workspace/makefun/tools/webgl-policy.txt';
const POLICY_SHA = createHash('sha256').update(readFileSync(POLICY_FILE)).digest('hex');

const PORT = 9333;

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

async function getTargets() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await res.json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page;
    } catch {
      // Chrome is not up yet.
    }
    await sleep(250);
  }
  throw new Error('Chrome DevTools did not come up');
}

function connect(wsUrl) {
  return new Promise((resolvePromise, reject) => {
    const ws = new WebSocket(wsUrl);
    ws.addEventListener('open', () => resolvePromise(ws));
    ws.addEventListener('error', reject);
  });
}

async function call(ws, id, method, params = {}) {
  return new Promise((resolvePromise, reject) => {
    const onMessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id !== id) return;
      ws.removeEventListener('message', onMessage);
      if (msg.error) reject(new Error(`${method}: ${msg.error.message}`));
      else resolvePromise(msg.result);
    };
    ws.addEventListener('message', onMessage);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function captureOne(shot) {
  const url = `file://${join(repo, 'game', 'index.html')}${shot.query}`;
  const chrome = spawn(CHROME, [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--allow-file-access-from-files',
    `--hatch-webgl-allowed-domains-file=${POLICY_FILE}`,
    `--hatch-webgl-allowed-domains-sha256=${POLICY_SHA}`,
    `--remote-debugging-port=${PORT}`,
    '--user-data-dir=/tmp/solmar-chrome-profile',
    '--window-size=1280,720',
    '--hide-scrollbars',
    url,
  ], { stdio: 'ignore' });
  try {
    const page = await getTargets();
    const ws = await connect(page.webSocketDebuggerUrl);
    let id = 1;
    await call(ws, id, 'Page.enable');
    id += 1;
    await call(ws, id, 'Runtime.enable');
    id += 1;
    // Force the viewport to exactly 1280x720: headless Chrome's window
    // size includes browser UI, so the layout viewport comes out shorter.
    // Reload so the game boots at the right size.
    await call(ws, id, 'Emulation.setDeviceMetricsOverride', {
      width: 1280, height: 720, deviceScaleFactor: 1, mobile: false,
    });
    id += 1;
    await call(ws, id, 'Page.reload', { ignoreCache: true });
    id += 1;
    await sleep(500);
    // Wait for the scene to render.
    let ready = false;
    for (let i = 0; i < 60; i += 1) {
      const result = await call(ws, id, 'Runtime.evaluate', {
        expression: 'window.__shotReady === true',
        returnByValue: true,
      });
      id += 1;
      if (result && result.result && result.result.value === true) {
        ready = true;
        break;
      }
      await sleep(500);
    }
    if (!ready) throw new Error(`scene ${shot.name} never became ready`);
    await sleep(300);
    const shotResult = await call(ws, id, 'Page.captureScreenshot', {
      format: 'jpeg',
      quality: 85,
    });
    id += 1;
    const outDir = join(repo, 'screenshots');
    mkdirSync(outDir, { recursive: true });
    const outPath = join(outDir, shot.name);
    writeFileSync(outPath, Buffer.from(shotResult.data, 'base64'));
    const size = statSync(outPath).size;
    console.log(`  ${shot.name}: ${size} bytes${size > 262144 ? ' — OVER 256 KiB!' : ''}`);
    ws.close();
    return size;
  } finally {
    chrome.kill('SIGKILL');
    await sleep(500);
  }
}

for (const shot of shots) {
  console.log(`capturing ${shot.name} (${shot.query})`);
  await captureOne(shot);
}
console.log('done');
