# Davidus — Asian War RTS

Browser-based real-time strategy game inspired by R.U.S.E.
Asian war theme: Korea, Japan, China, Vietnam.

## Stack

- **Client**: Three.js (orthographic camera, realistic terrain), TypeScript, Vite
- **Server**: Node.js, Express, Socket.io, TypeScript
- **Multiplayer**: 2-4 players over internet

## Features

- Realistic isometric 3D view (like R.U.S.E.)
- Procedurally generated map: terrain, rivers, roads, bridges
- Fog of war
- Economy: income from HQ, resource points, admin buildings
- Units: Infantry, Tank, Anti-Tank Gun, Howitzer
- Buildings: Barracks, Factory, Artillery Base, Admin Building
- Real-time movement with A* pathfinding
- Auto-combat when units enter attack range
- Online multiplayer (2-4 players, room codes)

## Factions

| Faction | Bonus |
|---------|-------|
| Korea | Infantry -10% cost |
| Japan | Tanks +15% speed |
| China | +100 starting money |
| Vietnam | Infantry invisible in forest |

## Run

```bash
# Server
cd server && npm install && npm run dev

# Client (in another terminal)
cd client && npm install && npm run dev
```

Open http://localhost:3000
