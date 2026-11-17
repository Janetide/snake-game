// Neon Serpent: every tuning number and colour in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to
// the window, so no rule below depends on the screen size.
export const FIELD = { width: 1280, height: 720 };
export const GRID = { cols: 32, rows: 18, cell: 36, originX: 64, originY: 56 };
export const STEP = 1 / 60;
export const WIN_SCORE = 500;
export const WIN_LEVEL = 10;
export const BEST_KEY = 'neon-serpent.best';
export const MUTE_KEY = 'neon-serpent.muted';

export const SNAKE = { startLength: 4, startX: 16, startY: 9 };
export const FOOD = { normalPoints: 10, bonusPoints: 25, goldPoints: 50, bonusEvery: 5, goldEvery: 15, bonusLifeSec: 8, goldLifeSec: 6 };
// Tick interval (ms per grid step) at level 1, falling with level and length.
export const SPEED = { baseMs: 150, perLevelMs: 8, perFoodMs: 0.4, minMs: 70 };
// Rocks added per level from level 2 on.
export const OBSTACLES = { perLevel: 4, max: 28 };

export const PALETTE = {
  backdrop: '#070b16',
  sky: '#0b1226',
  board: '#0e1730',
  grid: '#16224a',
  hud: '#eef1f5',
  muted: '#8b93a3',
  panel: '#131c38',
  panelEdge: '#2b3a6b',
  snakeHead: '#7CFC9A',
  snakeBody: '#22c55e',
  snakeBelly: '#16a34a',
  apple: '#ff4d6d',
  berry: '#c084fc',
  gold: '#facc15',
  rock: '#475569',
  rockEdge: '#94a3b8',
  accent: '#38bdf8',
  danger: '#f87171',
};
export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
