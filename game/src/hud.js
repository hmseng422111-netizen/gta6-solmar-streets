// Heads-up display and minimap for Solmar Streets.
// Drawn on the same canvas as the world, after it: cash, wanted stars,
// the current objective, health and speed, a toast line for mission news,
// and a live minimap in the corner showing roads, landmarks, the player,
// police and the active objective marker.

import { VIEW_W, VIEW_H, WORLD_W, WORLD_H, MISSIONS } from './config.js';
import { objectiveText } from './missions.js';

const MAP_W = 210;
const MAP_H = 158;
const MAP_X = VIEW_W - MAP_W - 16;
const MAP_Y = 16;

export function drawHud(ctx, world) {
  const player = world.player;
  const police = world.police;
  const missions = world.missions;

  ctx.save();
  ctx.textBaseline = 'top';

  // Cash.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(14, 14, 190, 44);
  ctx.fillStyle = '#7ee787';
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillText(`$${player.cash}`, 26, 22);
  ctx.fillStyle = '#ffffff';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText('SOLMAR', 130, 24);
  ctx.fillText('STREETS', 130, 40);

  // Wanted stars.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(14, 66, 190, 34);
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < police.wanted ? '#ffd60a' : 'rgba(255, 255, 255, 0.25)';
    ctx.font = '22px system-ui, sans-serif';
    ctx.fillText('★', 24 + i * 34, 70);
  }

  // Objective.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  const objective = objectiveText(missions);
  ctx.font = '15px system-ui, sans-serif';
  const objW = Math.min(560, ctx.measureText(objective).width + 28);
  ctx.fillRect(14, VIEW_H - 52, objW, 36);
  ctx.fillStyle = '#ffd60a';
  ctx.fillText(objective, 28, VIEW_H - 42);

  // Health bar.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(14, 108, 190, 18);
  ctx.fillStyle = player.health > 30 ? '#2ecc71' : '#e74c3c';
  ctx.fillRect(16, 110, 186 * Math.max(0, player.health / 100), 14);
  ctx.fillStyle = '#ffffff';
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText(`HEALTH ${Math.max(0, Math.round(player.health))}`, 22, 111);

  // Speed, when driving.
  if (!player.onFoot && player.car) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(VIEW_W - 150, VIEW_H - 52, 134, 36);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText(`${Math.round(Math.abs(player.car.speed) * 0.45)} mph`, VIEW_W - 138, VIEW_H - 44);
  }

  // Mission toast.
  if (missions.toastTimer > 0 && missions.toast) {
    ctx.font = 'bold 18px system-ui, sans-serif';
    const w = ctx.measureText(missions.toast).width + 32;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fillRect((VIEW_W - w) / 2, 66, w, 38);
    ctx.fillStyle = '#7ee787';
    ctx.fillText(missions.toast, (VIEW_W - w) / 2 + 16, 75);
  }

  // Vault cracking progress.
  if (world.missions.crackTimer > 0) {
    const frac = world.missions.crackTimer / 5;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fillRect(VIEW_W / 2 - 130, VIEW_H - 110, 260, 26);
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(VIEW_W / 2 - 126, VIEW_H - 106, 252 * frac, 18);
    ctx.fillStyle = '#ffffff';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText('CRACKING THE VAULT…', VIEW_W / 2 - 126, VIEW_H - 104);
  }

  drawMinimap(ctx, world);
  ctx.restore();
}

function drawMinimap(ctx, world) {
  const sx = MAP_W / WORLD_W;
  const sy = MAP_H / WORLD_H;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(MAP_X - 4, MAP_Y - 4, MAP_W + 8, MAP_H + 8);
  ctx.fillStyle = '#20242e';
  ctx.fillRect(MAP_X, MAP_Y, MAP_W, MAP_H);

  // Sea and beach.
  ctx.fillStyle = '#1f6fb2';
  ctx.fillRect(MAP_X + 2320 * sx, MAP_Y, (WORLD_W - 2440) * sx + 8, MAP_H);
  ctx.fillStyle = '#e8d9a0';
  ctx.fillRect(MAP_X + 2320 * sx, MAP_Y, (2440 - 2320) * sx, MAP_H);

  // Roads.
  ctx.strokeStyle = '#5a5f6b';
  ctx.lineWidth = 3;
  for (let c = 0; c <= 7; c += 1) {
    const x = MAP_X + (160 + c * 320) * sx;
    ctx.beginPath();
    ctx.moveTo(x, MAP_Y);
    ctx.lineTo(x, MAP_Y + MAP_H);
    ctx.stroke();
  }
  for (let r = 0; r <= 5; r += 1) {
    const y = MAP_Y + (160 + r * 320) * sy;
    ctx.beginPath();
    ctx.moveTo(MAP_X, y);
    ctx.lineTo(MAP_X + MAP_W, y);
    ctx.stroke();
  }

  // Landmarks.
  for (const [key, mark] of Object.entries(world.city.landmarks)) {
    ctx.fillStyle = key === 'casino' ? '#d4af37' : key === 'club' ? '#ff4fd8' : '#ffffff';
    ctx.beginPath();
    ctx.arc(MAP_X + mark.x * sx, MAP_Y + mark.y * sy, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Active objective marker.
  const target = objectiveTarget(world);
  if (target) {
    const px = MAP_X + target.x * sx;
    const py = MAP_Y + target.y * sy;
    ctx.fillStyle = '#ffd60a';
    ctx.beginPath();
    ctx.arc(px, py, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffd60a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, 10 + Math.sin(world.time * 4) * 3, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Police.
  ctx.fillStyle = '#4d8dff';
  for (const car of world.police.cars) {
    ctx.fillRect(MAP_X + car.x * sx - 2, MAP_Y + car.y * sy - 2, 4, 4);
  }

  // Player.
  ctx.fillStyle = '#7ee787';
  ctx.beginPath();
  ctx.arc(MAP_X + world.player.x * sx, MAP_Y + world.player.y * sy, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

export function objectiveTarget(world) {
  const active = world.missions;
  const mission = MISSIONS[active.index];
  if (mission) {
    const stageDef = mission.stages[active.stage];
    if (stageDef && stageDef.landmark) {
      const mark = world.city.landmarks[stageDef.landmark];
      if (mark) return { x: mark.doorX, y: mark.doorY };
    }
  }
  if (active.fare) {
    return active.fare.pickedUp
      ? { x: active.fare.dropX, y: active.fare.dropY }
      : { x: active.fare.pickupX, y: active.fare.pickupY };
  }
  return null;
}
