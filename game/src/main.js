// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between five screens: title, play, paused, wrecked and busted.
// M starts the next story job. Clicking shoots the pistol on foot.
//
// ?seed=N fixes the city and the traffic. ?shot=start|chase|mission|over (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.

import { STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BUSTED, EVENT_CASH, EVENT_CRASH, EVENT_MISSION, EVENT_OVER, EVENT_SHOOT } from './world.js';
import { ACTION_CONFIRM, ACTION_ENTER, ACTION_MISSION, ACTION_PAUSE, ACTION_PUNCH, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';
import { loadSave, storeSave } from './missions.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const save = loadSave();
const world = createWorld(createRandom(seed), save);
const renderer = createRenderer(canvas);
const audio = createAudio();

/** Convert a pointer position on the page to a point in the world. */
function screenToWorld(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const deviceX = (clientX - rect.left) * (canvas.width / rect.width);
  const deviceY = (clientY - rect.top) * (canvas.height / rect.height);
  const viewScale = Math.min(canvas.width / 1280, canvas.height / 720);
  const offsetX = (canvas.width - 1280 * viewScale) / 2;
  const offsetY = (canvas.height - 720 * viewScale) / 2;
  return {
    x: (deviceX - offsetX) / viewScale + (world.state.camera.x - 640),
    y: (deviceY - offsetY) / viewScale + (world.state.camera.y - 360),
  };
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  let screen = SCREEN_TITLE;
  let shootAt = null;
  const input = createInput(
    canvas,
    (clientX, clientY) => {
      if (screen === SCREEN_PLAY) shootAt = screenToWorld(clientX, clientY);
    },
    () => audio.unlock(),
  );
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    screen = SCREEN_PLAY;
    announce('Playing. Drive with W A S D. Press M for a job.');
  }

  function endGame(busted) {
    const state = world.state;
    if (state.runCash > state.save.best) {
      state.save.best = state.runCash;
      storeSave(state.save);
    }
    screen = busted ? SCREEN_BUSTED : SCREEN_OVER;
    announce(busted ? 'Busted by the Solmar PD.' : 'Wrecked. Game over.');
  }

  function handleEvents(events) {
    if (events & EVENT_SHOOT) audio.shoot();
    if (events & EVENT_CRASH) audio.crash();
    if (events & EVENT_CASH) audio.cash();
    if (events & EVENT_MISSION) audio.missionDone();
    if (events & EVENT_BUSTED) audio.busted();
    if (events & EVENT_OVER) endGame(!!(events & EVENT_BUSTED));
  }

  /** One fixed step, given the one-shot actions this frame took. */
  function step(actions) {
    const held = input.held;
    const stepInput = {
      up: held.up,
      down: held.down,
      left: held.left,
      right: held.right,
      run: held.run,
      enter: !!(actions & ACTION_ENTER),
      enterHeld: held.enter,
      punch: !!(actions & ACTION_PUNCH),
      shootAt,
    };
    shootAt = null;
    const events = world.step(STEP, stepInput);
    const player = world.state.player;
    audio.update(STEP, player.inCar ? Math.abs(player.inCar.speed) : 0, 680, world.state.heat);
    handleEvents(events);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_BUSTED) {
      if (actions & ACTION_CONFIRM) startGame();
      accumulator = 0;
    } else if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
      accumulator = 0;
    } else if (screen === SCREEN_PLAY) {
      if (actions & ACTION_MISSION) {
        const mission = world.startMission();
        if (mission) announce(`${mission.mission.title}: ${mission.mission.intro}`);
        else announce('All jobs done — free roam, or take a taxi fare.');
      }
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
        accumulator = 0;
      } else {
        // One-shot presses count once per frame, not once per fixed substep: pass the
        // actions to the first substep only, so one E press cannot enter and leave a car
        // in the same frame.
        let first = true;
        while (accumulator >= STEP && screen === SCREEN_PLAY) {
          step(first ? actions : 0);
          first = false;
          accumulator -= STEP;
        }
      }
    }
    renderer.draw(world.state, screen);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Solmar Streets. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
