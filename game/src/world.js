// The game's rules and state, with no drawing and no browser in it: the
// snake, food, rocks, levels, score and win/lose. step() advances one fixed
// 1/60 s step and returns what happened as bit flags, so the caller can react
// without the world knowing about screens or sound. A grid step happens when
// the accumulated time passes the current tick interval, so the snake speeds
// up as its level and length grow.
import { FOOD, GRID, OBSTACLES, SNAKE, SPEED, STEP, WIN_LEVEL, WIN_SCORE } from './config.js';

export const KIND_APPLE = 0;
export const KIND_BERRY = 1;
export const KIND_GOLD = 2;
export const EVENT_EAT = 1;
export const EVENT_BONUS = 2;
export const EVENT_GOLD = 4;
export const EVENT_LEVEL = 8;
export const EVENT_OVER = 16;
export const EVENT_WIN = 32;

const DIRS = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
export const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };

export function key(x, y) { return x + ',' + y; }
export function tickMs(state) {
  return Math.max(SPEED.minMs, SPEED.baseMs - SPEED.perLevelMs * (state.level - 1) - SPEED.perFoodMs * state.foodsEaten);
}

export function createWorld(random) {
  const state = {
    snake: [], dir: 'right', pendingDir: 'right', foods: [], obstacles: new Set(),
    score: 0, best: 0, level: 1, foodsEaten: 0, elapsed: 0, tickAcc: 0, tickProgress: 0,
    prevSnake: [], bonusTimer: 0, goldTimer: 0, over: false, won: false, dead: false,
    particles: [], floats: [], shake: 0, flash: 0, flashColor: '#ff2d55',
  };

  function freeCell() {
    for (let tries = 0; tries < 400; tries += 1) {
      const x = random.int(GRID.cols);
      const y = random.int(GRID.rows);
      if (!occupied(x, y)) return { x, y };
    }
    return null;
  }
  function occupied(x, y) {
    if (state.obstacles.has(key(x, y))) return true;
    for (const s of state.snake) if (s.x === x && s.y === y) return true;
    for (const f of state.foods) if (f.x === x && f.y === y) return true;
    return false;
  }
  function spawnFood(kind) {
    const cell = freeCell();
    if (!cell) return;
    const life = kind === KIND_BERRY ? FOOD.bonusLifeSec : kind === KIND_GOLD ? FOOD.goldLifeSec : 0;
    state.foods.push({ ...cell, kind, life, maxLife: life, pulse: random.next() * Math.PI * 2 });
  }
  function spawnApple() { spawnFood(KIND_APPLE); }

  function addObstacles(count) {
    let added = 0;
    for (let tries = 0; tries < count * 20 && added < count; tries += 1) {
      const x = 2 + random.int(GRID.cols - 4);
      const y = 2 + random.int(GRID.rows - 4);
      const k = key(x, y);
      if (state.obstacles.has(k)) continue;
      // Keep a clear corridor around the snake's head and the food.
      let near = false;
      for (const s of state.snake) if (Math.abs(s.x - x) + Math.abs(s.y - y) < 3) near = true;
      for (const f of state.foods) if (Math.abs(f.x - x) + Math.abs(f.y - y) < 2) near = true;
      if (near) continue;
      state.obstacles.add(k);
      added += 1;
    }
  }

  function reset() {
    state.snake = [];
    for (let i = 0; i < SNAKE.startLength; i += 1) state.snake.push({ x: SNAKE.startX - i, y: SNAKE.startY });
    state.dir = 'right'; state.pendingDir = 'right';
    state.foods = []; state.obstacles = new Set();
    state.score = 0; state.level = 1; state.foodsEaten = 0; state.elapsed = 0; state.tickAcc = 0; state.tickProgress = 0;
    state.prevSnake = state.snake.map((s) => ({ ...s }));
    state.bonusTimer = 0; state.goldTimer = 0; state.over = false; state.won = false; state.dead = false;
    state.particles = []; state.floats = []; state.shake = 0; state.flash = 0;
    spawnApple();
  }

  function burst(x, y, color, n) {
    for (let i = 0; i < n; i += 1) {
      const a = random.next() * Math.PI * 2;
      const sp = 60 + random.next() * 180;
      state.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.5 + random.next() * 0.3, max: 0.8, color, size: 3 + random.next() * 4 });
    }
  }
  function floatText(x, y, text, color) { state.floats.push({ x, y, text, color, life: 0.9 }); }

  function doTick() {
    if (state.dir !== OPPOSITE[state.pendingDir] || state.snake.length === 1) state.dir = state.pendingDir;
    const head = state.snake[0];
    const d = DIRS[state.dir];
    const nx = head.x + d.x;
    const ny = head.y + d.y;
    // Walls and rocks kill.
    if (nx < 0 || ny < 0 || nx >= GRID.cols || ny >= GRID.rows || state.obstacles.has(key(nx, ny))) {
      state.over = true; state.dead = true; state.shake = 1; state.flash = 0.7; state.flashColor = '#ff2d55';
      return EVENT_OVER;
    }
    // Eating your own tail kills (the tail cell frees up unless you grow).
    const foodIndex = state.foods.findIndex((f) => f.x === nx && f.y === ny);
    const growing = foodIndex >= 0;
    const body = growing ? state.snake : state.snake.slice(0, -1);
    if (body.some((s) => s.x === nx && s.y === ny)) {
      state.over = true; state.dead = true; state.shake = 1; state.flash = 0.7; state.flashColor = '#ff2d55';
      return EVENT_OVER;
    }
    state.prevSnake = state.snake.map((s) => ({ ...s }));
    state.snake.unshift({ x: nx, y: ny });
    let events = 0;
    if (growing) {
      const food = state.foods[foodIndex];
      state.foods.splice(foodIndex, 1);
      state.foodsEaten += 1;
      const cx = GRID.originX + (nx + 0.5) * GRID.cell;
      const cy = GRID.originY + (ny + 0.5) * GRID.cell;
      if (food.kind === KIND_APPLE) {
        state.score += FOOD.normalPoints;
        burst(cx, cy, '#ff4d6d', 10);
        floatText(cx, cy - 10, '+' + FOOD.normalPoints, '#ff8fa3');
        events |= EVENT_EAT;
      } else if (food.kind === KIND_BERRY) {
        state.score += FOOD.bonusPoints;
        burst(cx, cy, '#c084fc', 16);
        floatText(cx, cy - 10, '+' + FOOD.bonusPoints, '#d8b4fe');
        events |= EVENT_BONUS;
      } else {
        state.score += FOOD.goldPoints;
        burst(cx, cy, '#facc15', 22);
        floatText(cx, cy - 10, '+' + FOOD.goldPoints, '#fde047');
        events |= EVENT_GOLD;
      }
      spawnApple();
      if (state.foodsEaten % FOOD.bonusEvery === 0) spawnFood(KIND_BERRY);
      if (state.foodsEaten % FOOD.goldEvery === 0) spawnFood(KIND_GOLD);
      const newLevel = Math.min(WIN_LEVEL, 1 + Math.floor(state.score / 50));
      if (newLevel > state.level) {
        state.level = newLevel;
        state.flash = 0.28; state.flashColor = '#facc15';
        addObstacles(Math.min(OBSTACLES.perLevel, OBSTACLES.max - state.obstacles.size));
        events |= EVENT_LEVEL;
      }
      if (state.score >= WIN_SCORE) {
        state.won = true; state.flash = 0.5; state.flashColor = '#facc15';
        events |= EVENT_WIN;
      }
    } else {
      state.snake.pop();
    }
    return events;
  }

  function step(dt, direction, harmless) {
    let events = 0;
    state.elapsed += dt;
    if (direction && direction !== OPPOSITE[state.dir]) state.pendingDir = direction;
    // Particles and floating scores always animate, even on the title screen.
    for (const p of state.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 220 * dt; p.life -= dt; }
    state.particles = state.particles.filter((p) => p.life > 0);
    for (const f of state.floats) { f.y -= 34 * dt; f.life -= dt; }
    state.floats = state.floats.filter((f) => f.life > 0);
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 2.2);
    if (state.flash > 0) state.flash = Math.max(0, state.flash - dt * 1.8);
    if (harmless || state.over || state.won) return events;
    // Bonus / gold food expire.
    for (const f of state.foods) if (f.life > 0) f.life -= dt;
    state.foods = state.foods.filter((f) => f.kind === KIND_APPLE || f.life > 0);
    state.tickAcc += dt * 1000;
    const interval = tickMs(state);
    while (state.tickAcc >= interval && !state.over && !state.won) {
      state.tickAcc -= interval;
      events |= doTick();
    }
    state.tickProgress = state.over || state.won ? 1 : Math.min(1, state.tickAcc / interval);
    return events;
  }

  reset();
  return { state, reset, step, tickMs: () => tickMs(state) };
}
