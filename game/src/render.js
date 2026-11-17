// Drawing only: the world and the screens, painted on a canvas. A camera follows the
// player and shows a 1280x720 slice of the city; the renderer scales that slice to the
// window. The world is flat shapes with a warm sun-soaked palette: sand, sea, roads,
// buildings with shaded roofs, palms on the beach, and cars drawn as rounded bodies with
// windscreens, headlights and, for police, a flashing light bar.

import { CAR, FIELD, FONT, PALETTE, PLAYER, WORLD } from './config.js';
import { drawHud, drawPanel } from './hud.js';
import { currentObjective } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_BUSTED = 'busted';

const ROAD_HALF = WORLD.roadWidth / 2;

function carBody(context, x, y, angle, length, width, color, opts = {}) {
  context.save();
  context.translate(x, y);
  context.rotate(angle);
  context.fillStyle = 'rgba(0,0,0,0.3)';
  context.fillRect(-length / 2 + 3, -width / 2 + 4, length, width);
  context.fillStyle = color;
  context.beginPath();
  context.roundRect(-length / 2, -width / 2, length, width, 7);
  context.fill();
  context.fillStyle = 'rgba(20,30,40,0.85)';
  context.beginPath();
  context.roundRect(-length * 0.18, -width / 2 + 5, length * 0.3, width - 10, 4);
  context.fill();
  context.fillStyle = '#fff8c9';
  context.fillRect(length / 2 - 4, -width / 2 + 3, 3, 6);
  context.fillRect(length / 2 - 4, width / 2 - 9, 3, 6);
  if (opts.police) {
    const flash = Math.floor(opts.time * 4) % 2 === 0;
    context.fillStyle = flash ? '#ff3b30' : '#3b82ff';
    context.fillRect(-6, -width / 2 - 2, 12, 5);
    context.fillStyle = flash ? '#3b82ff' : '#ff3b30';
    context.fillRect(-6, width / 2 - 3, 12, 5);
  }
  if (opts.sports) {
    context.fillStyle = '#ffd23f';
    context.fillRect(-length / 2 + 2, -width / 2 + 2, 10, 3);
    context.fillRect(-length / 2 + 2, width / 2 - 5, 10, 3);
  }
  context.restore();
}

function drawWorld(context, state) {
  const cam = state.camera;
  const viewLeft = cam.x - FIELD.width / 2;
  const viewTop = cam.y - FIELD.height / 2;
  const viewRight = viewLeft + FIELD.width;
  const viewBottom = viewTop + FIELD.height;

  // Ground: grass, then the sea and the beach along the south edge.
  context.fillStyle = PALETTE.grass;
  context.fillRect(viewLeft, viewTop, FIELD.width, FIELD.height);
  context.fillStyle = PALETTE.sea;
  context.fillRect(viewLeft, Math.max(viewTop, WORLD.beachY + 40), FIELD.width, Math.max(0, viewBottom - Math.max(viewTop, WORLD.beachY + 40)));
  context.fillStyle = PALETTE.sand;
  context.fillRect(viewLeft, Math.max(viewTop, WORLD.beachY), FIELD.width, Math.max(0, Math.min(viewBottom, WORLD.beachY + 40) - Math.max(viewTop, WORLD.beachY)));

  // Marina water in the east.
  context.fillStyle = PALETTE.seaDeep;
  context.fillRect(Math.max(viewLeft, WORLD.marinaX), viewTop, Math.max(0, viewRight - Math.max(viewLeft, WORLD.marinaX)), FIELD.height);

  // Roads: the grid, with centre dashes.
  context.fillStyle = PALETTE.road;
  for (let gx = WORLD.roadGap; gx < WORLD.width; gx += WORLD.roadGap) {
    context.fillRect(gx - ROAD_HALF, viewTop, WORLD.roadWidth, FIELD.height);
  }
  for (let gy = WORLD.roadGap; gy < WORLD.height; gy += WORLD.roadGap) {
    context.fillRect(viewLeft, gy - ROAD_HALF, FIELD.width, WORLD.roadWidth);
  }
  context.fillStyle = PALETTE.roadLine;
  for (let gx = WORLD.roadGap; gx < WORLD.width; gx += WORLD.roadGap) {
    for (let y = Math.floor(viewTop / 60) * 60; y < viewBottom; y += 60) {
      context.fillRect(gx - 2, y, 4, 26);
    }
  }
  for (let gy = WORLD.roadGap; gy < WORLD.height; gy += WORLD.roadGap) {
    for (let x = Math.floor(viewLeft / 60) * 60; x < viewRight; x += 60) {
      context.fillRect(x, gy - 2, 26, 4);
    }
  }

  // Parks and their palms.
  for (let i = 0; i < state.city.parks.length; i += 1) {
    const park = state.city.parks[i];
    if (park.x > viewRight || park.x + park.w < viewLeft || park.y > viewBottom || park.y + park.h < viewTop) continue;
    context.fillStyle = '#6da34e';
    context.fillRect(park.x, park.y, park.w, park.h);
    context.fillStyle = '#2f7a3a';
    for (let t = 0; t < park.trees; t += 1) {
      const tx = park.x + 30 + ((t * 97) % Math.max(40, park.w - 60));
      const ty = park.y + 30 + ((t * 61) % Math.max(40, park.h - 60));
      context.beginPath();
      context.arc(tx, ty, 12, 0, Math.PI * 2);
      context.fill();
    }
  }

  // Buildings, with a darker roof inset for the tall ones.
  for (let i = 0; i < state.city.buildings.length; i += 1) {
    const b = state.city.buildings[i];
    if (b.x > viewRight || b.x + b.w < viewLeft || b.y > viewBottom || b.y + b.h < viewTop) continue;
    context.fillStyle = b.color;
    context.fillRect(b.x, b.y, b.w, b.h);
    if (b.tall) {
      context.fillStyle = PALETTE.roof;
      context.fillRect(b.x + 10, b.y + 10, b.w - 20, b.h - 20);
      context.fillStyle = 'rgba(255,255,255,0.25)';
      context.fillRect(b.x + 10, b.y + 10, b.w - 20, 8);
    }
    if (b.name) {
      context.fillStyle = '#f4f6f8';
      context.font = `bold 17px ${FONT}`;
      context.textAlign = 'center';
      context.fillText(b.name, b.x + b.w / 2, b.y + b.h / 2);
    }
  }

  // Beach palms.
  context.fillStyle = '#2f7a3a';
  for (let x = 200; x < WORLD.width; x += 260) {
    if (x < viewLeft || x > viewRight) continue;
    context.beginPath();
    context.arc(x, WORLD.beachY + 18, 11, 0, Math.PI * 2);
    context.fill();
  }

  // Mission marker: a pulsing diamond over the current objective.
  const objective = currentObjective(state.mission);
  if (objective && objective.x) {
    const pulse = 1 + 0.15 * Math.sin(state.time * 4);
    context.save();
    context.translate(objective.x, objective.y);
    context.rotate(Math.PI / 4);
    context.fillStyle = PALETTE.mission;
    const s = 16 * pulse;
    context.fillRect(-s / 2, -s / 2, s, s);
    context.restore();
  }
  if (state.fare && state.fare.active) {
    context.save();
    context.translate(state.fare.x, state.fare.y);
    context.rotate(Math.PI / 4);
    context.fillStyle = PALETTE.cash;
    context.fillRect(-8, -8, 16, 16);
    context.restore();
  }

  // Pickups: ammo boxes and health kits.
  for (let i = 0; i < state.pickups.length; i += 1) {
    const p = state.pickups[i];
    context.fillStyle = p.kind === 'ammo' ? '#ffd23f' : '#7ee787';
    context.beginPath();
    context.arc(p.x, p.y, 10, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#101820';
    context.font = `bold 13px ${FONT}`;
    context.textAlign = 'center';
    context.fillText(p.kind === 'ammo' ? 'A' : '+', p.x, p.y + 4);
  }

  // Traffic and police cars.
  for (let i = 0; i < state.cars.length; i += 1) {
    const car = state.cars[i];
    if (car.wrecked) continue;
    carBody(context, car.x, car.y, car.angle, CAR.length, CAR.width, car.color, { sports: car.sports });
  }
  for (let i = 0; i < state.police.length; i += 1) {
    const car = state.police[i];
    if (car.wrecked) continue;
    carBody(context, car.x, car.y, car.angle, CAR.length, CAR.width, car.color, { police: true, time: state.time });
  }

  // Pedestrians, with a "!" over a waiting taxi fare.
  for (let i = 0; i < state.peds.length; i += 1) {
    const ped = state.peds[i];
    context.fillStyle = ped.color;
    context.beginPath();
    context.arc(ped.x, ped.y, 9, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#1c2733';
    context.beginPath();
    context.arc(ped.x, ped.y - 3, 4, 0, Math.PI * 2);
    context.fill();
    if (ped.fare) {
      context.fillStyle = PALETTE.mission;
      context.font = `bold 22px ${FONT}`;
      context.textAlign = 'center';
      context.fillText('!', ped.x, ped.y - 18);
    }
  }

  // The player: a yellow figure on foot, or hidden inside his car.
  const player = state.player;
  if (!player.inCar) {
    if (player.invulnerable === 0 || Math.floor(player.invulnerable * 10) % 2 === 1) {
      context.fillStyle = PALETTE.player;
      context.beginPath();
      context.arc(player.x, player.y, PLAYER.radius, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#1c2733';
      context.beginPath();
      context.arc(player.x + Math.cos(player.angle) * 7, player.y + Math.sin(player.angle) * 7, 5, 0, Math.PI * 2);
      context.fill();
    }
  } else {
    carBody(context, player.inCar.x, player.inCar.y, player.inCar.angle, CAR.length, CAR.width, player.inCar.color, { sports: player.inCar.sports, police: player.inCar.police, time: state.time });
  }

  // Bullets and particles.
  for (let i = 0; i < state.tracers.length; i += 1) {
    const t = state.tracers[i];
    context.strokeStyle = '#ffe9a8';
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(t.fromX, t.fromY);
    context.lineTo(t.toX, t.toY);
    context.stroke();
  }
  for (let i = 0; i < state.particles.length; i += 1) {
    const p = state.particles[i];
    context.fillStyle = p.color;
    context.globalAlpha = Math.max(0, p.life / p.maxLife);
    context.fillRect(p.x - 3, p.y - 3, 6, 6);
    context.globalAlpha = 1;
  }

  // Vault-cracking progress ring over the casino.
  if (state.vaultProgress > 0 && state.vaultProgress < 1) {
    const c = state.city.landmarks.casino;
    context.strokeStyle = PALETTE.mission;
    context.lineWidth = 8;
    context.beginPath();
    context.arc(c.x, c.y, 60, -Math.PI / 2, -Math.PI / 2 + state.vaultProgress * Math.PI * 2);
    context.stroke();
  }
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const fonts = new Map();
  const view = { scale: 1, x: 0, y: 0 };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  function titleLines(best, save) {
    return [
      'Solmar: a sun-soaked city of fast cars, hot tempers and big scores.',
      'Drive with W A S D or arrows. E enters a car. F punches. Click to shoot.',
      `Cash $${save.cash}  ·  Jobs done ${save.missionsDone} of 3  ·  Best $${best}`,
    ];
  }

  /** Paint one frame: the world, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    context.save();
    const cam = state.camera;
    context.translate(-(cam.x - FIELD.width / 2), -(cam.y - FIELD.height / 2));
    drawWorld(context, state);
    context.restore();
    if (screen === SCREEN_TITLE) {
      drawPanel(context, fonts, 'SOLMAR STREETS', titleLines(state.save.best, state.save), 'Press Space or click to start');
      return;
    }
    drawHud(context, fonts, state);
    if (screen === SCREEN_PAUSED) {
      drawPanel(context, fonts, 'Paused', ['The city waits for you.'], 'Press P to resume');
    } else if (screen === SCREEN_OVER) {
      drawPanel(context, fonts, 'Wrecked', [`You made $${state.runCash} on this run.`, `Best $${state.save.best}`], 'Press Space or click to play again');
    } else if (screen === SCREEN_BUSTED) {
      drawPanel(context, fonts, 'Busted', ['The Solmar PD caught you. Your crew posts bail.', `You made $${state.runCash} on this run.`], 'Press Space or click to play again');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
