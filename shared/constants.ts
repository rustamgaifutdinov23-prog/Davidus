import type { UnitStats, FactionId, UnitType, BuildingType, TileType } from './types.js'

// ----------------------------------------------------------------
// Map config

export const MAP_WIDTH = 40
export const MAP_HEIGHT = 40
export const TILE_SIZE = 2         // world units per tile (Three.js)
export const SERVER_TICK_MS = 50   // 20 FPS game loop
export const FOG_UPDATE_MS = 200   // fog recalc interval
export const ECONOMY_TICK_SEC = 5  // income tick in seconds

// ----------------------------------------------------------------
// Unit stats (base, before faction modifiers)

export const UNIT_STATS: Record<UnitType, UnitStats> = {
  infantry: {
    maxHp: 60,
    attack: 10,
    defense: 5,
    speed: 3,       // tiles/sec
    range: 2,
    visionRange: 5,
    buildTime: 8,
    cost: 50,
  },
  tank: {
    maxHp: 150,
    attack: 30,
    defense: 20,
    speed: 2,
    range: 3,
    visionRange: 4,
    buildTime: 20,
    cost: 150,
  },
  antitank: {
    maxHp: 50,
    attack: 40,
    defense: 8,
    speed: 1.5,
    range: 4,
    visionRange: 4,
    buildTime: 15,
    cost: 120,
  },
  howitzer: {
    maxHp: 40,
    attack: 50,
    defense: 5,
    speed: 1,
    range: 6,
    visionRange: 3,
    buildTime: 25,
    cost: 200,
  },
}

// ----------------------------------------------------------------
// Building costs and income

export const BUILDING_COSTS: Record<BuildingType, number> = {
  headquarters: 0,         // spawned, not built
  barracks: 100,
  factory: 200,
  artillery_base: 250,
  admin_building: 80,
}

export const BUILDING_INCOME: Record<BuildingType, number> = {
  headquarters: 10,
  barracks: 0,
  factory: 0,
  artillery_base: 0,
  admin_building: 3,
}

export const RESOURCE_POINT_INCOME = 5   // per economy tick
export const CAPTURE_TIME_SEC = 3        // seconds to capture a resource point

// Which buildings produce which units
export const BUILDING_PRODUCES: Partial<Record<BuildingType, UnitType[]>> = {
  barracks: ['infantry'],
  factory: ['tank'],
  artillery_base: ['antitank', 'howitzer'],
}

// ----------------------------------------------------------------
// Terrain config

export const TERRAIN_SPEED: Record<TileType, number> = {
  grass: 1.0,
  forest: 0.5,
  mountain: 0,     // impassable
  road: 1.5,
  river: 0,        // impassable
  bridge: 0.8,
  swamp: 0.4,
}

export const TERRAIN_DEFENSE_BONUS: Record<TileType, number> = {
  grass: 0,
  forest: 0.3,     // +30% defense
  mountain: 0.5,
  road: 0,
  river: 0,
  bridge: 0,
  swamp: 0.1,
}

// Infantry can traverse forest, tanks cannot
export const INFANTRY_ONLY_TERRAIN: TileType[] = ['forest', 'swamp']

// ----------------------------------------------------------------
// Faction modifiers

export interface FactionModifiers {
  infantryCostMult: number
  tankSpeedMult: number
  startingBonusMoney: number
  forestInvisible: boolean
  color: string
}

export const FACTION_MODIFIERS: Record<FactionId, FactionModifiers> = {
  korea: {
    infantryCostMult: 0.9,
    tankSpeedMult: 1.0,
    startingBonusMoney: 0,
    forestInvisible: false,
    color: '#1a6fca',
  },
  japan: {
    infantryCostMult: 1.0,
    tankSpeedMult: 1.15,
    startingBonusMoney: 0,
    forestInvisible: false,
    color: '#d4483d',
  },
  china: {
    infantryCostMult: 1.0,
    tankSpeedMult: 1.0,
    startingBonusMoney: 100,
    forestInvisible: false,
    color: '#e8c440',
  },
  vietnam: {
    infantryCostMult: 1.0,
    tankSpeedMult: 1.0,
    startingBonusMoney: 0,
    forestInvisible: true,
    color: '#3da64f',
  },
}

// ----------------------------------------------------------------
// Combat formula
// damage = attacker.attack - defender.defense + rand(-2, 2)
// Terrain defense bonus applied: effectiveDefense = defense * (1 + terrainBonus)

export const COMBAT_RANDOM_RANGE = 2   // ±2
export const ATTACK_COOLDOWN_MS = 1500 // ms between auto-attacks
