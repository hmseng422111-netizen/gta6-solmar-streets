// Police and the wanted system for Solmar Streets.
// Crimes add heat; heat sets the wanted level from 0 to 5 stars. Police
// cars spawn at the edge of the player's view and chase: they steer toward
// the player, ram the player's car, and on foot they close in to make an
// arrest. Stay out of every officer's sight and the heat cools off.

import {
  WANTED_MAX, POLICE_TOP_SPEED, POLICE_SPAWN_INTERVAL,
  POLICE_COLOR, ARREST_SECONDS, WANTED_DECAY_SECONDS, WORLD_W, WORLD_H,
} from './config.js';
import { makeCar } from './vehicles.js';
import { nearestRoadPoint, collideBuildings } from './city.js';

const HEAT_PER_STAR = 100;
// A police car counts as seeing the player inside this range.
const SIGHT_RANGE = 500;
// Reinforcements only arrive while the heat is fresh; after this long with
// no new crime, no more cars spawn and the player can slip away.
const FRESH_HEAT_SECONDS = 20;

export function makePoliceState() {
  return {
    wanted: 0,
    heat: 0,
    cars: [],
    spawnTimer: 0,
    unseenTimer: 0,
    arrestTimer: 0,
    lastCrimeAt: -Infinity,
    arrested: false,
  };
}

// Crimes the world reports. Each adds heat; the wanted level follows.
export function addHeat(police, amount, now = 0) {
  police.heat = Math.min(WANTED_MAX * HEAT_PER_STAR, police.heat + amount);
  const level = Math.min(WANTED_MAX, Math.floor(police.heat / HEAT_PER_STAR));
  if (level > police.wanted) police.wanted = level;
  police.unseenTimer = 0;
  police.lastCrimeAt = now;
}

export function wantedLevel(police) {
  return police.wanted;
}

function spawnPoliceCar(police, player, rng) {
  const edge = rng.int(0, 3);
  const margin = 120;
  let x;
  let y;
  const dist = rng.range(750, 1000);
  if (edge === 0) { x = player.x - dist; y = player.y + rng.range(-400, 400); }
  else if (edge === 1) { x = player.x + dist; y = player.y + rng.range(-400, 400); }
  else if (edge === 2) { x = player.x + rng.range(-400, 400); y = player.y - dist; }
  else { x = player.x + rng.range(-400, 400); y = player.y + dist; }
  x = Math.max(margin, Math.min(WORLD_W - margin, x));
  y = Math.max(margin, Math.min(WORLD_H - margin, y));
  // Spawn on a road, so the car arrives driving, not through a building.
  const road = nearestRoadPoint(x, y);
  x = road.x;
  y = road.y;
  const car = makeCar(x, y, Math.atan2(player.y - y, player.x - x), {
    color: POLICE_COLOR, type: 'police', occupied: true, parked: false,
  });
  car.speed = POLICE_TOP_SPEED * 0.7;
  police.cars.push(car);
  return car;
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function stepPolice(police, dt, player, rng, city, now = 0) {
  // How many cars the wanted level calls for. Reinforcements only arrive
  // while the heat is fresh.
  const wantedCount = police.wanted === 0 ? 0 : Math.min(2 + police.wanted, 7);
  police.spawnTimer -= dt;
  const fresh = now - police.lastCrimeAt < FRESH_HEAT_SECONDS;
  if (police.cars.length < wantedCount && police.spawnTimer <= 0 && fresh) {
    spawnPoliceCar(police, player, rng);
    police.spawnTimer = POLICE_SPAWN_INTERVAL;
  }

  let anySeesPlayer = false;
  for (const car of police.cars) {
    const dx = player.x - car.x;
    const dy = player.y - car.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < SIGHT_RANGE) anySeesPlayer = true;

    // Steer toward the player and drive at them.
    const target = Math.atan2(dy, dx);
    const diff = angleDiff(target, car.angle);
    car.angle += Math.max(-3.2 * dt, Math.min(3.2 * dt, diff));
    const wantSpeed = dist > 120 ? POLICE_TOP_SPEED : POLICE_TOP_SPEED * 0.55;
    car.speed += (wantSpeed - car.speed) * Math.min(1, dt * 1.5);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    // Buildings are solid for police too: they slow down and slide along
    // them instead of driving straight through the city.
    const resolved = collideBuildings(city, car.x, car.y, 24);
    if (resolved.hit) car.speed *= 0.6;
    car.x = resolved.x;
    car.y = resolved.y;

    // Ramming the player's car damages it; touching the player on foot
    // starts an arrest.
    if (player.car && dist < 52 && Math.abs(car.speed) > 60) {
      player.car.damage = (player.car.damage || 0) + 1;
      car.speed *= 0.5;
      if (player.car.damage >= 6) {
        player.car.wrecked = true;
        player.car.smoke = 1;
      }
    }
    if (player.onFoot && dist < 46) {
      police.arrestTimer += dt;
      if (police.arrestTimer >= ARREST_SECONDS) {
        police.arrested = true;
      }
    }
  }

  // Cars that fell far behind despawn.
  police.cars = police.cars.filter((car) => {
    const dx = car.x - player.x;
    const dy = car.y - player.y;
    return Math.sqrt(dx * dx + dy * dy) < 1600;
  });

  if (police.wanted > 0) {
    if (anySeesPlayer) {
      police.unseenTimer = 0;
      if (player.onFoot) police.arrestTimer = Math.max(0, police.arrestTimer - dt * 0.5);
    } else {
      police.unseenTimer += dt;
      if (police.unseenTimer >= WANTED_DECAY_SECONDS) {
        police.heat = Math.max(0, police.heat - HEAT_PER_STAR);
        police.wanted = Math.min(WANTED_MAX, Math.floor(police.heat / HEAT_PER_STAR));
        police.unseenTimer = 0;
      }
    }
  }
  if (player.onFoot) {
    const near = police.cars.some((car) => {
      const dx = car.x - player.x;
      const dy = car.y - player.y;
      return Math.sqrt(dx * dx + dy * dy) < 46;
    });
    if (!near) police.arrestTimer = 0;
  }
}

export function clearWanted(police) {
  police.wanted = 0;
  police.heat = 0;
  police.cars = [];
  police.arrestTimer = 0;
  police.unseenTimer = 0;
  police.lastCrimeAt = -Infinity;
}
