// The screenshot scenes behind ?shot=start|play|win|end. Each one plays the
// real rules forward from a fresh world, steered by an autopilot, so the
// frame is what a real game looks like and the same seed always gives the
// same frame. The pilot picks, at each tick, the direction that does not kill
// the snake now, keeps the most open space (flood fill), and gets closer to
// the best food. The end pilot is greedy and skips the flood fill, so it
// traps itself the way a hurried player does.
import { GRID, STEP } from './config.js';
import { EVENT_OVER, EVENT_WIN, key } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const DIRS = ['up', 'down', 'left', 'right'];
const VEC = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

function floodSpace(state, head) {
  const seen = new Set([key(head.x, head.y)]);
  const queue = [head];
  const body = new Set(state.snake.slice(0, -1).map((s) => key(s.x, s.y)));
  while (queue.length) {
    const cur = queue.pop();
    for (const d of DIRS) {
      const nx = cur.x + VEC[d][0];
      const ny = cur.y + VEC[d][1];
      const k = key(nx, ny);
      if (nx < 0 || ny < 0 || nx >= GRID.cols || ny >= GRID.rows) continue;
      if (seen.has(k) || body.has(k) || state.obstacles.has(k)) continue;
      seen.add(k);
      queue.push({ x: nx, y: ny });
    }
  }
  return seen.size;
}

function autopilot(state, careful) {
  const head = state.snake[0];
  const target = [...state.foods].sort((a, b) => {
    const va = a.kind === 2 ? 3 : a.kind === 1 ? 2 : 1;
    const vb = b.kind === 2 ? 3 : b.kind === 1 ? 2 : 1;
    return vb - va;
  })[0] || null;
  let bestDir = state.dir;
  let bestScore = -Infinity;
  for (const dir of DIRS) {
    // Do not reverse into the neck.
    const opp = { up: 'down', down: 'up', left: 'right', right: 'left' };
    if (dir === opp[state.dir]) continue;
    const nx = head.x + VEC[dir][0];
    const ny = head.y + VEC[dir][1];
    if (nx < 0 || ny < 0 || nx >= GRID.cols || ny >= GRID.rows) continue;
    if (state.obstacles.has(key(nx, ny))) continue;
    const eating = state.foods.some((f) => f.x === nx && f.y === ny);
    const body = eating ? state.snake : state.snake.slice(0, -1);
    if (body.some((s) => s.x === nx && s.y === ny)) continue;
    const space = careful ? floodSpace(state, { x: nx, y: ny }) : 100;
    if (careful && space < state.snake.length + 4) continue;
    const dist = target ? Math.abs(target.x - nx) + Math.abs(target.y - ny) : 0;
    const score = space * 2 - dist * 10 + (eating ? 50 : 0);
    if (score > bestScore) { bestScore = score; bestDir = dir; }
  }
  return bestDir;
}

/** Set `world` to the named scene and return the screen to draw and the best score. */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'win' && name !== 'end') {
    // Title: the fresh snake behind the panel; the panel carries the rules.
    return { screen: SCREEN_TITLE, best: 0 };
  }
  const careful = name !== 'end';
  const limit = name === 'win' ? 3600 : name === 'end' ? 600 : 40;
  for (let i = 0; i < limit / STEP; i += 1) {
    const events = world.step(STEP, autopilot(world.state, careful), false);
    if (events & EVENT_WIN) return { screen: SCREEN_WIN, best: world.state.score };
    if (events & EVENT_OVER) break;
  }
  if (world.state.won) return { screen: SCREEN_WIN, best: world.state.score };
  if (world.state.over) return { screen: SCREEN_OVER, best: world.state.score };
  return { screen: SCREEN_PLAY, best: world.state.score };
}
