// Cars: the player's ride, the traffic that fills the streets, and the police that chase
// it. A car is a point with a heading and a speed; its body is a rectangle of CAR.length
// by CAR.width turned to that heading. Traffic follows the road grid: it drives along one
// road, and at each intersection it may turn onto the crossing road. Police steer straight
// at their target and ram it.

import { CAR, POLICE, WORLD } from './config.js';
import { insideBuilding, onRoad, randomRoadPoint, snapToRoad } from './city.js';

const TWO_PI = Math.PI * 2;

function wrapAngle(angle) {
  let a = angle;
  while (a > Math.PI) a -= TWO_PI;
  while (a < -Math.PI) a += TWO_PI;
  return a;
}

function angleTo(fromX, fromY, toX, toY) {
  return Math.atan2(toY - fromY, toX - fromX);
}

/** A fresh car at a road point, facing along its road. */
export function createCar(random, opts = {}) {
  const point = opts.x !== undefined ? { x: opts.x, y: opts.y, axis: opts.axis || 'h' } : randomRoadPoint(random);
  const angle = opts.angle !== undefined ? opts.angle : point.axis === 'v' ? (random.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (random.chance(0.5) ? 0 : Math.PI);
  return {
    x: point.x,
    y: point.y,
    angle,
    speed: 0,
    color: opts.color || random.pick(['#d8dee6', '#c94a4a', '#4a7fa5', '#e8c94d', '#7a5a9e', '#5a8a6a']),
    sports: !!opts.sports,
    police: !!opts.police,
    parked: !!opts.parked,
    health: CAR.health,
    targetSpeed: opts.parked ? 0 : random.range(140, 220),
    turnAt: 0,
    siren: 0,
    wrecked: false,
    crashCooldown: 0,
  };
}

/** Drive a car forward by its speed and heading, stopping at buildings and the map edge. */
function integrate(car, dt, city) {
  const nextX = car.x + Math.cos(car.angle) * car.speed * dt;
  const nextY = car.y + Math.sin(car.angle) * car.speed * dt;
  const before = { x: car.x, y: car.y };
  car.x = nextX;
  car.y = nextY;
  // The centre test uses half the car's length as its radius: roads are clear of
  // buildings, so a car on a road never trips it, and a car pushed into a block stops.
  if (insideBuilding(city, car.x, car.y)) {
    car.x = before.x;
    car.y = before.y;
    car.speed *= 0.4;
  }
  car.x = Math.max(40, Math.min(WORLD.width - 40, car.x));
  car.y = Math.max(40, Math.min(WORLD.height - 40, car.y));
}

/** Steer a traffic car along the roads, turning at intersections now and then. It brakes
 * for a car stopped or crawling ahead of it, so traffic does not pile up head-on. */
export function stepTrafficCar(car, dt, city, random, others) {
  if (car.wrecked) return;
  car.crashCooldown = Math.max(0, car.crashCooldown - dt);
  const nearCentre = Math.min(Math.abs(car.x - Math.round(car.x / WORLD.roadGap) * WORLD.roadGap), Math.abs(car.y - Math.round(car.y / WORLD.roadGap) * WORLD.roadGap));
  if (nearCentre < 6 && car.turnAt <= 0 && random.chance(0.35)) {
    // Turn onto the crossing road, left or right.
    car.angle += random.chance(0.5) ? Math.PI / 2 : -Math.PI / 2;
    car.turnAt = 1.2;
  }
  car.turnAt = Math.max(0, car.turnAt - dt);
  // It otherwise holds its heading: roads are straight, turns happen at intersections.
  // Brake for a car ahead in the same lane, so traffic queues instead of ramming.
  let cruise = car.targetSpeed;
  if (others) {
    const aheadX = Math.cos(car.angle);
    const aheadY = Math.sin(car.angle);
    for (let i = 0; i < others.length; i += 1) {
      const other = others[i];
      if (other === car || other.wrecked) continue;
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      const along = dx * aheadX + dy * aheadY;
      const across = Math.abs(dx * aheadY - dy * aheadX);
      if (along > 0 && along < 110 && across < 26) {
        cruise = 0;
        break;
      }
    }
  }
  car.speed += (cruise - car.speed) * Math.min(1, 1.5 * dt);
  integrate(car, dt, city);
}

/** Steer a police car at its target; it rams whatever it is chasing. */
export function stepPoliceCar(car, dt, city, targetX, targetY) {
  if (car.wrecked) return;
  const want = angleTo(car.x, car.y, targetX, targetY);
  const steer = wrapAngle(want - car.angle);
  const maxTurn = 3.2 * dt;
  car.angle += Math.max(-maxTurn, Math.min(maxTurn, steer));
  const dist = Math.hypot(targetX - car.x, targetY - car.y);
  const targetSpeed = dist > 120 ? POLICE.chaseSpeed : POLICE.chaseSpeed * 0.6;
  car.speed += (targetSpeed - car.speed) * Math.min(1, 2.5 * dt);
  car.siren += dt;
  integrate(car, dt, city);
}

/** The player's car: throttle, brake, reverse and steering that bites with speed. */
export function stepPlayerCar(car, dt, city, input) {
  if (car.wrecked) return;
  const forward = input.up ? 1 : 0;
  const back = input.down ? 1 : 0;
  const maxSpeed = car.sports ? CAR.sportsMaxSpeed : CAR.maxSpeed;
  if (forward) car.speed += CAR.accel * dt;
  else if (back) {
    car.speed -= (car.speed > 10 ? CAR.brake : CAR.reverseAccel) * dt;
  } else {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 240 * dt);
  }
  car.speed = Math.max(-180, Math.min(maxSpeed, car.speed));
  const steerInput = (input.left ? -1 : 0) + (input.right ? 1 : 0);
  const direction = car.speed >= 0 ? 1 : -1;
  const grip = Math.min(1, Math.abs(car.speed) / 200);
  car.angle += steerInput * CAR.turnRate * grip * direction * dt;
  integrate(car, dt, city);
}

/** True when two car bodies overlap (circle test on their centres, by length). */
export function carsTouch(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy < (CAR.length * 0.72) * (CAR.length * 0.72);
}
