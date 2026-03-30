// ============================================================
// Shared types for client and server
// ============================================================

export type FactionId = 'korea' | 'japan' | 'china' | 'vietnam'

export type UnitType = 'infantry' | 'tank' | 'antitank' | 'howitzer'

export type BuildingType = 'headquarters' | 'barracks' | 'factory' | 'artillery_base' | 'admin_building'

export type TileType = 'grass' | 'forest' | 'mountain' | 'road' | 'river' | 'bridge' | 'swamp'

export type UnitState = 'idle' | 'moving' | 'attacking' | 'dead' | 'capturing' | 'charging'

export type BuildingState = 'idle' | 'producing' | 'destroyed'

// ----------------------------------------------------------------
// Map

export interface TileData {
  x: number
  y: number
  type: TileType
  passable: boolean
  speedMultiplier: number
  defenseBonus: number
}

export interface MapData {
  width: number
  height: number
  tiles: TileData[][]
  resourcePoints: ResourcePoint[]
  playerSpawns: { x: number; y: number }[]
}

export interface ResourcePoint {
  id: string
  x: number
  y: number
  ownerId: string | null
  captureProgress: number // 0-100
}

// ----------------------------------------------------------------
// Units

export interface UnitStats {
  maxHp: number
  attack: number
  defense: number
  speed: number
  range: number
  visionRange: number
  buildTime: number
  cost: number
}

export interface UnitData {
  id: string
  type: UnitType
  ownerId: string
  faction: FactionId
  x: number
  y: number
  hp: number
  maxHp: number
  state: UnitState
  targetX: number | null
  targetY: number | null
  attackTargetId: string | null
  path: { x: number; y: number }[]
  chargeTimer?: number   // seconds charging for anti-tank shot
}

// ----------------------------------------------------------------
// Buildings

export interface BuildingData {
  id: string
  type: BuildingType
  ownerId: string
  faction: FactionId
  tileX: number
  tileY: number
  hp: number
  maxHp: number
  state: BuildingState
  productionQueue: UnitType[]
  productionTimer: number
  incomePerTick: number
}

// ----------------------------------------------------------------
// Player

export interface PlayerData {
  id: string
  name: string
  faction: FactionId
  money: number
  income: number
  score: number
  isConnected: boolean
  color: string
}

// ----------------------------------------------------------------
// Game state

export interface GameState {
  roomId: string
  players: Record<string, PlayerData>
  units: Record<string, UnitData>
  buildings: Record<string, BuildingData>
  map: MapData
  tick: number
  started: boolean
  gameOver: boolean
  winnerId: string | null
  gameDurationSec: number | null   // null = infinite
  timeRemaining: number            // seconds, counts down
}

// ----------------------------------------------------------------
// Network messages

export interface StateTick {
  units: Pick<UnitData, 'id' | 'x' | 'y' | 'hp' | 'state' | 'ownerId' | 'attackTargetId'>[]
  tick: number
  ts: number
}

export interface FogUpdate {
  playerId: string
  visibleTiles: [number, number][]
  visibleUnitIds: string[]
}

export interface EconomyUpdate {
  playerId: string
  money: number
  income: number
}

export interface ScoreUpdate {
  scores: Record<string, number>   // playerId → score
}

export interface TimerUpdate {
  timeRemaining: number
}

// ----------------------------------------------------------------
// Commands (client → server)

export interface MoveCommand {
  type: 'move'
  unitId: string
  targetX: number
  targetY: number
}

export interface AttackCommand {
  type: 'attack'
  unitId: string
  targetUnitId: string
}

export interface BuildUnitCommand {
  type: 'buildUnit'
  buildingId: string
  unitType: UnitType
}

export interface BuildBuildingCommand {
  type: 'buildBuilding'
  tileX: number
  tileY: number
  buildingType: BuildingType
}

export interface CaptureCommand {
  type: 'capture'
  unitId: string
  pointId: string
}

export type GameCommand =
  | MoveCommand
  | AttackCommand
  | BuildUnitCommand
  | BuildBuildingCommand
  | CaptureCommand
