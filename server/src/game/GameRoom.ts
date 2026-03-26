import { Server, Socket } from 'socket.io'
import { v4 as uuidv4 } from 'uuid'
import type {
  GameState, PlayerData, UnitData, BuildingData,
  FactionId, GameCommand, UnitType, BuildingType
} from '../../../shared/types'
import {
  UNIT_STATS, BUILDING_COSTS, BUILDING_PRODUCES, BUILDING_INCOME,
  FACTION_MODIFIERS, SERVER_TICK_MS, FOG_UPDATE_MS, ECONOMY_TICK_SEC,
  CAPTURE_TIME_SEC, MAP_WIDTH, MAP_HEIGHT
} from '../../../shared/constants'
import { generateMap } from './MapGenerator'
import { updateMovement } from '../systems/MovementSystem'
import { resolveCombat, checkAutoAttack } from '../systems/BattleResolver'
import { computeFogOfWar } from '../systems/FogOfWarServer'
import { tickEconomy } from '../systems/EconomyServer'
import { validateCommand } from '../systems/CommandValidator'
import { findPath } from '../systems/PathfindingServer'

const FACTION_COLORS: Record<FactionId, string> = {
  korea: '#1a6fca',
  japan: '#d4483d',
  china: '#e8c440',
  vietnam: '#3da64f',
}

export class GameRoom {
  readonly id: string
  private io: Server
  private state: GameState
  private tickInterval: NodeJS.Timeout | null = null
  private fogInterval: NodeJS.Timeout | null = null
  private economyTimer = 0
  private lastTick = Date.now()
  private lastFog = Date.now()
  maxPlayers = 4

  constructor(id: string, io: Server) {
    this.id = id
    this.io = io
    this.state = {
      roomId: id,
      players: {},
      units: {},
      buildings: {},
      map: generateMap(2),
      tick: 0,
      started: false,
      gameOver: false,
      winnerId: null,
    }
  }

  get playerCount() {
    return Object.keys(this.state.players).length
  }

  addPlayer(socket: Socket, name: string, faction: FactionId): string {
    const playerId = socket.id
    const mods = FACTION_MODIFIERS[faction]
    const player: PlayerData = {
      id: playerId,
      name,
      faction,
      money: 200 + mods.startingBonusMoney,
      income: 0,
      isConnected: true,
      color: FACTION_COLORS[faction],
    }
    this.state.players[playerId] = player
    socket.join(this.id)
    return playerId
  }

  removePlayer(playerId: string) {
    if (this.state.players[playerId]) {
      this.state.players[playerId].isConnected = false
    }
    const activePlayers = Object.values(this.state.players).filter(p => p.isConnected)
    if (activePlayers.length <= 1 && this.state.started) {
      this.checkWinCondition()
    }
  }

  startGame() {
    this.state.started = true
    this.state.map = generateMap(this.playerCount)

    // Spawn HQ + starting units for each player
    const playerIds = Object.keys(this.state.players)
    const spawns = this.state.map.playerSpawns

    playerIds.forEach((pid, i) => {
      const spawn = spawns[i] ?? spawns[0]
      const player = this.state.players[pid]

      // HQ building
      this.spawnBuilding(pid, player.faction, 'headquarters', spawn.x, spawn.y)

      // Barracks next to HQ
      this.spawnBuilding(pid, player.faction, 'barracks', spawn.x + 2, spawn.y)

      // Starting units: 3 infantry
      for (let u = 0; u < 3; u++) {
        this.spawnUnit(pid, player.faction, 'infantry', spawn.x + u, spawn.y + 1)
      }
      // 1 tank
      this.spawnUnit(pid, player.faction, 'tank', spawn.x, spawn.y + 2)
    })

    this.io.to(this.id).emit('gameStarted', { gameState: this.getPublicState() })
    this.startLoop()
  }

  private startLoop() {
    this.lastTick = Date.now()

    this.tickInterval = setInterval(() => {
      const now = Date.now()
      const dt = (now - this.lastTick) / 1000
      this.lastTick = now
      this.tick(dt, now)
    }, SERVER_TICK_MS)

    this.fogInterval = setInterval(() => {
      this.broadcastFog()
    }, FOG_UPDATE_MS)
  }

  private tick(dtSec: number, now: number) {
    if (this.state.gameOver) return

    // Movement
    updateMovement(this.state, dtSec)

    // Auto-attack check
    checkAutoAttack(this.state)

    // Combat
    const deadIds = resolveCombat(this.state, now)
    for (const id of deadIds) {
      this.io.to(this.id).emit('unitDied', { unitId: id })
    }

    // Resource point capture
    this.tickCapture(dtSec)

    // Economy
    this.economyTimer += dtSec
    if (this.economyTimer >= ECONOMY_TICK_SEC) {
      this.economyTimer = 0
      tickEconomy(this.state)
      for (const player of Object.values(this.state.players)) {
        this.io.to(player.id).emit('economyUpdate', {
          playerId: player.id,
          money: player.money,
          income: player.income,
        })
      }
    }

    // Broadcast state tick
    this.state.tick++
    const tickPayload = {
      units: Object.values(this.state.units)
        .filter(u => u.state !== 'dead')
        .map(u => ({
          id: u.id,
          x: u.x,
          y: u.y,
          hp: u.hp,
          state: u.state,
          ownerId: u.ownerId,
          attackTargetId: u.attackTargetId,
        })),
      tick: this.state.tick,
      ts: Date.now(),
    }
    this.io.to(this.id).emit('stateTick', tickPayload)

    this.checkWinCondition()
  }

  private tickCapture(dtSec: number) {
    for (const point of this.state.map.resourcePoints) {
      for (const unit of Object.values(this.state.units)) {
        if (unit.type !== 'infantry' || unit.state === 'dead') continue
        if (unit.state !== 'capturing') continue
        const dist = Math.hypot(unit.x - point.x, unit.y - point.y)
        if (dist < 1 && unit.attackTargetId === point.id) {
          if (point.ownerId !== unit.ownerId) {
            point.captureProgress += (dtSec / CAPTURE_TIME_SEC) * 100
            if (point.captureProgress >= 100) {
              point.captureProgress = 100
              const prevOwner = point.ownerId
              point.ownerId = unit.ownerId
              unit.state = 'idle'
              unit.attackTargetId = null
              this.io.to(this.id).emit('pointCaptured', { pointId: point.id, playerId: unit.ownerId, prevOwner })
            }
          }
        }
      }
    }
  }

  handleCommand(playerId: string, cmd: GameCommand) {
    const result = validateCommand(this.state, playerId, cmd)
    if (!result.ok) {
      this.io.to(playerId).emit('commandError', { error: result.error })
      return
    }

    switch (cmd.type) {
      case 'move': {
        const unit = this.state.units[cmd.unitId]
        const path = findPath(this.state.map, unit.x, unit.y, cmd.targetX, cmd.targetY, unit.type)
        if (path.length > 0) {
          unit.path = path.slice(1) // skip current position
          unit.state = 'moving'
          unit.targetX = cmd.targetX
          unit.targetY = cmd.targetY
          unit.attackTargetId = null
        }
        break
      }

      case 'attack': {
        const unit = this.state.units[cmd.unitId]
        unit.state = 'attacking'
        unit.attackTargetId = cmd.targetUnitId
        unit.path = []
        break
      }

      case 'buildUnit': {
        const building = this.state.buildings[cmd.buildingId]
        const player = this.state.players[playerId]
        const mods = FACTION_MODIFIERS[player.faction]
        const baseCost = UNIT_STATS[cmd.unitType].cost
        const cost = cmd.unitType === 'infantry'
          ? Math.floor(baseCost * mods.infantryCostMult)
          : baseCost
        player.money -= cost
        building.productionQueue.push(cmd.unitType)

        if (building.state === 'idle') {
          building.state = 'producing'
          building.productionTimer = UNIT_STATS[cmd.unitType].buildTime
          // Schedule spawn
          this.scheduleUnitSpawn(building, cmd.unitType, playerId, player.faction)
        }
        this.io.to(playerId).emit('buildQueued', { buildingId: building.id, unitType: cmd.unitType })
        break
      }

      case 'buildBuilding': {
        const player = this.state.players[playerId]
        const cost = BUILDING_COSTS[cmd.buildingType]
        player.money -= cost
        const building = this.spawnBuilding(playerId, player.faction, cmd.buildingType, cmd.tileX, cmd.tileY)
        this.io.to(this.id).emit('buildingBuilt', { building })
        break
      }

      case 'capture': {
        const unit = this.state.units[cmd.unitId]
        const point = this.state.map.resourcePoints.find(p => p.id === cmd.pointId)
        if (!point) break
        const dist = Math.hypot(unit.x - point.x, unit.y - point.y)
        if (dist > 1.5) {
          // Move toward point first
          const path = findPath(this.state.map, unit.x, unit.y, point.x, point.y, unit.type)
          unit.path = path.slice(1)
          unit.state = 'moving'
        } else {
          unit.state = 'capturing'
          unit.attackTargetId = point.id
        }
        break
      }
    }
  }

  private scheduleUnitSpawn(building: BuildingData, unitType: UnitType, ownerId: string, faction: FactionId) {
    const buildTime = UNIT_STATS[unitType].buildTime * 1000
    setTimeout(() => {
      if (building.state === 'destroyed') return
      const unit = this.spawnUnit(ownerId, faction, unitType, building.tileX + 1, building.tileY)
      building.productionQueue.shift()
      if (building.productionQueue.length > 0) {
        const next = building.productionQueue[0]
        building.productionTimer = UNIT_STATS[next].buildTime
        this.scheduleUnitSpawn(building, next, ownerId, faction)
      } else {
        building.state = 'idle'
      }
      this.io.to(this.id).emit('unitSpawned', { unit })
    }, buildTime)
  }

  private spawnUnit(ownerId: string, faction: FactionId, type: UnitType, x: number, y: number): UnitData {
    const stats = UNIT_STATS[type]
    const id = uuidv4()
    const unit: UnitData = {
      id,
      type,
      ownerId,
      faction,
      x,
      y,
      hp: stats.maxHp,
      maxHp: stats.maxHp,
      state: 'idle',
      targetX: null,
      targetY: null,
      attackTargetId: null,
      path: [],
    }
    this.state.units[id] = unit
    return unit
  }

  private spawnBuilding(ownerId: string, faction: FactionId, type: BuildingType, tileX: number, tileY: number): BuildingData {
    const id = uuidv4()
    const bldg: BuildingData = {
      id,
      type,
      ownerId,
      faction,
      tileX,
      tileY,
      hp: 200,
      maxHp: 200,
      state: 'idle',
      productionQueue: [],
      productionTimer: 0,
      incomePerTick: BUILDING_INCOME[type] ?? 0,
    }
    this.state.buildings[id] = bldg
    return bldg
  }

  private broadcastFog() {
    const fogResults = computeFogOfWar(this.state)
    for (const fog of fogResults) {
      this.io.to(fog.playerId).emit('fogUpdate', fog)
    }
  }

  private checkWinCondition() {
    if (this.state.gameOver) return
    const activePlayers = Object.values(this.state.players).filter(p => p.isConnected)
    if (activePlayers.length <= 1) {
      this.state.gameOver = true
      this.state.winnerId = activePlayers[0]?.id ?? null
      this.io.to(this.id).emit('gameOver', { winner: activePlayers[0] ?? null })
      this.stopLoop()
    }
  }

  private stopLoop() {
    if (this.tickInterval) clearInterval(this.tickInterval)
    if (this.fogInterval) clearInterval(this.fogInterval)
  }

  getPublicState() {
    return this.state
  }

  getPlayerIds() {
    return Object.keys(this.state.players)
  }
}
