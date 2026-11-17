// The player, Rio: on foot he walks, runs and fights; in a car he drives it. Entering a
// car parks the player inside it; leaving puts him back on the street beside it. Combat on
// foot is a punch up close and a pistol at range, with ammo to manage.

import { CAR, PLAYER } from './config.js';
import { resolveBuildingCollision } from './city.js';
import { carsTouch } from './vehicles.js';

export function createPlayer(x, y) {
  return {
    x,
    y,
    angle: 0,
    health: PLAYER.health,
    ammo: PLAYER.pistolAmmo,
    inCar: null,
    punchCooldown: 0,
    shootCooldown: 0,
    invulnerable: 0,
  };
}

/** Move the player on foot; returns true when he moved. */
export function stepPlayerOnFoot(player, dt, city, input) {
  const dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  if (dx === 0 && dy === 0) return false;
  const running = input.run;
  const speed = running ? PLAYER.runSpeed : PLAYER.walkSpeed;
  const length = Math.hypot(dx, dy);
  player.x += (dx / length) * speed * dt;
  player.y += (dy / length) * speed * dt;
  player.angle = Math.atan2(dy, dx);
  // The resolver moves the body it is given, so pass the player itself.
  resolveBuildingCollision(city, player);
  player.x = Math.max(20, Math.min(3580, player.x));
  player.y = Math.max(20, Math.min(2580, player.y));
  return true;
}

/**
 * The nearest car the player can enter (parked, traffic or police), within reach and not
 * wrecked; null when none is close enough.
 */
export function nearestEnterableCar(player, cars) {
  let best = null;
  let bestDist = 70;
  for (let i = 0; i < cars.length; i += 1) {
    const car = cars[i];
    if (car.wrecked) continue;
    const dist = Math.hypot(car.x - player.x, car.y - player.y);
    if (dist < bestDist) {
      bestDist = dist;
      best = car;
    }
  }
  return best;
}

/** Step out of the car onto the street beside it. */
export function exitCar(player, car) {
  player.inCar = null;
  player.x = car.x - Math.sin(car.angle) * 46;
  player.y = car.y + Math.cos(car.angle) * 46;
  player.angle = car.angle;
}

/** A punch: hits the nearest car or pedestrian in range, on a short cooldown. */
export function punch(player, cars, peds) {
  if (player.punchCooldown > 0) return null;
  player.punchCooldown = 0.45;
  const reach = PLAYER.punchRange + 20;
  for (let i = 0; i < cars.length; i += 1) {
    const car = cars[i];
    if (car.wrecked) continue;
    if (Math.hypot(car.x - player.x, car.y - player.y) < reach) return { type: 'car', car };
  }
  for (let i = 0; i < peds.length; i += 1) {
    const ped = peds[i];
    if (Math.hypot(ped.x - player.x, ped.y - player.y) < reach) return { type: 'ped', ped };
  }
  return { type: 'air' };
}

/** A pistol shot toward a point: hits the first car or pedestrian near the line. */
export function shoot(player, targetX, targetY, cars, peds) {
  if (player.shootCooldown > 0 || player.ammo <= 0) return null;
  player.shootCooldown = 0.28;
  player.ammo -= 1;
  player.angle = Math.atan2(targetY - player.y, targetX - player.x);
  const dx = targetX - player.x;
  const dy = targetY - player.y;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  let best = null;
  let bestAlong = PLAYER.pistolRange;
  const scan = (x, y, kind, ref) => {
    const along = (x - player.x) * ux + (y - player.y) * uy;
    if (along < 0 || along > bestAlong) return;
    const across = Math.abs((x - player.x) * uy - (y - player.y) * ux);
    if (across < 26) {
      bestAlong = along;
      best = { kind, ref, x, y };
    }
  };
  for (let i = 0; i < cars.length; i += 1) {
    const car = cars[i];
    if (!car.wrecked) scan(car.x, car.y, 'car', car);
  }
  for (let i = 0; i < peds.length; i += 1) scan(peds[i].x, peds[i].y, 'ped', peds[i]);
  return { hit: best, fromX: player.x, fromY: player.y, toX: player.x + ux * Math.min(bestAlong, PLAYER.pistolRange), toY: player.y + uy * Math.min(bestAlong, PLAYER.pistolRange) };
}

/** Tick the player's cooldowns down. */
export function tickCooldowns(player, dt) {
  player.punchCooldown = Math.max(0, player.punchCooldown - dt);
  player.shootCooldown = Math.max(0, player.shootCooldown - dt);
  player.invulnerable = Math.max(0, player.invulnerable - dt);
}

/** True when the player's car touches another car (a crash). */
export function playerCarTouches(player, other) {
  if (!player.inCar) return false;
  return carsTouch(player.inCar, other);
}
