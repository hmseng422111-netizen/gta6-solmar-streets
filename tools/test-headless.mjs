// Headless tests for Solmar Streets (Node 22, no browser needed).
// The simulation is DOM-free, so the world can be built and stepped in
// plain Node. Rendering is exercised with a fake 2D context that absorbs
// every call and records that the right methods were reached.
// Run: node tools/test-headless.mjs

import { makeWorld, stepWorld, startGame } from '../game/src/world.js';
import { makeShotWorld, SHOT_NAMES } from '../game/src/shots.js';
import { drawWorld } from '../game/src/render.js';
import { drawHud } from '../game/src/hud.js';
import { addHeat, clearWanted } from '../game/src/police.js';
import { enterCar, nearestCarToEnter } from '../game/src/player.js';

let passed = 0;
let failed = 0;

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  PASS ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL ${name} ${detail}`);
  }
}

function makeInput(overrides = {}) {
  return {
    up: false, down: false, left: false, right: false, run: false,
    enter: false, punch: false, shoot: false,
    pressedEnter: false, pressedPunch: false, pressedShoot: false,
    pressedPause: false, pressedRestart: false, anyKey: false,
    aim: { x: 0, y: 0 },
    ...overrides,
  };
}

// A fake 2D context: every method call succeeds, every property set lands.
function fakeCtx() {
  const calls = [];
  const target = { calls, measureText: () => ({ width: 120 }) };
  return new Proxy(target, {
    get(obj, prop) {
      if (prop in obj) return obj[prop];
      if (prop === 'canvas') return { width: 1280, height: 720 };
      return (...args) => {
        calls.push(String(prop));
        return undefined;
      };
    },
    set(obj, prop, value) {
      obj[prop] = value;
      return true;
    },
  });
}

function step(world, seconds, input, dt = 1 / 60) {
  const frames = Math.round(seconds / dt);
  for (let i = 0; i < frames; i += 1) {
    stepWorld(world, dt, input);
    input.pressedEnter = false;
    input.pressedPunch = false;
    input.pressedShoot = false;
  }
}

console.log('Solmar Streets headless tests\n');

// 1. City generation.
{
  const world = makeWorld(7);
  check('city has buildings', world.city.buildings.length > 20, `got ${world.city.buildings.length}`);
  check('city has all 4 landmarks',
    ['club', 'casino', 'docks', 'safehouse'].every((k) => !!world.city.landmarks[k]));
  check('docks sit on the beach', world.city.landmarks.docks.x > 2320);
  check('player starts at the safehouse',
    Math.abs(world.player.x - world.city.landmarks.safehouse.doorX) < 5);
  check('starting cash is $250', world.player.cash === 250);
  check('traffic and parked cars exist', world.cars.length >= 20, `got ${world.cars.length}`);
  check('pedestrians exist', world.peds.length >= 20, `got ${world.peds.length}`);
}

// 2. Thirty seconds of free roaming with no errors.
{
  const world = makeWorld(7);
  startGame(world);
  const input = makeInput();
  const startX = world.player.x;
  const startY = world.player.y;
  const dirs = ['up', 'right', 'down', 'left'];
  for (let s = 0; s < 30; s += 1) {
    input.up = dirs[s % 4] === 'up';
    input.right = dirs[s % 4] === 'right';
    input.down = dirs[s % 4] === 'down';
    input.left = dirs[s % 4] === 'left';
    step(world, 1, input);
  }
  check('30s free roam completes', world.time >= 29.9, `time=${world.time.toFixed(2)}`);
  check('player moved while roaming',
    Math.abs(world.player.x - startX) + Math.abs(world.player.y - startY) > 50);
  check('still playing after free roam', world.screen === 'playing');
}

// 3. Driving: enter a car and drive.
{
  const world = makeWorld(7);
  startGame(world);
  const car = world.cars.find((c) => c.parked);
  world.player.x = car.x + 10;
  world.player.y = car.y;
  const input = makeInput({ pressedEnter: true });
  stepWorld(world, 1 / 60, input);
  check('entering a parked car works', !world.player.onFoot && world.player.car === car);
  check('stealing raises wanted', world.police.wanted >= 1, `wanted=${world.police.wanted}`);
  const beforeX = world.player.x;
  const beforeY = world.player.y;
  const drive = makeInput({ up: true });
  step(world, 3, drive);
  check('car accelerates', Math.abs(world.player.car.speed) > 50, `speed=${world.player.car.speed.toFixed(0)}`);
  check('car moved',
    Math.abs(world.player.x - beforeX) + Math.abs(world.player.y - beforeY) > 50);
  const exit = makeInput({ pressedEnter: true });
  stepWorld(world, 1 / 60, exit);
  check('exiting the car works', world.player.onFoot && world.player.car === null);
}

// 4. Wanted level rises and falls.
{
  const world = makeWorld(7);
  startGame(world);
  addHeat(world.police, 250);
  check('heat sets 2 stars', world.police.wanted === 2, `wanted=${world.police.wanted}`);
  step(world, 6, makeInput());
  check('police cars spawn', world.police.cars.length > 0, `cars=${world.police.cars.length}`);
  // Escape: no police car nearby and no fresh crime, so the heat cools off.
  world.police.cars = [];
  world.police.lastCrimeAt = -100;
  world.player.x = 200;
  world.player.y = 200;
  step(world, 21, makeInput());
  check('wanted decays out of sight', world.police.wanted === 0, `wanted=${world.police.wanted}`);
  clearWanted(world.police);
  check('clearWanted resets', world.police.wanted === 0 && world.police.heat === 0);
}

// 5. Mission 1 pays $800.
{
  const world = makeWorld(7);
  startGame(world);
  const before = world.player.cash;
  const docks = world.city.landmarks.docks;
  world.player.x = docks.doorX;
  world.player.y = docks.doorY;
  step(world, 0.2, makeInput());
  check('mission 1 stage 1 completes', world.missions.stage === 1, `stage=${world.missions.stage}`);
  const club = world.city.landmarks.club;
  world.player.x = club.doorX;
  world.player.y = club.doorY;
  step(world, 0.2, makeInput());
  check('mission 1 pays $800', world.player.cash === before + 800, `cash=${world.player.cash}`);
  check('mission 2 is next', world.missions.index === 1);
}

// 6. Mission 3 vault pays $5000.
{
  const world = makeWorld(7);
  startGame(world);
  world.missions.index = 2;
  world.missions.stage = 0;
  const before = world.player.cash;
  const casino = world.city.landmarks.casino;
  world.player.x = casino.doorX;
  world.player.y = casino.doorY;
  step(world, 5.5, makeInput());
  check('vault cracks after 5s on foot', world.missions.stage === 1, `stage=${world.missions.stage}`);
  const safe = world.city.landmarks.safehouse;
  world.player.x = safe.doorX;
  world.player.y = safe.doorY;
  step(world, 0.2, makeInput());
  check('mission 3 pays $5000', world.player.cash === before + 5000, `cash=${world.player.cash}`);
  check('all missions complete', world.missions.index === 3);
}

// 7. Shooting.
{
  const world = makeWorld(7);
  startGame(world);
  const input = makeInput({
    pressedShoot: true,
    aim: { x: world.player.x + 100, y: world.player.y },
  });
  stepWorld(world, 1 / 60, input);
  check('shooting creates a bullet', world.bullets.length === 1);
  check('shooting is recorded', world.stats.shotsFired === 1);
  step(world, 1, makeInput());
  check('bullet travels and expires', world.bullets.length === 0);
}

// 8. All screens render without errors.
{
  for (const screen of ['title', 'playing', 'paused', 'busted', 'wrecked']) {
    const world = makeWorld(7);
    world.screen = screen;
    const ctx = fakeCtx();
    try {
      drawWorld(ctx, world);
      drawHud(ctx, world);
      check(`screen "${screen}" renders`, ctx.calls.length > 50, `calls=${ctx.calls.length}`);
    } catch (err) {
      check(`screen "${screen}" renders`, false, String(err));
    }
  }
}

// 9. The 4 fixed scenes render.
{
  for (const name of SHOT_NAMES) {
    const world = makeShotWorld(name, 7);
    const ctx = fakeCtx();
    try {
      drawWorld(ctx, world);
      drawHud(ctx, world);
      const expected = { start: 'title', chase: 'playing', mission: 'playing', over: 'wrecked' }[name];
      check(`shot "${name}" renders (screen=${world.screen})`,
        ctx.calls.length > 50 && world.screen === expected);
    } catch (err) {
      check(`shot "${name}" renders`, false, String(err));
    }
  }
}

// 10. Determinism: same seed, same city.
{
  const a = makeWorld(7);
  const b = makeWorld(7);
  const same = JSON.stringify(a.city.buildings) === JSON.stringify(b.city.buildings)
    && JSON.stringify(a.city.landmarks) === JSON.stringify(b.city.landmarks);
  check('seed 7 builds the same city twice', same);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
