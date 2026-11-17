// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps, and the renderer paints what is there. The game moves
// between five screens: title, play, paused, game over and win.
//
// ?seed=N fixes the food and rock layout. ?shot=start|play|win|end (with
// &seed=N) stages that scene instead of running the loop, paints it twice
// and sets window.__shotReady for a screenshot.
import { BEST_KEY, STEP, WIN_SCORE } from './config.js';
import { createRandom } from './random.js';
import { createAudio } from './audio.js';
import { createWorld, EVENT_BONUS, EVENT_EAT, EVENT_GOLD, EVENT_LEVEL, EVENT_OVER, EVENT_WIN } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try { return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0; } catch { return 0; }
}
function saveBest(value) {
  try { window.localStorage.setItem(BEST_KEY, String(value)); } catch {}
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, audio.isMuted(), STEP);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let muted = audio.isMuted();

  function announce(message) { status.textContent = message; }
  function startGame() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    audio.click();
    announce('Playing. Eat apples, reach ' + WIN_SCORE + ' points to win.');
  }
  function finish() {
    if (world.state.score > best) { best = world.state.score; saveBest(best); }
    screen = world.state.won ? SCREEN_WIN : SCREEN_OVER;
    announce(world.state.won
      ? `You win! Score ${world.state.score}. Best ${best}.`
      : `Game over. Score ${world.state.score}. Best ${best}.`);
  }
  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) { muted = audio.toggleMute(); announce(muted ? 'Muted.' : 'Sound on.'); }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN)) startGame();
    else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) { screen = SCREEN_PAUSED; announce('Paused.'); }
    else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) { screen = SCREEN_PLAY; announce('Playing.'); }
  }
  function step() {
    if (screen === SCREEN_TITLE) { world.step(STEP, null, true); return; }
    const events = world.step(STEP, input.direction(), false);
    if (events & EVENT_EAT) audio.eat();
    if (events & EVENT_BONUS) audio.bonus();
    if (events & EVENT_GOLD) audio.gold();
    if (events & EVENT_LEVEL) audio.level();
    if (events & EVENT_WIN) { audio.win(); finish(); }
    else if (events & EVENT_OVER) { audio.hit(); finish(); }
  }
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    accumulator += dt;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
      world.step(dt, null, true);
    }
    renderer.draw(world.state, screen, best, muted, dt);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) { screen = SCREEN_PAUSED; announce('Paused.'); }
  });
  announce('Neon Serpent. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
