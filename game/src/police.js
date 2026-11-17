// The wanted system: heat rises with crimes and falls when no police can see the player.
// Stars are the floor of heat. Police cars spawn up to the star count, chase and ram; on
// foot, a policeman who stays on the player long enough busts him. A wrecked car, or a
// busted player, ends the run.

import { POLICE, WANTED } from './config.js';
import { createCar } from './vehicles.js';

/** How many stars the current heat is worth, 0 to 5. */
export function starsOf(heat) {
  return Math.max(0, Math.min(WANTED.maxStars, Math.floor(heat)));
}

/** Add heat for a crime, capped at the top of 5 stars. */
export function addHeat(state, amount) {
  state.heat = Math.min(WANTED.maxStars + 0.99, state.heat + amount);
}

/** Decay heat when no police car is near the player. */
export function decayHeat(state, dt, nearestPoliceDist) {
  if (nearestPoliceDist > 650) state.heat = Math.max(0, state.heat - WANTED.decayPerSecond * dt);
}

/** Spawn police cars until the road holds one per star, at a distance, on a road. */
export function maintainPolice(state, dt, city, random) {
  const want = starsOf(state.heat);
  const police = state.police;
  // Remove police that fell too far behind.
  for (let i = police.length - 1; i >= 0; i -= 1) {
    const car = police[i];
    const dist = Math.hypot(car.x - state.player.x, car.y - state.player.y);
    if (dist > POLICE.despawnDistance && want === 0) police.splice(i, 1);
  }
  if (want === 0) return;
  let alive = 0;
  for (let i = 0; i < police.length; i += 1) if (!police[i].wrecked) alive += 1;
  if (alive >= want) return;
  state.spawnTimer -= dt;
  if (state.spawnTimer > 0) return;
  state.spawnTimer = 1.6;
  const angle = random.range(0, Math.PI * 2);
  const x = state.player.x + Math.cos(angle) * POLICE.spawnDistance;
  const y = state.player.y + Math.sin(angle) * POLICE.spawnDistance;
  const car = createCar(random, { x, y, police: true, color: '#2b6cb0' });
  car.targetSpeed = POLICE.chaseSpeed;
  police.push(car);
}

/**
 * Police ramming and busting. Returns 'busted' when the player is caught, 'ram' when a
 * police car hit the player's car this step, else null. `onFootTimer` tracks how long a
 * policeman has stayed on the player on foot.
 */
export function policeContact(state, dt) {
  const player = state.player;
  const px = player.inCar ? player.inCar.x : player.x;
  const py = player.inCar ? player.inCar.y : player.y;
  let nearest = Infinity;
  for (let i = 0; i < state.police.length; i += 1) {
    const car = state.police[i];
    if (car.wrecked) continue;
    const dist = Math.hypot(car.x - px, car.y - py);
    if (dist < nearest) nearest = dist;
    if (player.inCar) {
      if (dist < 52 && car.speed > 120) {
        player.inCar.health -= POLICE.ramDamage;
        car.speed *= 0.5;
        if (player.inCar.health <= 0) {
          player.inCar.wrecked = true;
          return 'wrecked';
        }
        return 'ram';
      }
    } else if (dist < 46) {
      state.bustTimer += dt;
      if (state.bustTimer >= WANTED.bustSeconds) return 'busted';
    }
  }
  if (nearest > 60) state.bustTimer = 0;
  state.nearestPoliceDist = nearest;
  return null;
}
