// Browser shell for Solmar Streets.
// Owns the canvas, the animation loop and the screens; the simulation in
// world.js owns the game. A shot URL (?shot=start&seed=7) sets up a fixed
// scene and signals window.__shotReady once it has rendered, so the
// screenshot tool can capture a deterministic frame.

import { VIEW_W, VIEW_H } from './config.js';
import { makeWorld, stepWorld, startGame, restartGame } from './world.js';
import { makeInput, bindInput, endFrame, screenToWorld } from './input.js';
import { drawWorld, updateCamera } from './render.js';
import { drawHud } from './hud.js';
import { parseShot, applyShot } from './shots.js';

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const ctx = canvas.getContext('2d');

const { shot, seed } = parseShot(window.location.search);
const world = makeWorld(seed);
const input = makeInput();
bindInput(input, canvas);

if (shot) applyShot(world, shot);

function resize() {
  const scale = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H);
  canvas.width = VIEW_W;
  canvas.height = VIEW_H;
  canvas.style.width = `${VIEW_W * scale}px`;
  canvas.style.height = `${VIEW_H * scale}px`;
}
window.addEventListener('resize', resize);
resize();

let last = performance.now();
let frames = 0;

function drawScreen() {
  ctx.save();
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  drawWorld(ctx, world);
  if (world.screen === 'title') {
    ctx.fillStyle = 'rgba(8, 10, 24, 0.72)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff4fd8';
    ctx.font = 'bold 84px system-ui, sans-serif';
    ctx.fillText('SOLMAR', VIEW_W / 2, 210);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('STREETS', VIEW_W / 2, 300);
    ctx.fillStyle = '#ffd60a';
    ctx.font = '22px system-ui, sans-serif';
    ctx.fillText('A sunny coastal open world. Steal cars, outrun the police,', VIEW_W / 2, 370);
    ctx.fillText('and pull off three story jobs for $7,000.', VIEW_W / 2, 402);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.fillText(shot ? 'Press any key' : 'Press ENTER to play', VIEW_W / 2, 480);
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillStyle = '#bbbbbb';
    ctx.fillText('WASD drive and walk · E enter a car · Mouse aim, click to shoot · F punch · P pause', VIEW_W / 2, 540);
    ctx.textAlign = 'left';
  } else if (world.screen === 'paused') {
    ctx.fillStyle = 'rgba(8, 10, 24, 0.6)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 56px system-ui, sans-serif';
    ctx.fillText('PAUSED', VIEW_W / 2, VIEW_H / 2);
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillText('Press P to resume', VIEW_W / 2, VIEW_H / 2 + 50);
    ctx.textAlign = 'left';
  } else if (world.screen === 'busted') {
    ctx.fillStyle = 'rgba(8, 10, 24, 0.72)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#4d8dff';
    ctx.font = 'bold 72px system-ui, sans-serif';
    ctx.fillText('BUSTED', VIEW_W / 2, VIEW_H / 2 - 20);
    ctx.fillStyle = '#ffffff';
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillText('The Solmar PD caught up with you.', VIEW_W / 2, VIEW_H / 2 + 30);
    ctx.fillText('Press ENTER to try again', VIEW_W / 2, VIEW_H / 2 + 70);
    ctx.textAlign = 'left';
  } else if (world.screen === 'wrecked') {
    ctx.fillStyle = 'rgba(8, 10, 24, 0.72)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff5a5a';
    ctx.font = 'bold 72px system-ui, sans-serif';
    ctx.fillText('WRECKED', VIEW_W / 2, VIEW_H / 2 - 20);
    ctx.fillStyle = '#ffffff';
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillText('Your ride is scrap. Solmar keeps moving without you.', VIEW_W / 2, VIEW_H / 2 + 30);
    ctx.fillText('Press ENTER to try again', VIEW_W / 2, VIEW_H / 2 + 70);
    ctx.textAlign = 'left';
  }
  if (world.screen === 'playing' || world.screen === 'paused') {
    drawHud(ctx, world);
  }
  ctx.restore();
}

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  frames += 1;

  // Aim follows the mouse through the camera.
  const scale = canvas.width / VIEW_W;
  input.aim = screenToWorld(input, world.camera, scale);

  if (world.screen === 'title') {
    if (input.anyKey || input.pressedRestart) startGame(world);
    updateCamera(world.camera, world.player.x, world.player.y);
  } else if (world.screen === 'playing') {
    if (input.pressedPause) {
      world.screen = 'paused';
    } else {
      stepWorld(world, dt, input);
    }
  } else if (world.screen === 'paused') {
    if (input.pressedPause) world.screen = 'playing';
  } else if (world.screen === 'busted' || world.screen === 'wrecked') {
    if (input.pressedRestart) restartGame(world);
  }

  if (statusEl) {
    statusEl.textContent = world.screen === 'playing'
      ? `Cash $${world.player.cash}, wanted ${world.police.wanted} stars`
      : world.screen;
  }

  drawScreen();
  endFrame(input);

  // A shot scene is ready once it has rendered a few frames.
  if (shot && frames >= 5 && !world.shotReady) {
    world.shotReady = true;
    window.__shotReady = true;
  }
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
