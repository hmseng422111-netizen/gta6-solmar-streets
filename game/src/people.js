// Pedestrians for Solmar Streets.
// People wander the sidewalks beside the roads, keep out of buildings, and
// scatter when a car comes at them or a gun goes off. A pedestrian flagged
// as a taxi customer waits at the kerb until a taxi pulls up.

import { PED_COUNT, PED_SPEED, WORLD_W, WORLD_H } from './config.js';
import { roadCenterX, roadCenterY, collideBuildings, clampToWorld } from './city.js';

const SHIRT_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22', '#ecf0f1', '#1abc9c'];

export function makePedestrian(x, y, rng) {
  return {
    x, y,
    angle: rng.range(0, Math.PI * 2),
    speed: PED_SPEED * rng.range(0.7, 1.3),
    color: rng.pick(SHIRT_COLORS),
    state: 'walk',
    waitTime: rng.range(1, 5),
    taxiCustomer: false,
    fleeTime: 0,
  };
}

export function spawnPedestrians(rng) {
  const peds = [];
  for (let i = 0; i < PED_COUNT; i += 1) {
    const col = rng.int(0, 6);
    const row = rng.int(0, 4);
    const x = roadCenterX(col) + rng.range(-46, 46);
    const y = roadCenterY(row) + rng.range(-46, 46);
    peds.push(makePedestrian(x, y, rng));
  }
  return peds;
}

export function stepPedestrian(ped, dt, rng, city, danger) {
  if (ped.fleeTime > 0) {
    ped.fleeTime -= dt;
    ped.x += Math.cos(ped.angle) * PED_SPEED * 2.2 * dt;
    ped.y += Math.sin(ped.angle) * PED_SPEED * 2.2 * dt;
  } else if (ped.state === 'walk') {
    ped.waitTime -= dt;
    if (ped.waitTime <= 0) {
      ped.angle = rng.range(0, Math.PI * 2);
      ped.waitTime = rng.range(2, 6);
    }
    ped.x += Math.cos(ped.angle) * ped.speed * dt;
    ped.y += Math.sin(ped.angle) * ped.speed * dt;
    if (danger) {
      ped.fleeTime = 2;
      ped.angle = Math.atan2(ped.y - danger.y, ped.x - danger.x);
    }
  }
  const clamped = clampToWorld(ped.x, ped.y, 30);
  ped.x = clamped.x;
  ped.y = clamped.y;
  const resolved = collideBuildings(city, ped.x, ped.y, 10);
  ped.x = resolved.x;
  ped.y = resolved.y;
}

// A pedestrian hit by a car is knocked down and stays down.
export function knockDown(ped) {
  ped.state = 'down';
  ped.downTime = 999;
}

export function isDown(ped) {
  return ped.state === 'down';
}
