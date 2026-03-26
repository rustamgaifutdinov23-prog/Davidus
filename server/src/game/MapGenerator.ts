import { createNoise2D } from 'simplex-noise'
import type { MapData, TileData, TileType, ResourcePoint } from '../../../shared/types'
import { MAP_WIDTH, MAP_HEIGHT } from '../../../shared/constants'
import { v4 as uuidv4 } from 'uuid'

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

export function generateMap(playerCount: number): MapData {
  const noise2D = createNoise2D()
  const tiles: TileData[][] = []

  // Generate base terrain via noise
  for (let y = 0; y < MAP_HEIGHT; y++) {
    tiles[y] = []
    for (let x = 0; x < MAP_WIDTH; x++) {
      const nx = x / MAP_WIDTH - 0.5
      const ny = y / MAP_HEIGHT - 0.5
      const height = noise2D(nx * 3, ny * 3) * 0.5 + noise2D(nx * 6, ny * 6) * 0.25

      let type: TileType = 'grass'
      if (height > 0.45) type = 'mountain'
      else if (height > 0.2) type = 'forest'
      else if (height < -0.35) type = 'swamp'

      tiles[y][x] = makeTile(x, y, type)
    }
  }

  // Generate rivers (1-2 rivers from top to bottom or left to right)
  generateRiver(tiles, false) // top→bottom
  if (MAP_WIDTH > 30) generateRiver(tiles, true) // left→right (cross)

  // Generate roads connecting player spawn points
  const spawns = getSpawns(playerCount)
  for (let i = 0; i < spawns.length - 1; i++) {
    carveRoad(tiles, spawns[i], spawns[i + 1])
  }

  // Clear spawn areas (3×3 grass)
  for (const spawn of spawns) {
    clearSpawn(tiles, spawn.x, spawn.y)
  }

  // Place bridges where roads cross rivers
  placeBridges(tiles)

  // Resource points in the center zone
  const resourcePoints = placeResourcePoints(tiles, playerCount)

  return {
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    tiles,
    resourcePoints,
    playerSpawns: spawns,
  }
}

function makeTile(x: number, y: number, type: TileType): TileData {
  const passability: Record<TileType, boolean> = {
    grass: true,
    forest: true,
    mountain: false,
    road: true,
    river: false,
    bridge: true,
    swamp: true,
  }
  const speed: Record<TileType, number> = {
    grass: 1.0,
    forest: 0.5,
    mountain: 0,
    road: 1.5,
    river: 0,
    bridge: 0.8,
    swamp: 0.4,
  }
  const defense: Record<TileType, number> = {
    grass: 0,
    forest: 0.3,
    mountain: 0.5,
    road: 0,
    river: 0,
    bridge: 0,
    swamp: 0.1,
  }

  return {
    x, y, type,
    passable: passability[type],
    speedMultiplier: speed[type],
    defenseBonus: defense[type],
  }
}

function generateRiver(tiles: TileData[][], horizontal: boolean) {
  const mid = horizontal
    ? Math.floor(MAP_HEIGHT / 2) + Math.floor(Math.random() * 6 - 3)
    : Math.floor(MAP_WIDTH / 2) + Math.floor(Math.random() * 6 - 3)

  let pos = mid
  const len = horizontal ? MAP_WIDTH : MAP_HEIGHT

  for (let i = 0; i < len; i++) {
    // Meander: small random drift
    pos = clamp(pos + Math.floor(Math.random() * 3 - 1), 1, (horizontal ? MAP_HEIGHT : MAP_WIDTH) - 2)

    const x = horizontal ? i : pos
    const y = horizontal ? pos : i

    if (tiles[y] && tiles[y][x]) {
      tiles[y][x] = makeTile(x, y, 'river')
      // River is 2 tiles wide at some points
      if (Math.random() > 0.6) {
        const nx = horizontal ? x : clamp(x + 1, 0, MAP_WIDTH - 1)
        const ny = horizontal ? clamp(y + 1, 0, MAP_HEIGHT - 1) : y
        if (tiles[ny] && tiles[ny][nx]) {
          tiles[ny][nx] = makeTile(nx, ny, 'river')
        }
      }
    }
  }
}

function carveRoad(tiles: TileData[][], from: { x: number; y: number }, to: { x: number; y: number }) {
  let { x, y } = from
  while (x !== to.x || y !== to.y) {
    if (tiles[y][x].type !== 'river' && tiles[y][x].type !== 'bridge') {
      tiles[y][x] = makeTile(x, y, 'road')
    }
    if (x !== to.x) x += x < to.x ? 1 : -1
    else if (y !== to.y) y += y < to.y ? 1 : -1
  }
}

function clearSpawn(tiles: TileData[][], cx: number, cy: number) {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const x = clamp(cx + dx, 0, MAP_WIDTH - 1)
      const y = clamp(cy + dy, 0, MAP_HEIGHT - 1)
      tiles[y][x] = makeTile(x, y, 'grass')
    }
  }
}

function placeBridges(tiles: TileData[][]) {
  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      if (tiles[y][x].type === 'road') {
        // Check if adjacent river tiles exist
        const neighbors = [
          { nx: x - 1, ny: y }, { nx: x + 1, ny: y },
          { nx: x, ny: y - 1 }, { nx: x, ny: y + 1 },
        ]
        for (const { nx, ny } of neighbors) {
          if (nx >= 0 && ny >= 0 && nx < MAP_WIDTH && ny < MAP_HEIGHT) {
            if (tiles[ny][nx].type === 'river') {
              tiles[ny][nx] = makeTile(nx, ny, 'bridge')
            }
          }
        }
      }
    }
  }
}

function getSpawns(playerCount: number): { x: number; y: number }[] {
  const margin = 3
  const w = MAP_WIDTH - 1
  const h = MAP_HEIGHT - 1
  const allSpawns = [
    { x: margin, y: margin },
    { x: w - margin, y: h - margin },
    { x: w - margin, y: margin },
    { x: margin, y: h - margin },
  ]
  return allSpawns.slice(0, playerCount)
}

function placeResourcePoints(tiles: TileData[][], playerCount: number): ResourcePoint[] {
  const points: ResourcePoint[] = []
  const count = 3 + playerCount
  const cx = Math.floor(MAP_WIDTH / 2)
  const cy = Math.floor(MAP_HEIGHT / 2)
  const candidates: { x: number; y: number }[] = []

  for (let y = cy - 8; y <= cy + 8; y++) {
    for (let x = cx - 8; x <= cx + 8; x++) {
      if (x > 0 && y > 0 && x < MAP_WIDTH - 1 && y < MAP_HEIGHT - 1) {
        if (tiles[y][x].passable) candidates.push({ x, y })
      }
    }
  }

  // Shuffle and pick
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[candidates[i], candidates[j]] = [candidates[j], candidates[i]]
  }

  for (let i = 0; i < Math.min(count, candidates.length); i++) {
    points.push({
      id: uuidv4(),
      x: candidates[i].x,
      y: candidates[i].y,
      ownerId: null,
      captureProgress: 0,
    })
  }

  return points
}
