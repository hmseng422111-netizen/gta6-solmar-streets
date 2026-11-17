// Story missions and taxi fares for Solmar Streets.
// Three missions run in order, each a list of stages the player works
// through. Taxi fares are repeatable side jobs: while the player drives a
// taxi, a customer appears, and delivering them pays $150–$400.

import { MISSIONS, TAXI_FARE_MIN, TAXI_FARE_MAX } from './config.js';

const STAGE_RADIUS = 70;

export function makeMissionState() {
  return {
    index: 0,
    stage: 0,
    crackTimer: 0,
    complete: false,
    fare: null,
    fareCooldown: 0,
    toast: '',
    toastTimer: 0,
  };
}

export function currentMission(state) {
  if (state.index >= MISSIONS.length) return null;
  return MISSIONS[state.index];
}

export function currentStage(state) {
  const mission = currentMission(state);
  if (!mission) return null;
  return mission.stages[state.stage] || null;
}

export function objectiveText(state) {
  const stage = currentStage(state);
  if (stage) {
    const mission = currentMission(state);
    return `${mission.name}: ${stage.label}`;
  }
  if (state.fare) {
    return state.fare.pickedUp
      ? `Taxi fare: drop off your passenger ($${state.fare.pay})`
      : `Taxi fare: pick up your passenger ($${state.fare.pay})`;
  }
  return 'All story missions complete — drive a taxi for fares, or explore Solmar.';
}

function setToast(state, text) {
  state.toast = text;
  state.toastTimer = 4;
}

function near(x1, y1, x2, y2, radius = STAGE_RADIUS) {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return Math.sqrt(dx * dx + dy * dy) < radius;
}

// Advance the story. Returns the cash earned this step (0 when nothing paid).
export function stepMissions(state, dt, world, onEvent) {
  let earned = 0;
  if (state.toastTimer > 0) state.toastTimer -= dt;
  const mission = currentMission(state);
  const stage = currentStage(state);
  const player = world.player;
  const landmarks = world.city.landmarks;

  if (mission && stage) {
    if (stage.kind === 'goto') {
      const mark = landmarks[stage.landmark];
      if (mark && near(player.x, player.y, mark.doorX, mark.doorY)) {
        state.stage += 1;
        onEvent('stage');
        if (state.stage >= mission.stages.length) {
          earned = mission.pay;
          player.cash += earned;
          setToast(state, `${mission.name} complete — $${mission.pay}`);
          onEvent('mission-complete');
          state.index += 1;
          state.stage = 0;
          state.crackTimer = 0;
        }
      }
    } else if (stage.kind === 'steal') {
      // Completed by entering the Comet GT; the world calls completeSteal.
      const mark = landmarks[stage.landmark];
      if (mark && player.car && player.car.type === 'comet' && near(player.x, player.y, mark.doorX, mark.doorY, 160)) {
        state.stage += 1;
        onEvent('stage');
        setToast(state, 'Comet GT stolen — now lose the police!');
      }
    } else if (stage.kind === 'escape') {
      if (world.police.wanted === 0) {
        earned = mission.pay;
        player.cash += earned;
        setToast(state, `${mission.name} complete — $${mission.pay}`);
        onEvent('mission-complete');
        state.index += 1;
        state.stage = 0;
      }
    } else if (stage.kind === 'crack') {
      const mark = landmarks[stage.landmark];
      if (mark && player.onFoot && near(player.x, player.y, mark.doorX, mark.doorY)) {
        state.crackTimer += dt;
        if (state.crackTimer >= 5) {
          state.stage += 1;
          state.crackTimer = 0;
          onEvent('stage');
          setToast(state, 'Vault cracked — run for the safehouse!');
        }
      } else {
        state.crackTimer = Math.max(0, state.crackTimer - dt * 2);
      }
    }
  }

  // Taxi fares: only while driving a taxi and no story stage needs the car.
  if (player.car && player.car.type === 'taxi') {
    state.fareCooldown -= dt;
    if (!state.fare && state.fareCooldown <= 0) {
      const pay = TAXI_FARE_MIN + Math.floor(world.rng.range(0, TAXI_FARE_MAX - TAXI_FARE_MIN + 1));
      const pickup = world.city.parkingSpots[Math.floor(world.rng.next() * world.city.parkingSpots.length)];
      state.fare = {
        pay,
        pickupX: pickup.x,
        pickupY: pickup.y,
        dropX: world.city.landmarks.club.doorX,
        dropY: world.city.landmarks.club.doorY,
        pickedUp: false,
      };
      setToast(state, `New taxi fare — pick up your passenger ($${pay})`);
    }
    if (state.fare) {
      if (!state.fare.pickedUp && near(player.x, player.y, state.fare.pickupX, state.fare.pickupY)) {
        state.fare.pickedUp = true;
        setToast(state, 'Passenger aboard — drive to Club Neon Palms');
      } else if (state.fare.pickedUp && near(player.x, player.y, state.fare.dropX, state.fare.dropY)) {
        earned += state.fare.pay;
        player.cash += state.fare.pay;
        setToast(state, `Fare complete — $${state.fare.pay}`);
        state.fare = null;
        state.fareCooldown = 8;
      }
    }
  } else if (state.fare) {
    state.fare = null;
  }

  return earned;
}
