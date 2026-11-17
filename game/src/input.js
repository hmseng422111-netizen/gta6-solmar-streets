// Keyboard and mouse input for Solmar Streets.
// The game reads a plain state object: held directions, edge-triggered
// actions (pressed once per keypress), and the mouse position in canvas
// pixels. A helper converts a screen point to a world point through the
// camera, so shooting aims where the player points.

export function makeInput() {
  return {
    up: false,
    down: false,
    left: false,
    right: false,
    run: false,
    enter: false,
    punch: false,
    shoot: false,
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    // Edge-triggered actions, consumed once per frame by the game loop.
    pressedEnter: false,
    pressedPunch: false,
    pressedShoot: false,
    pressedPause: false,
    pressedRestart: false,
    anyKey: false,
  };
}

const KEYMAP = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  ShiftLeft: 'run',
  ShiftRight: 'run',
  KeyE: 'enter',
  KeyF: 'punch',
  Space: 'shoot',
};

export function bindInput(input, canvas) {
  if (typeof window === 'undefined') return () => {};
  const onKeyDown = (event) => {
    const field = KEYMAP[event.code];
    if (field) {
      if (!input[field]) {
        if (field === 'enter') input.pressedEnter = true;
        if (field === 'punch') input.pressedPunch = true;
        if (field === 'shoot') input.pressedShoot = true;
      }
      input[field] = true;
      input.anyKey = true;
      event.preventDefault();
    }
    if (event.code === 'KeyP' || event.code === 'Escape') input.pressedPause = true;
    if (event.code === 'Enter') input.pressedRestart = true;
  };
  const onKeyUp = (event) => {
    const field = KEYMAP[event.code];
    if (field) input[field] = false;
  };
  const onMouseMove = (event) => {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = event.clientX - rect.left;
    input.mouseY = event.clientY - rect.top;
  };
  const onMouseDown = (event) => {
    if (event.button === 0) {
      input.mouseDown = true;
      input.pressedShoot = true;
      input.anyKey = true;
    }
  };
  const onMouseUp = () => {
    input.mouseDown = false;
  };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  return () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    canvas.removeEventListener('mousemove', onMouseMove);
    canvas.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('mouseup', onMouseUp);
  };
}

// Convert a canvas point to a world point through the camera.
export function screenToWorld(input, camera, scale) {
  return {
    x: camera.x + input.mouseX / scale,
    y: camera.y + input.mouseY / scale,
  };
}

// Clear edge-triggered flags after each frame.
export function endFrame(input) {
  input.pressedEnter = false;
  input.pressedPunch = false;
  input.pressedShoot = false;
  input.pressedPause = false;
  input.pressedRestart = false;
  input.anyKey = false;
}
