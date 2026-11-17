// The player: on foot or behind the wheel.
// On foot the player walks and runs, punches, and shoots. In a car the
// player drives it. E enters the nearest car and exits it again; stealing a
// car the player does not own is a crime that raises the wanted level.

import {
  PLAYER_WALK_SPEED, PLAYER_RUN_SPEED, PLAYER_RADIUS, PLAYER_MAX_HEALTH,
  CAR_LENGTH, BULLET_SPEED, BULLET_RANGE, BULLET_DAMAGE,
  PUNCH_RANGE, PUNCH_DAMAGE,
} from './config.js';
import { collideBuildings, clampToWorld } from './city.js';
import { distanceToCar, stepDrivenCar } from './vehicles.js';

export function makePlayer(x, y) {
  return {
    x, y,
    angle: -Math.PI / 2,
    health: PLAYER_MAX_HEALTH,
    cash: 250,
    onFoot: true,
    car: null,
    weapon: 'pistol',
    punchCooldown: 0,
    shootCooldown: 0,
    invulnerable: 0,
  };
}

export function stepPlayerOnFoot(player, dt, input, city) {
  let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const moving = mx !== 0 || my !== 0;
  if (moving) {
    const len = Math.sqrt(mx * mx + my * my);
    mx /= len;
    my /= len;
    player.angle = Math.atan2(my, mx);
    const speed = input.run ? PLAYER_RUN_SPEED : PLAYER_WALK_SPEED;
    const nx = player.x + mx * speed * dt;
    const ny = player.y + my * speed * dt;
    const resolved = collideBuildings(city, nx, ny, PLAYER_RADIUS);
    player.x = resolved.x;
    player.y = resolved.y;
  }
  const clamped = clampToWorld(player.x, player.y, PLAYER_RADIUS + 4);
  player.x = clamped.x;
  player.y = clamped.y;
  if (player.punchCooldown > 0) player.punchCooldown -= dt;
  if (player.shootCooldown > 0) player.shootCooldown -= dt;
  if (player.invulnerable > 0) player.invulnerable -= dt;
  return moving;
}

// Try to enter the nearest car within reach. Returns the car or null.
// Stealing a car that is occupied or parked-but-owned counts as theft.
export function nearestCarToEnter(player, cars, maxDist = 60) {
  let best = null;
  let bestD = maxDist;
  for (const car of cars) {
    if (car.wrecked) continue;
    const d = distanceToCar(player.x, player.y, car);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

export function enterCar(player, car) {
  const wasTheft = car.occupied || car.parked;
  player.onFoot = false;
  player.car = car;
  car.occupied = true;
  car.parked = false;
  player.x = car.x;
  player.y = car.y;
  return wasTheft;
}

export function exitCar(player) {
  if (!player.car) return;
  const car = player.car;
  player.car = null;
  player.onFoot = true;
  player.x = car.x + Math.cos(car.angle + Math.PI / 2) * (CAR_LENGTH / 2 + 24);
  player.y = car.y + Math.sin(car.angle + Math.PI / 2) * (CAR_LENGTH / 2 + 24);
  const clamped = clampToWorld(player.x, player.y, PLAYER_RADIUS + 4);
  player.x = clamped.x;
  player.y = clamped.y;
}

export function stepPlayer(player, dt, input, city) {
  if (player.onFoot) {
    return stepPlayerOnFoot(player, dt, input, city);
  }
  stepDrivenCar(player.car, dt, input, city);
  player.x = player.car.x;
  player.y = player.car.y;
  player.angle = player.car.angle;
  if (player.shootCooldown > 0) player.shootCooldown -= dt;
  return Math.abs(player.car.speed) > 10;
}

// Fire the pistol toward a world point. Returns a bullet or null.
export function shoot(player, targetX, targetY) {
  if (player.shootCooldown > 0 || player.weapon !== 'pistol') return null;
  player.shootCooldown = 0.28;
  const angle = Math.atan2(targetY - player.y, targetX - player.x);
  return {
    x: player.x + Math.cos(angle) * 22,
    y: player.y + Math.sin(angle) * 22,
    vx: Math.cos(angle) * BULLET_SPEED,
    vy: Math.sin(angle) * BULLET_SPEED,
    range: BULLET_RANGE,
    damage: BULLET_DAMAGE,
    angle,
  };
}

// A punch hits the nearest pedestrian or police officer in range.
export function punch(player, targets) {
  if (player.punchCooldown > 0) return null;
  player.punchCooldown = 0.45;
  let best = null;
  let bestD = PUNCH_RANGE;
  for (const t of targets) {
    const dx = t.x - player.x;
    const dy = t.y - player.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < bestD) { bestD = d; best = t; }
  }
  if (best) {
    best.health = (best.health ?? 100) - PUNCH_DAMAGE;
    if (best.health <= 0) best.state = 'down';
  }
  return best;
}

export function hurtPlayer(player, amount) {
  if (player.invulnerable > 0) return;
  player.health -= amount;
  player.invulnerable = 0.6;
}
