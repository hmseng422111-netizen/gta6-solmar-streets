// The HUD and the minimap: cash, health, wanted stars, the mission objective, ammo and
// speed, plus a live minimap of the city in the corner. Drawing only — it reads the world
// state and paints pixels, it changes nothing.

import { FIELD, FONT, PALETTE, WANTED, WORLD } from './config.js';
import { currentObjective } from './missions.js';
import { starsOf } from './police.js';

const MAP = { x: FIELD.width - 218, y: 16, w: 202, h: 146 };

function text(context, fonts, value, x, y, size, color, align) {
  if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
  context.font = fonts.get(size);
  context.fillStyle = color;
  context.textAlign = align;
  context.textBaseline = 'top';
  context.fillText(value, x, y);
}

function starRow(context, fonts, stars) {
  for (let i = 0; i < WANTED.maxStars; i += 1) {
    const x = FIELD.width - 24 - (WANTED.maxStars - 1 - i) * 30;
    text(context, fonts, '★', x, 18, 30, i < stars ? PALETTE.wanted : '#3a4552', 'center');
  }
}

/** The minimap: roads, the sea, the player, police, traffic and the mission marker. */
export function drawMinimap(context, fonts, state) {
  const { x, y, w, h } = MAP;
  const scaleX = w / WORLD.width;
  const scaleY = h / WORLD.height;
  context.fillStyle = 'rgba(16,24,32,0.82)';
  context.fillRect(x - 6, y - 6, w + 12, h + 12);
  context.fillStyle = PALETTE.minimapBg;
  context.fillRect(x, y, w, h);
  // Sea along the south edge.
  context.fillStyle = PALETTE.seaDeep;
  context.fillRect(x, y + (WORLD.beachY / WORLD.height) * h, w, h - (WORLD.beachY / WORLD.height) * h);
  // Roads.
  context.strokeStyle = PALETTE.minimapRoad;
  context.lineWidth = 2;
  for (let gx = WORLD.roadGap; gx < WORLD.width; gx += WORLD.roadGap) {
    context.beginPath();
    context.moveTo(x + gx * scaleX, y);
    context.lineTo(x + gx * scaleX, y + h);
    context.stroke();
  }
  for (let gy = WORLD.roadGap; gy < WORLD.height; gy += WORLD.roadGap) {
    context.beginPath();
    context.moveTo(x, y + gy * scaleY);
    context.lineTo(x + w, y + gy * scaleY);
    context.stroke();
  }
  const dot = (wx, wy, color, size) => {
    context.fillStyle = color;
    context.fillRect(x + wx * scaleX - size / 2, y + wy * scaleY - size / 2, size, size);
  };
  const objective = currentObjective(state.mission);
  if (objective && objective.x) dot(objective.x, objective.y, PALETTE.mission, 9);
  if (state.fare && state.fare.active) dot(state.fare.x, state.fare.y, PALETTE.cash, 7);
  for (let i = 0; i < state.police.length; i += 1) {
    const car = state.police[i];
    if (!car.wrecked) dot(car.x, car.y, '#5aa2ff', 5);
  }
  const player = state.player;
  const px = player.inCar ? player.inCar.x : player.x;
  const py = player.inCar ? player.inCar.y : player.y;
  dot(px, py, PALETTE.player, 7);
  context.strokeStyle = 'rgba(244,246,248,0.5)';
  context.strokeRect(x - 6, y - 6, w + 12, h + 12);
}

/** The HUD bar: cash, health, ammo, speed and the mission line. */
export function drawHud(context, fonts, state) {
  const player = state.player;
  const stars = starsOf(state.heat);
  context.fillStyle = 'rgba(16,24,32,0.72)';
  context.fillRect(0, 0, FIELD.width, 64);
  text(context, fonts, `$${state.save.cash}`, 20, 14, 30, PALETTE.cash, 'left');
  // Health bar.
  context.fillStyle = '#3a4552';
  context.fillRect(20, 48, 180, 10);
  context.fillStyle = player.health > 30 ? PALETTE.cash : PALETTE.wanted;
  context.fillRect(20, 48, 180 * Math.max(0, player.health / 100), 10);
  text(context, fonts, `HP ${Math.max(0, Math.ceil(player.health))}`, 208, 40, 18, PALETTE.hudText, 'left');
  starRow(context, fonts, stars);
  if (player.inCar) {
    const speed = Math.round(Math.abs(player.inCar.speed) * 0.18);
    text(context, fonts, `${speed} km/h`, FIELD.width - 24, 56, 22, PALETTE.hudText, 'right');
    text(context, fonts, player.inCar.sports ? 'Comet GT' : 'Sedan', FIELD.width - 24, 84, 18, PALETTE.hudMuted, 'right');
  } else {
    text(context, fonts, `Ammo ${player.ammo}`, FIELD.width - 24, 56, 22, PALETTE.hudText, 'right');
  }
  const objective = currentObjective(state.mission);
  if (objective) {
    text(context, fonts, objective.text, FIELD.width / 2, 76, 22, PALETTE.mission, 'center');
  } else if (state.mission && state.mission.done) {
    text(context, fonts, 'Job done — press M for the next job', FIELD.width / 2, 76, 22, PALETTE.cash, 'center');
  } else if (state.fare && state.fare.active) {
    text(context, fonts, `Taxi fare: take your passenger to ${state.fare.name} ($${state.fare.pay})`, FIELD.width / 2, 76, 22, PALETTE.cash, 'center');
  } else {
    text(context, fonts, 'Free roam — press M for a job, E near a car to drive it', FIELD.width / 2, 76, 22, PALETTE.hudMuted, 'center');
  }
  // Toasts: short messages under the objective line.
  if (state.toast && state.toastTimer > 0) {
    text(context, fonts, state.toast, FIELD.width / 2, 108, 22, PALETTE.hudText, 'center');
  }
  drawMinimap(context, fonts, state);
}

/** A centred panel for the title, pause and game-over screens. */
export function drawPanel(context, fonts, title, lines, prompt) {
  const width = 640;
  const height = 150 + lines.length * 36 + 70;
  const x = (FIELD.width - width) / 2;
  const y = (FIELD.height - height) / 2;
  context.fillStyle = 'rgba(16,24,32,0.88)';
  context.fillRect(x, y, width, height);
  context.strokeStyle = PALETTE.mission;
  context.lineWidth = 3;
  context.strokeRect(x, y, width, height);
  context.textBaseline = 'alphabetic';
  text(context, fonts, title, FIELD.width / 2, y + 78, 52, PALETTE.hudText, 'center');
  for (let i = 0; i < lines.length; i += 1) {
    text(context, fonts, lines[i], FIELD.width / 2, y + 132 + i * 36, 22, PALETTE.hudMuted, 'center');
  }
  text(context, fonts, prompt, FIELD.width / 2, y + height - 44, 24, PALETTE.mission, 'center');
}
