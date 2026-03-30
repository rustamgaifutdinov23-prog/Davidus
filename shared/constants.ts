import type { UnitStats, FactionId, UnitType, BuildingType, TileType } from './types.js'

// ----------------------------------------------------------------
// Map config

export const MAP_WIDTH = 80
export const MAP_HEIGHT = 80
export const TILE_SIZE = 2         // world units per tile (Three.js)
export const SERVER_TICK_MS = 50   // 20 FPS game loop
export const FOG_UPDATE_MS = 300   // fog recalc interval
export const ECONOMY_TICK_SEC = 5  // income tick in seconds

// ----------------------------------------------------------------
// Game duration options (minutes, null = infinite)

export const GAME_DURATION_OPTIONS: (number | null)[] = [10, 15, 20, 30, null]

// ----------------------------------------------------------------
// Unit stats (base, before faction modifiers)

export const UNIT_STATS: Record<UnitType, UnitStats> = {
  infantry: {
    maxHp: 60,
    attack: 10,
    defense: 5,
    speed: 3,
    range: 2,
    visionRange: 5,
    buildTime: 8,
    cost: 50,
  },
  tank: {
    maxHp: 200,
    attack: 35,
    defense: 25,
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
// Building costs, HP and income

export const BUILDING_COSTS: Record<BuildingType, number> = {
  headquarters: 0,
  barracks: 100,
  factory: 200,
  artillery_base: 250,
  admin_building: 80,
}

export const BUILDING_HP: Record<BuildingType, number> = {
  headquarters: 800,
  barracks: 300,
  factory: 400,
  artillery_base: 350,
  admin_building: 250,
}

export const BUILDING_INCOME: Record<BuildingType, number> = {
  headquarters: 10,
  barracks: 0,
  factory: 0,
  artillery_base: 0,
  admin_building: 15,
}

export const RESOURCE_POINT_INCOME = 5
export const CAPTURE_TIME_SEC = 3

// Which buildings produce which units
export const BUILDING_PRODUCES: Partial<Record<BuildingType, UnitType[]>> = {
  barracks: ['infantry'],
  factory: ['tank'],
  artillery_base: ['antitank', 'howitzer'],
}

// ----------------------------------------------------------------
// Anti-tank charge mechanic
// Infantry targeting a tank stands still 5s then fires a big burst

export const ANTITANK_CHARGE_SEC = 5
export const ANTITANK_BONUS_DAMAGE = 120

// ----------------------------------------------------------------
// Terrain config

export const TERRAIN_SPEED: Record<TileType, number> = {
  grass: 1.0,
  forest: 0.5,
  mountain: 0,
  road: 1.5,
  river: 0,
  bridge: 0.8,
  swamp: 0.4,
}

export const TERRAIN_DEFENSE_BONUS: Record<TileType, number> = {
  grass: 0,
  forest: 0.3,
  mountain: 0.5,
  road: 0,
  river: 0,
  bridge: 0,
  swamp: 0.1,
}

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

export const COMBAT_RANDOM_RANGE = 2
export const ATTACK_COOLDOWN_MS = 1500
