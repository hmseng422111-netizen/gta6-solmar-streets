// Traffic and stealable cars for Solmar Streets.
// Traffic cars drive along the road grid and turn at intersections.
// Parked cars wait in parking spots. Any car can be stolen: walk up to it
// and press E, and its driver (if it had one) runs away on foot.

import {
  CAR_LENGTH, CAR_WIDTH, CAR_TOP_SPEED, CAR_ACCEL, CAR_BRAKE,
  CAR_TURN, CAR_DRAG, TRAFFIC_SPEED, CAR_COLORS, TAXI_COLOR, COMET_COLOR,
} from './config.js';
import { roadCenterX, roadCenterY, nearestRoadPoint, collideBuildings } from './city.js';

let nextCarId = 1;

export function makeCar(x, y, angle, opts = {}) {
  return {
    id: nextCarId,
    x, y, angle,
    speed: 0,
    color: opts.color || '#888888',
    type: opts.type || 'sedan',
    occupied: opts.occupied !== false,
    parked: !!opts.parked,
    // Traffic cars follow a heading down a road; dir is one of the four
    // compass headings in radians.
    dir: angle,
    turnCooldown: 0,
    wrecked: false,
    smoke: 0,
  };
}

export function spawnTraffic(rng, city) {
  const cars = [];
  for (let i = 0; i < 14; i += 1) {
    const col = rng.int(0, 6);
    const row = rng.int(0, 4);
    const horizontal = rng.chance(0.5);
    const x = horizontal ? rng.range(roadCenterX(0), roadCenterX(6)) : roadCenterX(col);
    const y = horizontal ? roadCenterY(row) : rng.range(roadCenterY(0), roadCenterY(4));
    const angle = horizontal ? (rng.chance(0.5) ? 0 : Math.PI) : (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2);
    const car = makeCar(x, y, angle, { color: rng.pick(CAR_COLORS) });
    car.speed = TRAFFIC_SPEED * rng.range(0.7, 1.1);
    cars.push(car);
    nextCarId += 1;
  }
  return cars;
}

export function spawnParked(rng, city) {
  const cars = [];
  const spots = city.parkingSpots.slice(0, 8);
  for (const spot of spots) {
    const taxi = rng.chance(0.18);
    const car = makeCar(spot.x, spot.y, spot.angle, {
      color: taxi ? TAXI_COLOR : rng.pick(CAR_COLORS),
      type: taxi ? 'taxi' : 'sedan',
      occupied: false,
      parked: true,
    });
    cars.push(car);
    nextCarId += 1;
  }
  return cars;
}

// The Comet GT for mission 2: parked by the casino, unmistakable.
export function spawnComet(city) {
  const casino = city.landmarks.casino;
  const car = makeCar(casino.doorX + 40, casino.doorY + 70, Math.PI / 2, {
    color: COMET_COLOR, type: 'comet', occupied: false, parked: true,
  });
  nextCarId += 1;
  return car;
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Drive a traffic car one step: keep to its road, turn at intersections.
export function stepTrafficCar(car, dt, rng) {
  if (car.wrecked) return;
  car.turnCooldown -= dt;
  const snapped = nearestRoadPoint(car.x, car.y);
  const onVertical = Math.abs(car.x - snapped.x) < 4;
  const onHorizontal = Math.abs(car.y - snapped.y) < 4;

  // At an intersection, sometimes pick a new direction.
  if (onVertical && onHorizontal && car.turnCooldown <= 0 && rng.chance(dt * 0.5)) {
    const options = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
    car.dir = rng.pick(options);
    car.turnCooldown = 3;
  }
  const target = car.dir;
  const diff = angleDiff(target, car.angle);
  car.angle += Math.max(-CAR_TURN * dt, Math.min(CAR_TURN * dt, diff));
  car.speed = TRAFFIC_SPEED;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  // Stay on the road: gently pull back to the road centre.
  if (onVertical) car.x += (snapped.x - car.x) * Math.min(1, dt * 2);
  if (onHorizontal) car.y += (snapped.y - car.y) * Math.min(1, dt * 2);
}

// Drive a car the player is in: arcade physics, no full simulation.
export function stepDrivenCar(car, dt, input, city) {
  if (car.wrecked) {
    car.speed *= Math.max(0, 1 - 3 * dt);
    return;
  }
  if (input.up) car.speed += CAR_ACCEL * dt;
  if (input.down) car.speed -= CAR_BRAKE * dt;
  car.speed -= car.speed * CAR_DRAG * dt;
  car.speed = Math.max(-CAR_TOP_SPEED * 0.4, Math.min(CAR_TOP_SPEED, car.speed));
  if (Math.abs(car.speed) > 5) {
    const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
    car.angle += steer * CAR_TURN * dt * Math.sign(car.speed) * Math.min(1, Math.abs(car.speed) / 120);
  }
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const resolved = collideBuildings(city, nx, ny, CAR_LENGTH / 2);
  if (resolved.hit && Math.abs(car.speed) > 140) {
    // A hard hit costs speed and damages the car.
    car.speed *= -0.25;
    car.damage = (car.damage || 0) + 1;
    if (car.damage >= 6) {
      car.wrecked = true;
      car.smoke = 1;
    }
  } else if (resolved.hit) {
    car.speed *= 0.4;
  }
  car.x = resolved.x;
  car.y = resolved.y;
  if (car.smoke > 0) car.smoke = Math.max(0, car.smoke - dt * 0.2);
}

export function carBounds(car) {
  return {
    x: car.x - CAR_LENGTH / 2,
    y: car.y - CAR_WIDTH / 2,
    w: CAR_LENGTH,
    h: CAR_WIDTH,
  };
}

export function distanceToCar(px, py, car) {
  const dx = px - car.x;
  const dy = py - car.y;
  return Math.sqrt(dx * dx + dy * dy);
}
