// Drawing only: the world's state and the current screen in, pixels out.
// The 1280x720 playfield is scaled to fit the window and centred, the margin
// filled with the backdrop colour. Neon glow, a gradient sky with drifting
// aurora blobs and stars, smooth interpolated snake movement, particles,
// floating scores, screen shake and a flash on death or level-up are all
// drawn here; the game logic never draws.
import { FIELD, FONT, GRID, PALETTE, WIN_SCORE } from './config.js';
import { KIND_APPLE, KIND_BERRY, KIND_GOLD, tickMs } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const PANEL = { width: 680, top: 138, line: 32, bottom: 72 };

// Deterministic background stars: same sky every run, no random flicker.
const STARS = Array.from({ length: 90 }, (_, i) => {
  const h = (i * 2654435761) % 100000;
  return { x: (h % 1280), y: ((h * 7) % 720), r: 0.6 + (h % 10) / 12, tw: (h % 100) / 100 };
});

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  let time = 0;

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
    view.scale = Math.min(canvas.width / FIELD.width, canvas.height / FIELD.height);
    view.x = (canvas.width - FIELD.width * view.scale) / 2;
    view.y = (canvas.height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align = 'left', weight = '') {
    const key = weight + size;
    if (!fonts.has(key)) fonts.set(key, `${weight} ${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }
  function cellRect(x, y) {
    return { px: GRID.originX + x * GRID.cell, py: GRID.originY + y * GRID.cell, s: GRID.cell };
  }
  function lerp(a, b, t) { return a + (b - a) * t; }

  function drawSky() {
    const g = context.createLinearGradient(0, 0, 0, FIELD.height);
    g.addColorStop(0, '#0b1030');
    g.addColorStop(0.55, '#0a0f24');
    g.addColorStop(1, '#12082e');
    context.fillStyle = g;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    // Two slow aurora blobs drifting across the sky.
    const blobs = [
      { x: 320 + 180 * Math.sin(time * 0.11), y: 130, r: 340, c: 'rgba(16,185,129,0.13)' },
      { x: 980 + 160 * Math.sin(time * 0.07 + 2), y: 560, r: 360, c: 'rgba(139,92,246,0.14)' },
    ];
    for (const b of blobs) {
      const rg = context.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
      rg.addColorStop(0, b.c);
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      context.fillStyle = rg;
      context.fillRect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
    }
    for (const s of STARS) {
      context.globalAlpha = 0.25 + 0.45 * Math.abs(Math.sin(time * 1.4 + s.tw * 6));
      context.fillStyle = '#c7d2fe';
      context.beginPath();
      context.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  function drawBoard(state) {
    // Glass board: dark fill, soft glow edge, faint grid.
    context.save();
    context.shadowColor = 'rgba(56,189,248,0.35)';
    context.shadowBlur = 24;
    context.fillStyle = PALETTE.board;
    context.fillRect(GRID.originX - 8, GRID.originY - 8, GRID.cols * GRID.cell + 16, GRID.rows * GRID.cell + 16);
    context.restore();
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.strokeRect(GRID.originX - 8, GRID.originY - 8, GRID.cols * GRID.cell + 16, GRID.rows * GRID.cell + 16);
    context.strokeStyle = PALETTE.grid;
    context.lineWidth = 1;
    context.beginPath();
    for (let x = 1; x < GRID.cols; x += 1) {
      context.moveTo(GRID.originX + x * GRID.cell, GRID.originY);
      context.lineTo(GRID.originX + x * GRID.cell, GRID.originY + GRID.rows * GRID.cell);
    }
    for (let y = 1; y < GRID.rows; y += 1) {
      context.moveTo(GRID.originX, GRID.originY + y * GRID.cell);
      context.lineTo(GRID.originX + GRID.cols * GRID.cell, GRID.originY + y * GRID.cell);
    }
    context.stroke();
    // Rocks: faceted slate blocks with a top highlight.
    for (const k of state.obstacles) {
      const [x, y] = k.split(',').map(Number);
      const r = cellRect(x, y);
      context.fillStyle = PALETTE.rock;
      context.beginPath();
      context.roundRect(r.px + 4, r.py + 4, r.s - 8, r.s - 8, 7);
      context.fill();
      context.fillStyle = PALETTE.rockEdge;
      context.beginPath();
      context.roundRect(r.px + 9, r.py + 8, r.s - 22, 6, 3);
      context.fill();
      context.fillStyle = 'rgba(255,255,255,0.08)';
      context.beginPath();
      context.roundRect(r.px + 9, r.py + r.s - 14, r.s - 22, 4, 2);
      context.fill();
    }
    // Food: apple = glowing red orb, berry = purple diamond, gold = gold star.
    for (const f of state.foods) {
      const r = cellRect(f.x, f.y);
      const cx = r.px + r.s / 2;
      const cy = r.py + r.s / 2;
      const pulse = 1 + 0.14 * Math.sin(time * 5 + f.pulse);
      const color = f.kind === KIND_APPLE ? PALETTE.apple : f.kind === KIND_BERRY ? PALETTE.berry : PALETTE.gold;
      const rad = (r.s / 2 - 6) * pulse;
      context.save();
      context.shadowColor = color;
      context.shadowBlur = 18;
      context.fillStyle = color;
      if (f.kind === KIND_BERRY) {
        context.beginPath();
        context.moveTo(cx, cy - rad);
        context.lineTo(cx + rad * 0.85, cy);
        context.lineTo(cx, cy + rad);
        context.lineTo(cx - rad * 0.85, cy);
        context.closePath();
        context.fill();
      } else if (f.kind === KIND_GOLD) {
        context.beginPath();
        for (let i = 0; i < 10; i += 1) {
          const a = -Math.PI / 2 + i * Math.PI / 5;
          const rr = i % 2 === 0 ? rad : rad * 0.45;
          const px = cx + Math.cos(a) * rr;
          const py = cy + Math.sin(a) * rr;
          if (i === 0) context.moveTo(px, py); else context.lineTo(px, py);
        }
        context.closePath();
        context.fill();
      } else {
        context.beginPath();
        context.arc(cx, cy, rad, 0, Math.PI * 2);
        context.fill();
      }
      context.restore();
      context.fillStyle = 'rgba(255,255,255,0.9)';
      context.beginPath();
      context.arc(cx - rad * 0.3, cy - rad * 0.35, 3, 0, Math.PI * 2);
      context.fill();
      if (f.maxLife > 0) {
        context.strokeStyle = color;
        context.lineWidth = 3;
        context.beginPath();
        context.arc(cx, cy, r.s / 2 - 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, f.life / f.maxLife));
        context.stroke();
      }
    }
  }

  function drawSnake(state) {
    const snake = state.snake;
    const prev = state.prevSnake || [];
    // Smooth glide: each segment interpolates from its previous cell toward
    // its current cell, eased by tickProgress. New head grows from the old
    // head; a new tail segment stays where it appeared.
    const ease = state.tickProgress * state.tickProgress * (3 - 2 * state.tickProgress);
    const drawPos = snake.map((seg, i) => {
      const p = prev[i] || seg;
      const same = p.x === seg.x && p.y === seg.y;
      return { x: same ? seg.x : lerp(p.x, seg.x, ease), y: same ? seg.y : lerp(p.y, seg.y, ease) };
    });
    // Body first, tail to neck, with a soft neon glow.
    context.save();
    context.shadowColor = 'rgba(16,185,129,0.55)';
    context.shadowBlur = 14;
    for (let i = snake.length - 1; i >= 1; i -= 1) {
      const pos = drawPos[i];
      const t = snake.length <= 1 ? 0 : i / (snake.length - 1);
      context.fillStyle = t < 0.5 ? PALETTE.snakeBody : PALETTE.snakeBelly;
      const pad = 5;
      const px = GRID.originX + pos.x * GRID.cell + pad;
      const py = GRID.originY + pos.y * GRID.cell + pad;
      context.beginPath();
      context.roundRect(px, py, GRID.cell - pad * 2, GRID.cell - pad * 2, 9);
      context.fill();
    }
    context.restore();
    // Head: brighter, bigger glow, eyes looking where it travels.
    const headPos = drawPos[0];
    const hx = GRID.originX + headPos.x * GRID.cell;
    const hy = GRID.originY + headPos.y * GRID.cell;
    context.save();
    context.shadowColor = 'rgba(52,211,153,0.9)';
    context.shadowBlur = 22;
    context.fillStyle = PALETTE.snakeHead;
    context.beginPath();
    context.roundRect(hx + 2, hy + 2, GRID.cell - 4, GRID.cell - 4, 11);
    context.fill();
    context.restore();
    const cx = hx + GRID.cell / 2;
    const cy = hy + GRID.cell / 2;
    const dx = state.dir === 'left' ? -1 : state.dir === 'right' ? 1 : 0;
    const dy = state.dir === 'up' ? -1 : state.dir === 'down' ? 1 : 0;
    context.fillStyle = '#06281a';
    context.beginPath();
    context.arc(cx + dx * 6 - dy * 6, cy + dy * 6 - dx * 6, 3.5, 0, Math.PI * 2);
    context.arc(cx + dx * 6 + dy * 6, cy + dy * 6 + dx * 6, 3.5, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = 'rgba(255,255,255,0.85)';
    context.beginPath();
    context.arc(cx + dx * 6 - dy * 6 + 1, cy + dy * 6 - dx * 6 - 1, 1.2, 0, Math.PI * 2);
    context.arc(cx + dx * 6 + dy * 6 + 1, cy + dy * 6 + dx * 6 - 1, 1.2, 0, Math.PI * 2);
    context.fill();
  }

  function drawParticles(state) {
    for (const p of state.particles) {
      context.globalAlpha = Math.max(0, p.life / p.max);
      context.fillStyle = p.color;
      context.beginPath();
      context.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
    for (const f of state.floats) {
      context.globalAlpha = Math.max(0, f.life);
      context.save();
      context.shadowColor = f.color;
      context.shadowBlur = 10;
      text(f.text, f.x, f.y, 22, f.color, 'center', '800');
      context.restore();
    }
    context.globalAlpha = 1;
  }

  function drawHud(state, best, muted) {
    // Glass HUD bar: title, big score, best, level pill, speed, length, goal.
    context.fillStyle = 'rgba(10,16,38,0.78)';
    context.beginPath();
    context.roundRect(48, 8, 1184, 40, 12);
    context.fill();
    context.strokeStyle = 'rgba(148,163,184,0.25)';
    context.lineWidth = 1;
    context.stroke();
    const titleGrad = context.createLinearGradient(64, 0, 240, 0);
    titleGrad.addColorStop(0, '#34d399');
    titleGrad.addColorStop(1, '#38bdf8');
    context.fillStyle = titleGrad;
    context.font = `800 24px ${FONT}`;
    context.textAlign = 'left';
    context.textBaseline = 'alphabetic';
    context.fillText('NEON SERPENT', 64, 36);
    text(`Score ${state.score}`, 300, 36, 26, '#f8fafc', 'left', '800');
    text(`Best ${Math.max(best, state.score)}`, 470, 36, 20, PALETTE.muted, 'left');
    // Level pill.
    context.fillStyle = 'rgba(139,92,246,0.35)';
    context.beginPath();
    context.roundRect(600, 15, 96, 26, 13);
    context.fill();
    text(`LEVEL ${state.level}`, 648, 34, 18, '#e9d5ff', 'center', '800');
    const speed = (1000 / tickMs(state)).toFixed(1);
    text(`Speed ${speed}/s`, 730, 36, 20, PALETTE.hud, 'left', '700');
    text(`Length ${state.snake.length}`, 855, 36, 18, PALETTE.muted, 'left');
    text(`Goal ${WIN_SCORE}`, 965, 36, 18, PALETTE.gold, 'left', '700');
    // Mouse buttons, top right: pause, then mute.
    context.fillStyle = 'rgba(148,163,184,0.18)';
    context.beginPath();
    context.roundRect(1064, 13, 44, 30, 8);
    context.roundRect(1116, 13, 44, 30, 8);
    context.fill();
    text('II', 1086, 35, 18, PALETTE.hud, 'center', '700');
    text(muted ? '✕' : '♪', 1138, 35, 18, PALETTE.hud, 'center', '700');
    // Progress to the win: gold gradient bar with a percentage.
    const prog = Math.min(1, state.score / WIN_SCORE);
    context.fillStyle = 'rgba(148,163,184,0.25)';
    context.beginPath();
    context.roundRect(64, 54, 1152, 6, 3);
    context.fill();
    if (prog > 0) {
      const pg = context.createLinearGradient(64, 0, 1216, 0);
      pg.addColorStop(0, '#f59e0b');
      pg.addColorStop(1, '#facc15');
      context.fillStyle = pg;
      context.beginPath();
      context.roundRect(64, 54, Math.max(6, 1152 * prog), 6, 3);
      context.fill();
    }
    text(`${Math.round(prog * 100)}% to win`, 1216, 52, 14, PALETTE.muted, 'right');
  }

  function drawPanel(title, lines, prompt, accent, opts = {}) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    // Dim the board, then a glass panel with a glowing accent edge.
    context.fillStyle = 'rgba(4,8,20,0.66)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.save();
    context.shadowColor = accent || PALETTE.panelEdge;
    context.shadowBlur = 28;
    context.fillStyle = 'rgba(10,16,38,0.92)';
    context.beginPath();
    context.roundRect(x, y, PANEL.width, height, 18);
    context.fill();
    context.restore();
    context.strokeStyle = accent || PALETTE.panelEdge;
    context.lineWidth = 2;
    context.beginPath();
    context.roundRect(x, y, PANEL.width, height, 18);
    context.stroke();
    // Animated title: gentle pulse and a gradient fill.
    const pulse = 1 + 0.03 * Math.sin(time * 2.2);
    const titleSize = Math.round(52 * pulse);
    const tg = context.createLinearGradient(FIELD.width / 2 - 220, 0, FIELD.width / 2 + 220, 0);
    tg.addColorStop(0, accent || PALETTE.hud);
    tg.addColorStop(1, '#e0f2fe');
    context.save();
    context.shadowColor = accent || PALETTE.snakeHead;
    context.shadowBlur = 18;
    text(title, FIELD.width / 2, y + 76, titleSize, tg, 'center', '800');
    context.restore();
    lines.forEach((line, i) => text(line, FIELD.width / 2, y + PANEL.top + i * PANEL.line, 22, PALETTE.muted, 'center'));
    // Prompt blinks softly so the call to action is unmissable.
    context.globalAlpha = 0.65 + 0.35 * Math.sin(time * 3);
    text(prompt, FIELD.width / 2, y + height - 38, 24, PALETTE.gold, 'center', '700');
    context.globalAlpha = 1;
    if (opts.sparkles) {
      for (let i = 0; i < 14; i += 1) {
        const sx = x + ((i * 97) % PANEL.width);
        const sy = y + ((i * 53) % height) + 10 * Math.sin(time * 2 + i);
        context.globalAlpha = 0.4 + 0.4 * Math.sin(time * 3 + i * 1.3);
        context.fillStyle = i % 3 === 0 ? '#facc15' : i % 3 === 1 ? '#34d399' : '#38bdf8';
        context.beginPath();
        context.arc(sx, sy, 2.5, 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;
    }
  }

  function draw(state, screen, best, muted, dt) {
    time += dt || 0;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const shakeX = state.shake ? (Math.random() - 0.5) * state.shake * 14 : 0;
    const shakeY = state.shake ? (Math.random() - 0.5) * state.shake * 14 : 0;
    context.setTransform(view.scale, 0, 0, view.scale, view.x + shakeX * view.scale, view.y + shakeY * view.scale);
    drawSky();
    drawBoard(state);
    drawSnake(state);
    drawParticles(state);
    // Full-screen flash on death (red) or level-up / win (gold), fading out.
    if (state.flash > 0) {
      context.globalAlpha = Math.min(0.45, state.flash * 0.6);
      context.fillStyle = state.flashColor || '#ff2d55';
      context.fillRect(0, 0, FIELD.width, FIELD.height);
      context.globalAlpha = 1;
    }
    if (screen === SCREEN_TITLE) {
      drawHud({ ...state, score: 0, level: 1, snake: state.snake }, best, muted);
      drawPanel('NEON SERPENT', [
        'Eat the apples. Grow longer. Do not hit the walls,',
        'the rocks, or your own tail. Reach 500 points to win.',
        'Apples +10  ·  Purple berries +25  ·  Gold +50 (timed)',
        'Rocks appear from Level 2. The snake gets faster.',
        'Move: Arrow keys / WASD / swipe  ·  Pause: P  ·  Mute: M',
        `Best score: ${best}`,
      ], 'Press Space, Enter or click to start', PALETTE.snakeHead, { sparkles: true });
      return;
    }
    drawHud(state, best, muted);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['Take a breath. The snake is waiting.', `Score ${state.score}  ·  Level ${state.level}`], 'Press P or click to resume');
    } else if (screen === SCREEN_OVER) {
      drawPanel('Game Over', [
        `Score ${state.score}   ·   Best ${Math.max(best, state.score)}`,
        `Length ${state.snake.length}   ·   Level ${state.level}   ·   Food eaten ${state.foodsEaten}`,
        state.score >= 100 ? 'Nice run — one more try beats it.' : 'Warm up your fingers and go again.',
      ], 'Press Space, Enter or click to play again', PALETTE.danger);
    } else if (screen === SCREEN_WIN) {
      drawPanel('★ SERPENT MASTER ★', [
        `You reached ${state.score} points — the grid is yours.`,
        `Best ${Math.max(best, state.score)}   ·   Length ${state.snake.length}   ·   Level ${state.level}`,
        'You win! Play again for a higher score.',
      ], 'Press Space, Enter or click to play again', PALETTE.gold, { sparkles: true });
    } else if ('ontouchstart' in window) {
      // Touch hint, only on touch devices, below the board.
      text('◀ ▲ ▼ ▶  swipe to steer', FIELD.width / 2, FIELD.height - 12, 18, PALETTE.muted, 'center');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
