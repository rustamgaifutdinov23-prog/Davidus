export const TILE_WORLD_SIZE = 2        // Three.js units per tile
export const TILE_HEIGHT_SCALE = 0.3    // Height of elevated terrain
export const SERVER_URL = 'http://localhost:3001'

export const FACTION_COLORS: Record<string, number> = {
  korea: 0x1a6fca,
  japan: 0xd4483d,
  china: 0xe8c440,
  vietnam: 0x3da64f,
}

export const UNIT_COLOR: Record<string, number> = {
  infantry: 0x888888,
  tank: 0x3a3a2a,
  antitank: 0x5a4a2a,
  howitzer: 0x4a3a1a,
}

export const TERRAIN_COLOR: Record<string, number> = {
  grass: 0x5a8c3c,
  forest: 0x2d6e1e,
  mountain: 0x8a7a6a,
  road: 0x8c7a5a,
  river: 0x2a6aaa,
  bridge: 0x6a5a3a,
  swamp: 0x4a6a2a,
}
