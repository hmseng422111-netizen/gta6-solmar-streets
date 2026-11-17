// Headless test for Solmar Streets: stubs the browser (window, document, canvas,
// localStorage) and then runs the real game logic — world steps, mission flow, police,
// fares, the staged screenshot scenes and every draw call — catching any exception.
// Run from the entry's root:  node tools/test-headless.mjs
// This file is a development test only; it is not part of the submitted entry.

const store = new Map();
globalThis.window = {
  innerWidth: 1280,
  innerHeight: 720,
  devicePixelRatio: 1,
  location: { search: '' },
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
  },
  addEventListener: () => {},
  requestAnimationFrame: () => 0,
  performance: { now: () => 0 },
  AudioContext: undefined,
  webkitAudioContext: undefined,
};
globalThis.document = {
  getElementById: () => fakeCanvas(),
  addEventListener: () => {},
};
globalThis.performance = { now: () => Date.now() };
globalThis.requestAnimationFrame = () => 0;

function fakeContext() {
  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'canvas') return {};
        if (prop === 'measureText') return () => ({ width: 0 });
        return (..._args) => {};
      },
      set() {
        return true;
      },
    },
  );
}
function fakeCanvas() {
  return {
    width: 1280,
    height: 720,
    getContext: () => fakeContext(),
    addEventListener: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }),
  };
}

const failures = [];
function check(name, fn) {
  try {
    fn();
    console.log(`ok   ${name}`);
  } catch (error) {
    failures.push(name);
    console.log(`FAIL ${name}: ${error.message}`);
  }
}

const { createRandom } = await import('../game/src/random.js');
const { createCity, onRoad, insideBuilding } = await import('../game/src/city.js');
const { createWorld, EVENT_OVER } = await import('../game/src/world.js');
const { createRenderer, SCREEN_TITLE, SCREEN_PLAY, SCREEN_OVER, SCREEN_BUSTED, SCREEN_PAUSED } = await import('../game/src/render.js');
const { stageShot } = await import('../game/src/shots.js');
const { loadSave } = await import('../game/src/missions.js');

const random = createRandom(7);
const save = loadSave();
const world = createWorld(random, save);
const renderer = createRenderer(fakeCanvas());

check('city builds: buildings and parks', () => {
  const city = createCity(createRandom(7));
  if (city.buildings.length < 50) throw new Error(`only ${city.buildings.length} buildings`);
  if (city.parks.length < 5) throw new Error(`only ${city.parks.length} parks`);
  if (onRoad(400, 400) !== true) throw new Error('road point not on a road');
  if (onRoad(200, 200) !== false) throw new Error('block point counted as a road');
  if (!insideBuilding(city, city.buildings[0].x + 5, city.buildings[0].y + 5)) throw new Error('building test failed');
});

check('world steps 30s of free roam without errors', () => {
  const idle = { up: false, down: false, left: false, right: false, run: false, enter: false, enterHeld: false, punch: false, shootAt: null };
  for (let i = 0; i < 1800; i += 1) world.step(1 / 60, idle);
  const s = world.state;
  if (s.cars.length < 10) throw new Error('traffic missing');
  if (s.peds.length < 10) throw new Error('pedestrians missing');
  console.log(`     after 30s: traffic=${s.cars.length} peds=${s.peds.length} heat=${s.heat.toFixed(2)} cash=$${s.save.cash}`);
});

check('driving: enter a car and drive 10s straight down a road', () => {
  const s = world.state;
  // Put the player in a parked car on a road, facing east, and drive straight.
  const car = s.cars.find((c) => c.parked && !c.sports);
  car.x = 400;
  car.y = 1200;
  car.angle = 0;
  s.player.x = car.x + 20;
  s.player.y = car.y;
  s.player.inCar = car;
  car.parked = false;
  const before = { x: car.x, y: car.y };
  for (let i = 0; i < 600; i += 1) {
    world.step(1 / 60, { up: true, down: false, left: false, right: false, enter: false, enterHeld: false, punch: false, shootAt: null });
  }
  const moved = Math.hypot(car.x - before.x, car.y - before.y);
  if (moved < 2500) throw new Error(`car barely moved: ${moved.toFixed(0)}px`);
  console.log(`     car moved ${moved.toFixed(0)}px, speed ${car.speed.toFixed(0)}`);
});

check('wanted: heat spawns police, police chase', () => {
  const s = world.state;
  s.heat = 3.4;
  for (let i = 0; i < 600; i += 1) {
    world.step(1 / 60, { up: true, down: false, left: false, right: false, enter: false, enterHeld: false, punch: false, shootAt: null });
    if (s.over) break;
  }
  if (s.police.length === 0) throw new Error('no police spawned at 3 stars');
  console.log(`     police cars: ${s.police.length}, nearest ${Math.round(s.nearestPoliceDist)}px, over=${s.over}`);
});

check('mission 1: drive to the docks and the club', () => {
  const w2 = createWorld(createRandom(11), loadSave());
  const mission = w2.startMission();
  if (!mission || mission.mission.id !== 'pickup') throw new Error('first mission is not the pickup');
  const s = w2.state;
  // Teleport the player (in a car) onto each objective in turn.
  const car = s.cars.find((c) => c.parked);
  s.player.inCar = car;
  car.parked = false;
  for (const objective of mission.mission.objectives) {
    car.x = objective.x;
    car.y = objective.y;
    s.player.x = objective.x;
    s.player.y = objective.y;
    w2.step(1 / 60, { up: false, down: false, left: false, right: false, enter: false, enterHeld: false, punch: false, shootAt: null });
  }
  if (s.mission !== null) throw new Error('mission did not complete');
  if (s.save.cash < 800) throw new Error(`mission reward not paid, cash=$${s.save.cash}`);
  console.log(`     mission paid, cash=$${s.save.cash}, missionsDone=${s.save.missionsDone}`);
});

check('mission 3 vault: hold E to crack it', () => {
  const w3 = createWorld(createRandom(13), loadSave());
  w3.state.save.missionsDone = 2;
  const mission = w3.startMission();
  if (!mission || mission.mission.id !== 'bigscore') throw new Error('third mission is not the big score');
  const s = w3.state;
  const car = s.cars.find((c) => c.parked);
  s.player.inCar = car;
  car.parked = false;
  // Reach the casino, then hold E for the vault.
  car.x = 2000;
  car.y = 1400;
  s.player.x = 2000;
  s.player.y = 1400;
  w3.step(1 / 60, { up: false, down: false, left: false, right: false, enter: false, enterHeld: false, punch: false, shootAt: null });
  for (let i = 0; i < 240; i += 1) {
    w3.step(1 / 60, { up: false, down: false, left: false, right: false, enter: false, enterHeld: true, punch: false, shootAt: null });
  }
  if (s.vaultProgress >= 1) throw new Error('vault should have cracked and reset progress');
  if (s.mission === null) throw new Error('mission should still be active (escape left)');
  console.log(`     vault cracked, heat=${s.heat.toFixed(1)}, objective now: ${s.mission.mission.objectives[s.mission.objectiveIndex].id}`);
});

check('shooting: pistol fires, tracer recorded, ammo spent', () => {
  const w4 = createWorld(createRandom(17), loadSave());
  const s = w4.state;
  const ammoBefore = s.player.ammo;
  w4.step(1 / 60, { up: false, down: false, left: false, right: false, enter: false, enterHeld: false, punch: false, shootAt: { x: s.player.x + 200, y: s.player.y } });
  if (s.player.ammo !== ammoBefore - 1) throw new Error('ammo did not decrease');
  if (s.tracers.length === 0) throw new Error('no tracer recorded');
});

check('draw: every screen paints without errors', () => {
  const s = world.state;
  for (const screen of [SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_OVER, SCREEN_BUSTED]) renderer.draw(s, screen);
});

check('shots: all four scenes stage and paint', () => {
  for (const name of ['start', 'chase', 'mission', 'over']) {
    const scene = stageShot(name, world);
    renderer.draw(world.state, scene.screen);
    console.log(`     shot ${name}: screen=${scene.screen} heat=${world.state.heat.toFixed(1)} over=${world.state.over}`);
  }
});

console.log(failures.length === 0 ? 'ALL TESTS PASSED' : `${failures.length} FAILURES: ${failures.join(', ')}`);
process.exit(failures.length === 0 ? 0 : 1);
