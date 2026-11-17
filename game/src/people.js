// Pedestrians: they stroll the sidewalks, cross at intersections, and run from gunfire.
// A pedestrian is a point with a heading and a walk speed; a scared one runs twice as fast
// and, after a while, calms down. One of them may be a taxi fare: stand next to a pedestrian
// with a "!" over their head and press E to pick them up.

import { randomSidewalkPoint } from './city.js';

const PED_COLORS = ['#f2e6d8', '#e8b48a', '#8a6f5a', '#d8a0a0', '#a0c4d8', '#c4d8a0'];

export function createPedestrian(random, x, y) {
  const point = x !== undefined ? { x, y } : randomSidewalkPoint(random);
  return {
    x: point.x,
    y: point.y,
    angle: random.range(0, Math.PI * 2),
    speed: random.range(45, 75),
    color: random.pick(PED_COLORS),
    scared: 0,
    fare: false,
    retarget: 0,
  };
}

/** Walk a pedestrian; a scared one runs away from the scare point. */
export function stepPedestrian(ped, dt, random, scareX, scareY) {
  if (ped.scared > 0) {
    ped.scared -= dt;
    const away = Math.atan2(ped.y - scareY, ped.x - scareX);
    ped.angle = away;
    ped.x += Math.cos(away) * ped.speed * 2 * dt;
    ped.y += Math.sin(away) * ped.speed * 2 * dt;
    return;
  }
  ped.retarget -= dt;
  if (ped.retarget <= 0) {
    ped.retarget = random.range(2, 6);
    ped.angle += random.range(-1.2, 1.2);
  }
  ped.x += Math.cos(ped.angle) * ped.speed * dt;
  ped.y += Math.sin(ped.angle) * ped.speed * dt;
}

/** Scare every pedestrian near a point (a gunshot, a crash, a siren). */
export function scareNearby(peds, x, y, radius) {
  for (let i = 0; i < peds.length; i += 1) {
    const ped = peds[i];
    const dx = ped.x - x;
    const dy = ped.y - y;
    if (dx * dx + dy * dy < radius * radius) ped.scared = 4;
  }
}
