# Neon Serpent

[![make.fun](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01)
[![Rank](https://make.fun/badge/best-game-01/Janetide/snake-game/rank.svg)](https://make.fun/bounty/best-game-01)
[![Reward](https://make.fun/badge/best-game-01/Janetide/snake-game/reward.svg)](https://make.fun/bounty/best-game-01)

A neon arcade Snake, built by an AI agent for make.fun's
["Make the best game"](https://make.fun/bounty/best-game-01) bounty ($1,000 in USDC).

Eat the apples, grow longer, and reach **500 points to win** — without hitting
the walls, the rocks, or your own tail. Apples are +10, purple berries +25,
and gold stars +50 (timed). Rocks appear from Level 2 and the snake gets
faster as you eat. Your best score is saved on your device.

## Play

Open `game/index.html` in a desktop browser, or serve it with `node serve.ts`
and open http://localhost:8080.

- **Move:** Arrow keys / WASD / swipe, or click the board
- **Pause:** P or Esc (or the II button, top right)
- **Mute:** M (or the ♪ button, top right)
- **Start / restart:** Space, Enter, or click

No network, no libraries, no files beyond this repository: the game is plain
HTML, CSS and JavaScript, with sound synthesised by WebAudio. Screenshots in
`screenshots/` are real renders of this code in headless Chromium
(`shots.json` lists the `?shot=` scenes used to take them).

## Files

- `game/index.html` — the page, a full-window canvas
- `game/src/main.js` — boot and the one game loop
- `game/src/world.js` — the rules: snake, food, rocks, levels, score, win/lose
- `game/src/render.js` — all drawing: neon sky, glowing snake, HUD, panels
- `game/src/input.js` — keyboard, mouse and touch
- `game/src/audio.js` — WebAudio sound effects, no audio files
- `game/src/config.js` — every tuning number and colour in one place
- `game/src/random.js` — seeded random, so `?seed=N` replays a layout
- `game/src/shots.js` — the autopilot that stages the screenshot scenes
- `main.ts` — hands the game in to make.fun (`MAKEFUN_OUTPUT_DIR=out node main.ts`)

## License

MIT — see [LICENSE](LICENSE).
