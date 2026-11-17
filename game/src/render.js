// Canvas rendering for Solmar Streets.
// Top-down view: sand and sea on the east, asphalt roads with dashes,
// buildings drawn with a small shadow offset so they read as solid blocks,
// cars as rounded rectangles with windscreens, people as dots with a
// direction tick, and markers, bullets and particles on top. The camera
// follows the player and never leaves the world.

import {
  VIEW_W, VIEW_H, WORLD_W, WORLD_H, ROAD_W, BEACH_X, SEA_X,
  CAR_LENGTH, CAR_WIDTH, LANDMARK_NAMES,
} from './config.js';
import { roadCenterX, roadCenterY } from './city.js';
import { objectiveTarget } from './hud.js';

export function makeCamera() {
  return { x: 0, y: 0 };
}

export function updateCamera(camera, focusX, focusY) {
  camera.x = Math.max(0, Math.min(WORLD_W - VIEW_W, focusX - VIEW_W / 2));
  camera.y = Math.max(0, Math.min(WORLD_H - VIEW_H, focusY - VIEW_H / 2));
}

function drawCar(ctx, car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.fillRect(-CAR_LENGTH / 2 + 3, -CAR_WIDTH / 2 + 4, CAR_LENGTH, CAR_WIDTH);
  ctx.fillStyle = car.wrecked ? '#3a3a3a' : car.color;
  ctx.beginPath();
  ctx.roundRect(-CAR_LENGTH / 2, -CAR_WIDTH / 2, CAR_LENGTH, CAR_WIDTH, 6);
  ctx.fill();
  ctx.fillStyle = 'rgba(180, 220, 255, 0.85)';
  ctx.fillRect(-6, -CAR_WIDTH / 2 + 4, 14, CAR_WIDTH - 8);
  ctx.fillStyle = 'rgba(255, 255, 200, 0.9)';
  ctx.fillRect(CAR_LENGTH / 2 - 4, -CAR_WIDTH / 2 + 3, 3, 5);
  ctx.fillRect(CAR_LENGTH / 2 - 4, CAR_WIDTH / 2 - 8, 3, 5);
  if (car.type === 'police') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-CAR_LENGTH / 2 + 6, -CAR_WIDTH / 2 + 2, CAR_LENGTH - 12, 5);
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(-10, -CAR_WIDTH / 2 + 2, 8, 5);
    ctx.fillStyle = '#3498db';
    ctx.fillRect(2, -CAR_WIDTH / 2 + 2, 8, 5);
  }
  if (car.type === 'taxi') {
    ctx.fillStyle = '#222222';
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, 3);
  }
  if (car.smoke > 0) {
    ctx.fillStyle = `rgba(120, 120, 120, ${0.5 * car.smoke})`;
    ctx.beginPath();
    ctx.arc(-CAR_LENGTH / 2, 0, 12 + Math.random() * 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPerson(ctx, ped) {
  if (ped.state === 'down') {
    ctx.fillStyle = ped.color;
    ctx.beginPath();
    ctx.ellipse(ped.x, ped.y, 10, 5, ped.angle, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.beginPath();
  ctx.ellipse(ped.x, ped.y + 4, 7, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ped.color;
  ctx.beginPath();
  ctx.arc(ped.x, ped.y, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f2c89b';
  ctx.beginPath();
  ctx.arc(ped.x + Math.cos(ped.angle) * 3, ped.y + Math.sin(ped.angle) * 3, 3.5, 0, Math.PI * 2);
  ctx.fill();
}

export function drawWorld(ctx, world) {
  const camera = world.camera;
  const city = world.city;
  ctx.save();
  ctx.translate(-camera.x, -camera.y);

  // Ground: grass, then beach, then sea.
  ctx.fillStyle = '#4d8a4f';
  ctx.fillRect(camera.x - 10, camera.y - 10, VIEW_W + 20, VIEW_H + 20);
  ctx.fillStyle = '#e8d9a0';
  ctx.fillRect(BEACH_X, camera.y - 10, SEA_X - BEACH_X, VIEW_H + 20);
  ctx.fillStyle = '#1f6fb2';
  ctx.fillRect(SEA_X, camera.y - 10, WORLD_W - SEA_X + 10, VIEW_H + 20);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  for (let y = 0; y < WORLD_H; y += 90) {
    ctx.fillRect(SEA_X + 14 + ((y * 7) % 40), y, 26, 4);
  }

  // Roads.
  ctx.fillStyle = '#33363d';
  for (let c = 0; c <= 7; c += 1) {
    ctx.fillRect(roadCenterX(c) - ROAD_W / 2, 0, ROAD_W, WORLD_H);
  }
  for (let r = 0; r <= 5; r += 1) {
    ctx.fillRect(0, roadCenterY(r) - ROAD_W / 2, WORLD_W, ROAD_W);
  }
  // Centre dashes.
  ctx.fillStyle = '#f7dc00';
  for (let c = 0; c <= 7; c += 1) {
    for (let y = 0; y < WORLD_H; y += 56) {
      ctx.fillRect(roadCenterX(c) - 2, y, 4, 26);
    }
  }
  for (let r = 0; r <= 5; r += 1) {
    for (let x = 0; x < WORLD_W; x += 56) {
      ctx.fillRect(x, roadCenterY(r) - 2, 26, 4);
    }
  }

  // Buildings.
  for (const b of city.buildings) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.fillRect(b.x, b.y, b.w, 8);
    if (b.landmark) {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(LANDMARK_NAMES[b.landmark], b.x + b.w / 2, b.y + b.h / 2 + 4);
      ctx.textAlign = 'left';
    }
  }

  // Objective marker.
  const target = objectiveTarget(world);
  if (target) {
    const pulse = 1 + Math.sin(world.time * 5) * 0.15;
    ctx.strokeStyle = '#ffd60a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(target.x, target.y, 26 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffd60a';
    ctx.beginPath();
    ctx.moveTo(target.x, target.y - 34);
    ctx.lineTo(target.x - 9, target.y - 14);
    ctx.lineTo(target.x + 9, target.y - 14);
    ctx.closePath();
    ctx.fill();
  }

  // Taxi fare marker.
  if (world.missions.fare) {
    const fare = world.missions.fare;
    const fx = fare.pickedUp ? fare.dropX : fare.pickupX;
    const fy = fare.pickedUp ? fare.dropY : fare.pickupY;
    ctx.fillStyle = '#f7dc00';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('$', fx, fy - 8);
    ctx.textAlign = 'left';
  }

  // Parked and traffic cars, then police.
  for (const car of world.cars) drawCar(ctx, car);
  for (const car of world.police.cars) drawCar(ctx, car);

  // Pedestrians.
  for (const ped of world.peds) drawPerson(ctx, ped);

  // Player.
  const player = world.player;
  if (player.onFoot) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(player.x, player.y + 5, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff5a5a';
    ctx.beginPath();
    ctx.arc(player.x, player.y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2c89b';
    ctx.beginPath();
    ctx.arc(player.x + Math.cos(player.angle) * 4, player.y + Math.sin(player.angle) * 4, 5, 0, Math.PI * 2);
    ctx.fill();
    // Aim line for the pistol.
    if (player.weapon === 'pistol') {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(player.x, player.y);
      ctx.lineTo(player.x + Math.cos(player.angle) * 40, player.y + Math.sin(player.angle) * 40);
      ctx.stroke();
    }
  } else if (player.car) {
    drawCar(ctx, player.car);
  }

  // Bullets.
  ctx.fillStyle = '#ffe66d';
  for (const bullet of world.bullets) {
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Particles (smoke, muzzle flashes, pickup sparkles).
  for (const p of world.particles) {
    ctx.fillStyle = p.color;
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.restore();
}
