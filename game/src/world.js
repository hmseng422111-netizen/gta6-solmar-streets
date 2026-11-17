// The world simulation for Solmar Streets.
// Pure simulation: no DOM, no canvas, no audio device. The browser shell
// in main.js owns the canvas and the loop; this module owns the state and
// one fixed step of it, so the same code can run headlessly in tests.
// Screens: 'title' | 'playing' | 'paused' | 'busted' | 'wrecked'.

import { START_CASH, SAVE_KEY, CAR_LENGTH } from './config.js';
import { makeRng } from './random.js';
import { generateCity } from './city.js';
import { spawnTraffic, spawnParked, spawnComet, stepTrafficCar } from './vehicles.js';
import { spawnPedestrians, stepPedestrian, knockDown } from './people.js';
import { makePlayer, stepPlayer, nearestCarToEnter, enterCar, exitCar, shoot, punch, hurtPlayer } from './player.js';
import { makePoliceState, addHeat, stepPolice, clearWanted } from './police.js';
import { makeMissionState, stepMissions } from './missions.js';
import { makeAudio } from './audio.js';
import { makeCamera, updateCamera } from './render.js';

export function makeWorld(seed) {
  const rng = makeRng(seed);
  const city = generateCity(rng);
  const safehouse = city.landmarks.safehouse;
  const player = makePlayer(safehouse.doorX, safehouse.doorY + 40);
  player.cash = START_CASH;
  const world = {
    seed,
    rng,
    city,
    player,
    cars: [...spawnParked(rng, city), ...spawnTraffic(rng, city)],
    comet: null,
    peds: spawnPedestrians(rng),
    police: makePoliceState(),
    missions: makeMissionState(),
    bullets: [],
    particles: [],
    time: 0,
    screen: 'title',
    camera: makeCamera(),
    audio: makeAudio(),
    shotReady: false,
    stats: { shotsFired: 0, carsStolen: 0, faresDone: 0 },
  };
  world.comet = spawnComet(city);
  world.cars.push(world.comet);
  loadSave(world);
  updateCamera(world.camera, player.x, player.y);
  return world;
}

export function loadSave(world) {
  try {
    if (typeof localStorage === 'undefined') return;
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const save = JSON.parse(raw);
    if (typeof save.cash === 'number') world.player.cash = save.cash;
    if (typeof save.missionsDone === 'number') {
      world.missions.index = Math.min(save.missionsDone, 3);
      world.missions.stage = 0;
    }
  } catch {
    // A corrupt save never stops the game.
  }
}

export function saveGame(world) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: world.player.cash,
      missionsDone: world.missions.index,
    }));
  } catch {
    // Storage may be unavailable; the game still plays.
  }
}

function addParticles(world, x, y, color, count, size) {
  for (let i = 0; i < count; i += 1) {
    world.particles.push({
      x: x + world.rng.range(-8, 8),
      y: y + world.rng.range(-8, 8),
      vx: world.rng.range(-40, 40),
      vy: world.rng.range(-40, 40),
      life: 0.6,
      maxLife: 0.6,
      color,
      size: size || 3,
    });
  }
}

function stepBullets(world, dt) {
  for (const bullet of world.bullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.range -= Math.sqrt(bullet.vx * bullet.vx + bullet.vy * bullet.vy) * dt;
  }
  world.bullets = world.bullets.filter((b) => b.range > 0);

  // Bullets hit pedestrians and police cars.
  for (const bullet of world.bullets) {
    for (const ped of world.peds) {
      if (ped.state === 'down') continue;
      const dx = ped.x - bullet.x;
      const dy = ped.y - bullet.y;
      if (dx * dx + dy * dy < 100) {
        knockDown(ped);
        bullet.range = 0;
        addHeat(world.police, 60, world.time);
        addParticles(world, ped.x, ped.y, '#e74c3c', 6, 3);
      }
    }
    for (const car of world.police.cars) {
      const dx = car.x - bullet.x;
      const dy = car.y - bullet.y;
      if (dx * dx + dy * dy < 500) {
        car.damage = (car.damage || 0) + 1;
        bullet.range = 0;
        addHeat(world.police, 40, world.time);
        if (car.damage >= 4) {
          car.wrecked = true;
          car.smoke = 1;
        }
      }
    }
  }
  world.bullets = world.bullets.filter((b) => b.range > 0);
}

function stepCollisions(world, dt) {
  const player = world.player;
  // Driving into pedestrians knocks them down and is a crime.
  if (!player.onFoot && player.car) {
    for (const ped of world.peds) {
      if (ped.state === 'down') continue;
      const dx = ped.x - player.x;
      const dy = ped.y - player.y;
      if (dx * dx + dy * dy < (CAR_LENGTH / 2 + 8) ** 2) {
        knockDown(ped);
        addHeat(world.police, 80, world.time);
        world.audio.crash();
        addParticles(world, ped.x, ped.y, '#e74c3c', 8, 3);
      }
    }
    // Ramming traffic cars damages both.
    for (const car of world.cars) {
      if (car === player.car || car.wrecked) continue;
      const dx = car.x - player.x;
      const dy = car.y - player.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < CAR_LENGTH && Math.abs(player.car.speed) > 120) {
        car.damage = (car.damage || 0) + 1;
        player.car.damage = (player.car.damage || 0) + 1;
        player.car.speed *= 0.5;
        addHeat(world.police, 30, world.time);
        world.audio.crash();
        addParticles(world, car.x, car.y, '#f39c12', 8, 3);
        if (car.damage >= 5) car.wrecked = true;
        if (player.car.damage >= 6) {
          player.car.wrecked = true;
          player.car.smoke = 1;
        }
      }
    }
  }
}

export function stepWorld(world, dt, input) {
  if (world.screen !== 'playing') return;
  world.time += dt;
  const player = world.player;

  // Enter or exit a car.
  if (input.pressedEnter) {
    if (player.onFoot) {
      const car = nearestCarToEnter(player, world.cars);
      if (car) {
        const wasTheft = enterCar(player, car);
        if (wasTheft) {
          addHeat(world.police, 100, world.time);
          world.stats.carsStolen += 1;
          world.audio.pickup();
        }
        if (car.type === 'comet') {
          // Stealing the Comet GT is what mission 2 asks for.
          world.missions.cometStolen = true;
        }
      }
    } else {
      exitCar(player);
    }
  }

  const moving = stepPlayer(player, dt, input, world.city);

  // Shooting (mouse or Space) and punching (F).
  if (input.pressedShoot && player.onFoot) {
    const target = input.aim || { x: player.x + Math.cos(player.angle) * 100, y: player.y + Math.sin(player.angle) * 100 };
    const bullet = shoot(player, target.x, target.y);
    if (bullet) {
      world.bullets.push(bullet);
      world.stats.shotsFired += 1;
      world.audio.shot();
      addHeat(world.police, 25, world.time);
      for (const ped of world.peds) {
        const dx = ped.x - player.x;
        const dy = ped.y - player.y;
        if (dx * dx + dy * dy < 260 * 260) {
          ped.fleeTime = 2;
          ped.angle = Math.atan2(ped.y - player.y, ped.x - player.x);
        }
      }
    }
  }
  if (input.pressedPunch && player.onFoot) {
    const hit = punch(player, world.peds);
    if (hit) {
      addHeat(world.police, 40, world.time);
      addParticles(world, hit.x, hit.y, '#e74c3c', 5, 3);
    }
  }

  // Traffic and pedestrians.
  for (const car of world.cars) {
    if (car !== player.car) stepTrafficCar(car, dt, world.rng);
  }
  for (const ped of world.peds) {
    stepPedestrian(ped, dt, world.rng, world.city, null);
  }

  stepPolice(world.police, dt, player, world.rng, world.city, world.time);
  stepBullets(world, dt);
  stepCollisions(world, dt);
  const earned = stepMissions(world.missions, dt, world, (event) => {
    if (event === 'mission-complete') {
      world.audio.jingle();
      world.stats.faresDone += 0;
      saveGame(world);
    }
    if (event === 'stage') world.audio.pickup();
  });
  void earned;

  // Particles.
  for (const p of world.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
  }
  world.particles = world.particles.filter((p) => p.life > 0);

  // Audio follows the car and the wanted level.
  const speed = player.car ? player.car.speed : 0;
  world.audio.step(dt, speed, 430, world.police.wanted);

  // Game over conditions.
  if (world.police.arrested) {
    world.screen = 'busted';
    saveGame(world);
  }
  if (player.health <= 0) {
    world.screen = 'busted';
    saveGame(world);
  }
  if (player.car && player.car.wrecked) {
    world.screen = 'wrecked';
    saveGame(world);
  }

  updateCamera(world.camera, player.x, player.y);
  void moving;
}

export function startGame(world) {
  world.screen = 'playing';
  world.audio.ensure();
  saveGame(world);
}

export function restartGame(world) {
  const seed = world.seed;
  const fresh = makeWorld(seed);
  // Keep the player's saved cash and mission progress.
  fresh.player.cash = world.player.cash;
  fresh.missions.index = world.missions.index;
  Object.assign(world, fresh);
  world.screen = 'playing';
}
