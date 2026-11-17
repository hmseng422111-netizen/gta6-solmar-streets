// Fixed screenshot scenes for Solmar Streets.
// The game reads ?shot=<name>&seed=<n> from the URL and sets the world up
// deterministically, so the same scene renders the same way every time.
// Each scene finishes by setting window.__shotReady, which the capture
// script waits for before taking the screenshot.

import { makeWorld, startGame } from './world.js';
import { addHeat } from './police.js';

export const SHOT_NAMES = ['start', 'chase', 'mission', 'over'];

export function applyShot(world, name) {
  if (name === 'start') {
    // Title screen: the camera looks over the city centre, the player on
    // foot outside the safehouse.
    world.screen = 'title';
    const safehouse = world.city.landmarks.safehouse;
    world.player.x = safehouse.doorX;
    world.player.y = safehouse.doorY + 40;
    world.camera.x = Math.max(0, world.player.x - 640);
    world.camera.y = Math.max(0, world.player.y - 360);
    return true;
  }
  if (name === 'chase') {
    // A three-star chase: the player in a car, speeding east down a road
    // with three police cars closing in behind. The car starts on the
    // road itself, so it cannot hit a building before the capture.
    startGame(world);
    const roadY = 800;
    const car = world.cars.find((c) => c.parked) || world.cars[0];
    car.x = 700;
    car.y = roadY;
    car.angle = 0;
    car.occupied = true;
    car.parked = false;
    car.speed = 320;
    world.player.onFoot = false;
    world.player.car = car;
    world.player.x = car.x;
    world.player.y = car.y;
    world.player.angle = 0;
    addHeat(world.police, 250);
    // Place three police cars behind the player on the same road.
    for (let i = 0; i < 3; i += 1) {
      const pc = {
        x: car.x - 170 - i * 120,
        y: roadY,
        angle: 0,
        speed: 380,
        color: '#1b2a4a',
        type: 'police',
        occupied: true,
        parked: false,
        wrecked: false,
        smoke: 0,
      };
      world.police.cars.push(pc);
    }
    return true;
  }
  if (name === 'mission') {
    // Mission 1 in progress: the player drives east along the road south
    // of Club Neon Palms, toward the Solmar Docks pickup, the objective
    // marker glowing on the map.
    startGame(world);
    const club = world.city.landmarks.club;
    const car = world.cars.find((c) => c.parked) || world.cars[0];
    car.x = club.doorX;
    car.y = 800;
    car.angle = 0;
    car.occupied = true;
    car.parked = false;
    car.speed = 180;
    world.player.onFoot = false;
    world.player.car = car;
    world.player.x = car.x;
    world.player.y = car.y;
    world.player.angle = 0;
    world.missions.index = 0;
    world.missions.stage = 0;
    return true;
  }
  if (name === 'over') {
    // The wrecked screen: the player's car is destroyed, smoke rising.
    startGame(world);
    const car = world.cars.find((c) => c.parked) || world.cars[0];
    world.player.onFoot = false;
    world.player.car = car;
    car.occupied = true;
    car.parked = false;
    car.wrecked = true;
    car.smoke = 1;
    car.speed = 0;
    world.player.x = car.x;
    world.player.y = car.y;
    world.screen = 'wrecked';
    return true;
  }
  return false;
}

export function parseShot(query) {
  const params = new URLSearchParams(query);
  const shot = params.get('shot');
  const seed = Number(params.get('seed') || '7');
  return { shot: SHOT_NAMES.includes(shot) ? shot : null, seed: Number.isFinite(seed) ? seed : 7 };
}

// Build a world for a shot and apply it. Used by main.js and by tests.
export function makeShotWorld(name, seed) {
  const world = makeWorld(seed);
  applyShot(world, name);
  return world;
}
