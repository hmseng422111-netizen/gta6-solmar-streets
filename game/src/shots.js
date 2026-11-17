// The screenshot scenes behind ?shot=start|chase|mission|over. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by a simple
// autopilot, so the frame is what a short game really looks like and the same seed always
// gives the same frame. The autopilot drives toward the current objective, steals the
// nearest car when on foot, and brakes for nothing — a hurried player, on purpose.

import { STEP } from './config.js';
import { LANDMARKS } from './city.js';
import { nearestEnterableCar } from './player.js';
import { SCREEN_BUSTED, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 4;
const CHASE_SECONDS = 18;
const MISSION_SECONDS = 30;
const OVER_SECONDS = 40;

/** Steer the player (or his car) toward a point: returns held keys for one step. */
function driveToward(state, targetX, targetY) {
  const player = state.player;
  const px = player.inCar ? player.inCar.x : player.x;
  const py = player.inCar ? player.inCar.y : player.y;
  const input = { up: false, down: false, left: false, right: false, run: false, enter: false, enterHeld: false, punch: false, shootAt: null };
  if (player.inCar) {
    // In a car, steering is relative to the heading: turn toward the target bearing.
    const angle = Math.atan2(targetY - py, targetX - px);
    let diff = angle - player.inCar.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    input.up = true;
    if (diff > 0.25) input.right = true;
    else if (diff < -0.25) input.left = true;
    return input;
  }
  // On foot, movement is axis-aligned: walk straight toward the target.
  if (targetY < py - 20) input.up = true;
  else if (targetY > py + 20) input.down = true;
  if (targetX < px - 20) input.left = true;
  else if (targetX > px + 20) input.right = true;
  return input;
}

function idleInput() {
  return { up: false, down: false, left: false, right: false, run: false, enter: false, enterHeld: false, punch: false, shootAt: null };
}

/**
 * Set `world` to the named scene (start, chase, mission or over; any other name is start)
 * and return the screen to draw over it.
 */
export function stageShot(name, world) {
  const state = world.state;
  world.reset();
  if (name !== 'chase' && name !== 'mission' && name !== 'over') {
    // Title over the city: let the traffic roll for a few seconds behind the panel.
    for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(STEP, idleInput());
    return { screen: SCREEN_TITLE };
  }

  if (name === 'chase') {
    // Steal the nearest car, then run from the cops through downtown with a 3-star wanted.
    for (let i = 0; i < CHASE_SECONDS / STEP; i += 1) {
      const player = state.player;
      const input = driveToward(state, LANDMARKS.casino.x, LANDMARKS.casino.y);
      if (!player.inCar) {
        const car = nearestEnterableCar(player, state.cars);
        if (car) input.enter = true;
      }
      if (i === 120) state.heat = 2.4;
      world.step(STEP, input);
      if (state.over) break;
    }
    return { screen: state.over ? SCREEN_OVER : SCREEN_PLAY };
  }

  if (name === 'mission') {
    // Start the first job and drive to the docks, package in hand, police in the mirror.
    world.startMission();
    for (let i = 0; i < MISSION_SECONDS / STEP; i += 1) {
      const player = state.player;
      const input = driveToward(state, LANDMARKS.docks.x, LANDMARKS.docks.y);
      if (!player.inCar) {
        const car = nearestEnterableCar(player, state.cars);
        if (car) input.enter = true;
      }
      if (i === 200) state.heat = 1.6;
      world.step(STEP, input);
      if (state.over) break;
    }
    return { screen: state.over ? SCREEN_OVER : SCREEN_PLAY };
  }

  // Over: steal a car, race downtown, then step out and stand still while the cops close
  // in — a 4-star wanted level ends with Rio busted, which is the game-over screen.
  for (let i = 0; i < OVER_SECONDS / STEP; i += 1) {
    const player = state.player;
    let input;
    if (i < 15 / STEP) {
      input = driveToward(state, LANDMARKS.casino.x, LANDMARKS.casino.y);
      if (!player.inCar) {
        const car = nearestEnterableCar(player, state.cars);
        if (car) input.enter = true;
      }
    } else if (i === Math.floor(15 / STEP)) {
      input = idleInput();
      input.enter = true;
    } else {
      input = idleInput();
    }
    if (i === 60) state.heat = 4.2;
    world.step(STEP, input);
    if (state.over) break;
  }
  // If the cops never quite caught him, the scene still shows the busted screen: force it.
  if (!state.over) {
    state.busted = true;
    state.over = true;
  }
  return { screen: state.busted ? SCREEN_BUSTED : SCREEN_OVER };
}
