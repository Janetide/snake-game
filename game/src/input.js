// Keyboard, mouse and touch input. Arrow keys / WASD steer; one-shot presses
// (start, restart, pause, mute) are queued as bit flags and taken once by the
// loop, so a press between two frames is never lost and never counted twice.
// A swipe steers on touch screens; a tap confirms.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;

const KEYS = {
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
};
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const MUTE = new Set(['KeyM']);

export function createInput(canvas) {
  let direction = null;
  let actions = 0;
  let touchStart = null;

  window.addEventListener('keydown', (event) => {
    if (KEYS[event.code]) { direction = KEYS[event.code]; event.preventDefault(); return; }
    if (CONFIRM.has(event.code)) { if (!event.repeat) actions |= ACTION_CONFIRM; event.preventDefault(); return; }
    if (PAUSE.has(event.code)) { if (!event.repeat) actions |= ACTION_PAUSE; event.preventDefault(); return; }
    if (MUTE.has(event.code)) { if (!event.repeat) actions |= ACTION_MUTE; }
  });
  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    // Top-right corner buttons: pause (left) and mute (right).
    if (y < 0.09 && x > 0.86) { actions |= ACTION_MUTE; return; }
    if (y < 0.09 && x > 0.78) { actions |= ACTION_PAUSE; return; }
    actions |= ACTION_CONFIRM;
  });
  canvas.addEventListener('touchstart', (event) => {
    const t = event.touches[0];
    touchStart = { x: t.clientX, y: t.clientY };
  }, { passive: true });
  canvas.addEventListener('touchend', (event) => {
    if (!touchStart) return;
    const t = event.changedTouches[0];
    const dx = t.clientX - touchStart.x;
    const dy = t.clientY - touchStart.y;
    touchStart = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) { actions |= ACTION_CONFIRM; return; }
    direction = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
  }, { passive: true });
  window.addEventListener('blur', () => { direction = null; });

  return {
    /** The newest steering direction, or null. */
    direction() { return direction; },
    takeActions() { const taken = actions; actions = 0; return taken; },
  };
}
