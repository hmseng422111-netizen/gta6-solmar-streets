// The world: everything the game is, in one state object, and the step that moves it.
// One fixed step (1/60 s) advances the player, the traffic, the pedestrians, the police,
// the missions and the taxi fares, and reports what happened as event flags. The renderer
// only reads this state; the audio only listens to the events.

import { CAR, FIELD, PED_COUNT, PLAYER, TRAFFIC_COUNT, WANTED, WORLD } from './config.js';
import { createCity, LANDMARKS, randomRoadPoint, randomSidewalkPoint } from './city.js';
import { createCar, carsTouch, stepPlayerCar, stepPoliceCar, stepTrafficCar } from './vehicles.js';
import { createPedestrian, scareNearby, stepPedestrian } from './people.js';
import { createPlayer, exitCar, nearestEnterableCar, punch, shoot, stepPlayerOnFoot, tickCooldowns } from './player.js';
import { addHeat, decayHeat, maintainPolice, policeContact, starsOf } from './police.js';
import { advanceObjective, createFare, currentObjective, startNextMission, storeSave } from './missions.js';

export const EVENT_HIT = 1;
export const EVENT_OVER = 2;
export const EVENT_BUSTED = 4;
export const EVENT_MISSION = 8;
export const EVENT_CASH = 16;
export const EVENT_SHOOT = 32;
export const EVENT_CRASH = 64;

/** A fresh world: the city, Rio at the safehouse, traffic, pedestrians and parked cars. */
export function createWorld(random, save) {
  const city = createCity(random);
  const player = createPlayer(LANDMARKS.safehouse.x, LANDMARKS.safehouse.y);
  const cars = [];
  for (let i = 0; i < TRAFFIC_COUNT; i += 1) cars.push(createCar(random));
  // Parked cars, one of them the Comet GT at the marina lot. Every spot is on a road:
  // a parked car inside a block would sit in a building and never move.
  const parkedSpots = [
    { x: LANDMARKS.marina.x, y: LANDMARKS.marina.y, sports: true, color: '#e8c94d' },
    { x: 800, y: 1200, sports: false },
    { x: 2000, y: 1200, sports: false },
    { x: 2800, y: 1200, sports: false },
    { x: 1200, y: 2000, sports: false },
    { x: 400, y: 2000, sports: false },
  ];
  for (const spot of parkedSpots) {
    cars.push(createCar(random, { x: spot.x, y: spot.y, parked: true, sports: spot.sports, color: spot.color }));
  }
  const peds = [];
  for (let i = 0; i < PED_COUNT; i += 1) peds.push(createPedestrian(random));
  const pickups = [];
  for (let i = 0; i < 4; i += 1) {
    const p = randomRoadPoint(random);
    pickups.push({ x: p.x, y: p.y, kind: 'ammo' });
  }
  for (let i = 0; i < 3; i += 1) {
    const p = randomSidewalkPoint(random);
    pickups.push({ x: p.x, y: p.y, kind: 'health' });
  }
  const state = {
    random,
    city,
    save,
    time: 0,
    player,
    cars,
    peds,
    police: [],
    pickups,
    tracers: [],
    particles: [],
    heat: 0,
    bustTimer: 0,
    spawnTimer: 0,
    nearestPoliceDist: Infinity,
    mission: null,
    fare: null,
    fareTimer: 8,
    vaultProgress: 0,
    toast: '',
    toastTimer: 0,
    runCash: 0,
    camera: { x: player.x, y: player.y },
    over: false,
    busted: false,
  };
  return {
    state,
    /** Advance the world one fixed step. `input` holds keys and one-shot flags. */
    step(dt, input) {
      return stepWorld(state, dt, input);
    },
    /** Start the next story job, or null when all three are done. */
    startMission() {
      state.mission = startNextMission(state.save);
      return state.mission;
    },
    reset() {
      const fresh = createWorld(state.random, state.save);
      Object.assign(state, fresh.state);
    },
  };
}

function toast(state, message, seconds = 3) {
  state.toast = message;
  state.toastTimer = seconds;
}

function burst(state, x, y, color, count) {
  for (let i = 0; i < count; i += 1) {
    state.particles.push({
      x,
      y,
      vx: state.random.range(-160, 160),
      vy: state.random.range(-160, 160),
      life: 0.6,
      maxLife: 0.6,
      color,
    });
  }
}

function stepWorld(state, dt, input) {
  const player = state.player;
  const random = state.random;
  let events = 0;
  state.time += dt;
  state.toastTimer = Math.max(0, state.toastTimer - dt);
  tickCooldowns(player, dt);

  // --- The player: drive, walk, enter and leave cars. ---
  // A fare pickup takes priority over leaving the car: pressing E beside a waiting
  // passenger picks them up instead of stepping out.
  let pickedUpFare = false;
  if (player.inCar && state.fare && !state.fare.pickedUp) {
    const ped = state.fare.ped;
    if (Math.hypot(ped.x - player.inCar.x, ped.y - player.inCar.y) < 80 && input.enter) {
      pickedUpFare = true;
    }
  }
  if (player.inCar) {
    stepPlayerCar(player.inCar, dt, state.city, input);
    // The player's own position follows the car, so pickups, police and fares see him.
    player.x = player.inCar.x;
    player.y = player.inCar.y;
    if (input.enter && !pickedUpFare) {
      exitCar(player, player.inCar);
      toast(state, 'On foot. Press E near a car to drive it.');
    }
  } else {
    stepPlayerOnFoot(player, dt, state.city, input);
    if (input.enter) {
      const car = nearestEnterableCar(player, state.cars);
      if (car) {
        player.inCar = car;
        car.parked = false;
        if (car.police) addHeat(state, WANTED.stealHeat);
        else if (car.sports) toast(state, 'Comet GT — nice ride.');
      }
    }
  }

  // --- Combat on foot. ---
  if (!player.inCar) {
    if (input.punch) {
      const result = punch(player, state.cars, state.peds);
      if (result && result.type === 'car') {
        result.car.health -= 20;
        burst(state, result.car.x, result.car.y, '#ffd23f', 6);
        events |= EVENT_HIT;
      } else if (result && result.type === 'ped') {
        result.ped.scared = 4;
        addHeat(state, WANTED.hitPedHeat);
        events |= EVENT_HIT;
      }
    }
    if (input.shootAt) {
      const shot = shoot(player, input.shootAt.x, input.shootAt.y, state.cars, state.peds);
      if (shot) {
        events |= EVENT_SHOOT;
        state.tracers.push({ fromX: shot.fromX, fromY: shot.fromY, toX: shot.toX, toY: shot.toY, life: 0.12 });
        scareNearby(state.peds, player.x, player.y, 500);
        addHeat(state, WANTED.shootHeat);
        if (shot.hit) {
          if (shot.hit.kind === 'car') {
            shot.hit.ref.health -= PLAYER.pistolDamage;
            burst(state, shot.hit.x, shot.hit.y, '#ff8a5a', 8);
            if (shot.hit.ref.health <= 0) shot.hit.ref.wrecked = true;
          } else {
            shot.hit.ref.scared = 5;
            addHeat(state, WANTED.killHeat);
          }
          events |= EVENT_HIT;
        }
      }
    }
  }

  // --- Traffic, police and pedestrians. ---
  for (let i = 0; i < state.cars.length; i += 1) {
    const car = state.cars[i];
    if (car === player.inCar || car.wrecked) continue;
    if (car.police) continue;
    stepTrafficCar(car, dt, state.city, random, state.cars);
  }
  for (let i = 0; i < state.police.length; i += 1) {
    const car = state.police[i];
    stepPoliceCar(car, dt, state.city, player.inCar ? player.inCar.x : player.x, player.inCar ? player.inCar.y : player.y);
  }
  maintainPolice(state, dt, state.city, random);
  for (let i = 0; i < state.peds.length; i += 1) {
    const ped = state.peds[i];
    if (ped.down) {
      ped.down -= dt;
      continue;
    }
    stepPedestrian(ped, dt, random, player.x, player.y);
    ped.x = Math.max(20, Math.min(WORLD.width - 20, ped.x));
    ped.y = Math.max(20, Math.min(WORLD.height - 20, ped.y));
  }

  // --- Crashes: the player's car against traffic, and against pedestrians. ---
  if (player.inCar && !player.inCar.wrecked) {
    for (let i = 0; i < state.cars.length; i += 1) {
      const other = state.cars[i];
      if (other === player.inCar || other.wrecked) continue;
      if (carsTouch(player.inCar, other)) {
        const speed = Math.abs(player.inCar.speed);
        // One crash counts once: a cooldown stops a long overlap from dealing damage
        // every step, and the impact scrubs the player's speed off.
        if (speed > 160 && player.inCar.crashCooldown <= 0) {
          player.inCar.health -= 12;
          other.health -= 12;
          player.health -= 6;
          player.inCar.crashCooldown = 1.0;
          player.inCar.speed *= 0.55;
          burst(state, other.x, other.y, '#ff8a5a', 10);
          events |= EVENT_CRASH;
          if (other.health <= 0) other.wrecked = true;
          if (player.inCar.health <= 0) {
            player.inCar.wrecked = true;
            player.health -= 20;
            exitCar(player, player.inCar);
            // The player is out of the car now: stop touching it this step.
            break;
          }
        }
        // Push the two cars apart so they do not stick.
        const dx = other.x - player.inCar.x;
        const dy = other.y - player.inCar.y;
        const dist = Math.hypot(dx, dy) || 1;
        other.x += (dx / dist) * 8;
        other.y += (dy / dist) * 8;
      }
    }
    // The car may have been wrecked above, leaving the player on foot: only run the
    // pedestrian checks while he is still driving.
    if (player.inCar) {
      for (let i = 0; i < state.peds.length; i += 1) {
        const ped = state.peds[i];
        if (ped.down) continue;
        const dist = Math.hypot(ped.x - player.inCar.x, ped.y - player.inCar.y);
        if (dist < 34 && Math.abs(player.inCar.speed) > 120) {
          ped.down = 4;
          ped.scared = 4;
          addHeat(state, WANTED.hitPedHeat);
          toast(state, 'You hit a pedestrian! The cops noticed.');
          events |= EVENT_HIT;
        }
      }
    }
  }

  // --- Pickups: ammo and health. ---
  for (let i = state.pickups.length - 1; i >= 0; i -= 1) {
    const p = state.pickups[i];
    const dist = Math.hypot(p.x - player.x, p.y - player.y);
    if (dist < 36) {
      if (p.kind === 'ammo') {
        player.ammo += 12;
        toast(state, '+12 ammo');
      } else {
        player.health = Math.min(PLAYER.health, player.health + 40);
        toast(state, '+40 health');
      }
      state.pickups.splice(i, 1);
      events |= EVENT_CASH;
    }
  }

  // --- Police contact: rams, wrecks and busts. ---
  const contact = policeContact(state, dt);
  if (contact === 'busted') {
    state.busted = true;
    state.over = true;
    events |= EVENT_BUSTED | EVENT_OVER;
  } else if (contact === 'wrecked') {
    state.over = true;
    events |= EVENT_OVER;
  } else if (contact === 'ram') {
    burst(state, player.inCar.x, player.inCar.y, '#5aa2ff', 8);
    events |= EVENT_CRASH;
  }
  decayHeat(state, dt, state.nearestPoliceDist);

  // --- Missions: objectives, the vault hold, and completion. ---
  const objective = currentObjective(state.mission);
  if (objective) {
    const px = player.inCar ? player.inCar.x : player.x;
    const py = player.inCar ? player.inCar.y : player.y;
    if (objective.needCar) {
      if (player.inCar && player.inCar.sports) {
        if (advanceObjective(state.mission)) finishMission(state);
        else toast(state, 'Now lose the cops!');
      }
    } else if (objective.needQuiet) {
      if (starsOf(state.heat) === 0) {
        if (advanceObjective(state.mission)) finishMission(state);
      }
    } else if (objective.holdSeconds) {
      const dist = Math.hypot(px - objective.x, py - objective.y);
      if (dist < objective.radius && input.enterHeld) {
        state.vaultProgress += dt / objective.holdSeconds;
        if (state.vaultProgress >= 1) {
          state.vaultProgress = 0;
          addHeat(state, 2);
          toast(state, 'Vault cracked! Get to the safehouse!');
          if (advanceObjective(state.mission)) finishMission(state);
        }
      } else {
        state.vaultProgress = Math.max(0, state.vaultProgress - dt / 2);
      }
    } else if (objective.x) {
      const dist = Math.hypot(px - objective.x, py - objective.y);
      if (dist < objective.radius) {
        if (advanceObjective(state.mission)) finishMission(state);
        else toast(state, 'Objective done.');
      }
    }
  }

  // --- Taxi fares: flag a pedestrian, pick them up, drop them off. ---
  state.fareTimer -= dt;
  if (!state.fare && state.fareTimer <= 0 && !state.mission) {
    const candidates = state.peds.filter((ped) => !ped.fare && !ped.down);
    if (candidates.length > 0) {
      const ped = candidates[Math.floor(random.next() * candidates.length)];
      ped.fare = true;
      state.fare = { ped, x: 0, y: 0, name: '', pay: 0, active: false, pickedUp: false };
      toast(state, 'A pedestrian wants a ride — look for the !');
    }
    state.fareTimer = 14;
  }
  if (state.fare && !state.fare.pickedUp) {
    const ped = state.fare.ped;
    const dist = Math.hypot(ped.x - player.x, ped.y - player.y);
    if (player.inCar && dist < 80 && (input.enter || pickedUpFare)) {
      const fare = createFare(random, state.city);
      state.fare.x = fare.x;
      state.fare.y = fare.y;
      state.fare.name = fare.name;
      state.fare.pay = fare.pay;
      state.fare.active = true;
      state.fare.pickedUp = true;
      ped.fare = false;
      // The passenger rides along: remove them from the street.
      state.peds.splice(state.peds.indexOf(ped), 1);
      toast(state, `Passenger aboard — take them to ${fare.name} ($${fare.pay}).`);
    }
  } else if (state.fare && state.fare.active) {
    const px = player.inCar ? player.inCar.x : player.x;
    const py = player.inCar ? player.inCar.y : player.y;
    if (Math.hypot(px - state.fare.x, py - state.fare.y) < 90) {
      state.save.cash += state.fare.pay;
      state.runCash += state.fare.pay;
      storeSave(state.save);
      toast(state, `Fare complete: +$${state.fare.pay}`);
      events |= EVENT_CASH;
      state.fare = null;
      state.fareTimer = 10;
    }
  }

  // --- Health, camera, and the little things that fade. ---
  if (player.health <= 0) {
    state.over = true;
    events |= EVENT_OVER;
  }
  player.health = Math.min(PLAYER.health, player.health + 0.4 * dt);
  const targetX = player.inCar ? player.inCar.x : player.x;
  const targetY = player.inCar ? player.inCar.y : player.y;
  state.camera.x += (targetX - state.camera.x) * Math.min(1, 5 * dt);
  state.camera.y += (targetY - state.camera.y) * Math.min(1, 5 * dt);
  state.camera.x = Math.max(FIELD.width / 2, Math.min(WORLD.width - FIELD.width / 2, state.camera.x));
  state.camera.y = Math.max(FIELD.height / 2, Math.min(WORLD.height - FIELD.height / 2, state.camera.y));
  for (let i = state.tracers.length - 1; i >= 0; i -= 1) {
    state.tracers[i].life -= dt;
    if (state.tracers[i].life <= 0) state.tracers.splice(i, 1);
  }
  for (let i = state.particles.length - 1; i >= 0; i -= 1) {
    const p = state.particles[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.life <= 0) state.particles.splice(i, 1);
  }
  return events;
}

/** Pay out a finished mission and save the progress. */
function finishMission(state) {
  const mission = state.mission.mission;
  state.save.cash += mission.reward;
  state.runCash += mission.reward;
  state.save.missionsDone += 1;
  state.save.best = Math.max(state.save.best, state.runCash);
  storeSave(state.save);
  toast(state, `${mission.title} complete! +$${mission.reward}`, 4);
  state.mission = null;
}
