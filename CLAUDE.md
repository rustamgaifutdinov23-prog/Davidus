# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Local development (two terminals)
```bash
# Terminal 1 — server (port 3001)
cd server && npm install && npm run dev

# Terminal 2 — client (port 3002)
cd client && npm install && npm run dev
# Open http://127.0.0.1:3002
```

### Production build (used by Railway)
```bash
npm run build   # from root — builds client then server
npm start       # runs node server/dist/server/src/index.js
```

### Type-check only
```bash
cd server && npx tsc --noEmit
cd client && npx tsc --noEmit
```

## Architecture

**Monorepo layout:**
- `shared/` — types and constants imported by both client and server (no runtime deps)
- `client/` — Vite + Three.js SPA
- `server/` — Express + Socket.io game server

**`shared/` is the single source of truth** for all game data: `types.ts` defines every interface (`GameState`, `UnitData`, `BuildingData`, etc.), `constants.ts` has all tunable values (`MAP_WIDTH/HEIGHT`, `UNIT_STATS`, `BUILDING_COSTS`, `FACTION_MODIFIERS`, etc.). Both sides import from `@shared/` alias.

### Client

Entry: `client/src/main.ts` — creates `NetworkManager`, `LobbyUI`, then on `onGameReady` creates `Game` and calls `game.start(gameState)`.

Key classes:
- `core/Game.ts` — orchestrator: holds all systems, wires network events to mesh updates, calls `game.start(gameState)` which initialises Three.js renderer and calls `initGameState()` directly (gameState passed in, NOT re-received from socket — avoid the race condition where `gameStarted` fires before `Game` is constructed)
- `core/Renderer.ts` — Three.js WebGLRenderer + scene + lighting setup
- `core/Camera.ts` — `RTSCamera` orthographic camera, WASD/arrow pan, scroll zoom, clamped to map bounds
- `map/TerrainMap.ts` — uses `InstancedMesh` per tile type (critical for 200×200 map performance), low-poly trees and mountains as individual meshes
- `map/FogOfWar.ts` — single `InstancedMesh` of 40 000 tiles, visibility toggled by scaling instances to 0
- `entities/Unit.ts` — procedural low-poly soldier and tank geometry; fallback box for antitank/howitzer
- `entities/Building.ts` — procedural low-poly buildings per type (HQ with towers, barracks, factory, artillery bunker, admin office)
- `systems/SelectionSystem.ts` — raycasting click-select + box-drag select; fires `onSelectUnits`
- `systems/BuildingPlacer.ts` — placement mode: ghost preview mesh on mousemove, green/red tint, ESC cancels, click sends `buildBuilding` command
- `ui/LobbyUI.ts` — lobby HTML, sets `net.onGameStarted` callback, calls `onGameReady(gameState)`
- `ui/HUD.ts` — top bar (money, timer, scores) + bottom bar (build buttons, selected unit cards, production panel); build buttons call `onBuildBuilding` callback which activates `BuildingPlacer`

`@shared` alias resolved via `vite.config.ts` (client) and `tsconfig.json` paths (server).

### Server

Entry: `server/src/index.ts` — Socket.io event handlers for `createRoom`, `joinRoom`, `startGame`, `command`, `disconnect`. `startGame` now accepts `{ gameDuration }` payload (minutes or null).

`server/src/game/GameRoom.ts` — main game loop at 20 FPS (`SERVER_TICK_MS = 50ms`):
- Runs movement, auto-attack, combat, capture, economy each tick
- **Timer**: counts down `timeRemaining`, broadcasts `timerUpdate` every second, calls `endByTimer()` at 0 (winner = highest score)
- **Scores**: `awardKillScore()` adds killed unit/building cost to killer's score, broadcasts `scoreUpdate`
- **Anti-tank charge**: infantry targeting a tank enters `charging` state, stands still for `ANTITANK_CHARGE_SEC` (5s), then fires `ANTITANK_BONUS_DAMAGE` (120) burst
- `buildGridCache()` called once on game start to pre-build A* grids for 200×200

`server/src/systems/PathfindingServer.ts` — caches two `PF.Grid` instances (`infantry` vs `vehicle`) so they aren't rebuilt per pathfinding call; `grid.clone()` used per A* call since the finder mutates the grid.

### Network flow

All communication via Socket.io events. Server → client: `gameStarted`, `stateTick` (20Hz positions), `fogUpdate` (300ms), `economyUpdate`, `scoreUpdate`, `timerUpdate`, `unitSpawned`, `unitDied`, `buildingBuilt`, `buildingDestroyed`, `gameOver`. Client → server: `command` (move/attack/buildUnit/buildBuilding/capture).

### Deployment

Railway auto-deploys from GitHub `main` branch. Live URL: `https://davidus-production.up.railway.app`. Build command: `npm run build` (root). Start: `node server/dist/server/src/index.js`. Client static files are served by Express from `client/dist/`.
