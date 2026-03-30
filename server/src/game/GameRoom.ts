import { Server, Socket } from 'socket.io'
import { v4 as uuidv4 } from 'uuid'
import type {
  GameState, PlayerData, UnitData, BuildingData,
  FactionId, GameCommand, UnitType, BuildingType
} from '../../../shared/types'
import {
  UNIT_STATS, BUILDING_COSTS, BUILDING_HP, BUILDING_PRODUCES, BUILDING_INCOME,
  FACTION_MODIFIERS, SERVER_TICK_MS, FOG_UPDATE_MS, ECONOMY_TICK_SEC,
  CAPTURE_TIME_SEC, MAP_WIDTH, MAP_HEIGHT, ANTITANK_CHARGE_SEC, ANTITANK_BONUS_DAMAGE,
} from '../../../shared/constants'
import { generateMap } from './MapGenerator'
import { updateMovement } from '../systems/MovementSystem'
import { resolveCombat, checkAutoAttack } from '../systems/BattleResolver'
import { computeFogOfWar } from '../systems/FogOfWarServer'
import { tickEconomy } from '../systems/EconomyServer'
import { validateCommand } from '../systems/CommandValidator'
import { findPath, buildGridCache } from '../systems/PathfindingServer'

const FACTION_COLORS: Record<FactionId, string> = {
  korea: '#1a6fca',
  japan: '#d4483d',
  china: '#e8c440',
  vietnam: '#3da64f',
}

const TIMER_BROADCAST_SEC = 1   // broadcast timer every second

export class GameRoom {
  readonly id: string
  private io: Server
  private state: GameState
  private tickInterval: NodeJS.Timeout | null = null
  private fogInterval: NodeJS.Timeout | null = null
  private economyTimer = 0
  private timerAccum = 0
  private lastTick = Date.now()
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
      gameDurationSec: null,
      timeRemaining: 0,
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
      score: 0,
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

  startGame(gameDurationMinutes: number | null = null) {
    this.state.started = true
    this.state.gameDurationSec = gameDurationMinutes !== null ? gameDurationMinutes * 60 : null
    this.state.timeRemaining = this.state.gameDurationSec ?? 0
    this.state.map = generateMap(this.playerCount)

    const playerIds = Object.keys(this.state.players)
    const spawns = this.state.map.playerSpawns

    playerIds.forEach((pid, i) => {
      const spawn = spawns[i] ?? spawns[0]
      const player = this.state.players[pid]

      this.spawnBuilding(pid, player.faction, 'headquarters', spawn.x, spawn.y)
      this.spawnBuilding(pid, player.faction, 'barracks', spawn.x + 2, spawn.y)

      for (let u = 0; u < 3; u++) {
        this.spawnUnit(pid, player.faction, 'infantry', spawn.x + u, spawn.y + 2)
      }
      this.spawnUnit(pid, player.faction, 'tank', spawn.x + 1, spawn.y + 3)
    })

    // Pre-build pathfinding grid cache for 200x200 map
    buildGridCache(this.state.map)

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

    // Countdown timer
    if (this.state.gameDurationSec !== null) {
      this.state.timeRemaining = Math.max(0, this.state.timeRemaining - dtSec)
      this.timerAccum += dtSec
      if (this.timerAccum >= TIMER_BROADCAST_SEC) {
        this.timerAccum = 0
        this.io.to(this.id).emit('timerUpdate', { timeRemaining: this.state.timeRemaining })
      }
      if (this.state.timeRemaining <= 0) {
        this.endByTimer()
        return
      }
    }

    // Anti-tank charging logic
    this.tickAntiTankCharge(dtSec, now)

    // Movement
    updateMovement(this.state, dtSec)

    // Auto-attack
    checkAutoAttack(this.state)

    // Combat
    const deadIds = resolveCombat(this.state, now)
    for (const id of deadIds) {
      const unit = this.state.units[id]
      if (unit) this.awardKillScore(unit.ownerId, UNIT_STATS[unit.type].cost)
      this.io.to(this.id).emit('unitDied', { unitId: id })
    }

    // Resource capture
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

    // Broadcast tick
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

  // Infantry charging a tank: stand still 5 sec, then burst
  private tickAntiTankCharge(dtSec: number, now: number) {
    for (const unit of Object.values(this.state.units)) {
      if (unit.state === 'dead') continue
      if (unit.type !== 'infantry') continue
      if (unit.state !== 'charging') continue
      if (!unit.attackTargetId) continue

      const target = this.state.units[unit.attackTargetId]
      if (!target || target.state === 'dead' || target.type !== 'tank') {
        unit.state = 'idle'
        unit.chargeTimer = 0
        continue
      }

      unit.chargeTimer = (unit.chargeTimer ?? 0) + dtSec
      if (unit.chargeTimer >= ANTITANK_CHARGE_SEC) {
        // Fire
        const dist = Math.hypot(unit.x - target.x, unit.y - target.y)
        if (dist <= UNIT_STATS.infantry.range + 1) {
          target.hp = Math.max(0, target.hp - ANTITANK_BONUS_DAMAGE)
          if (target.hp <= 0) {
            target.state = 'dead'
            this.awardKillScore(unit.ownerId, UNIT_STATS.tank.cost)
            this.io.to(this.id).emit('unitDied', { unitId: target.id })
          }
        }
        unit.state = 'idle'
        unit.chargeTimer = 0
        unit.attackTargetId = null
      }
    }
  }

  private awardKillScore(killerOwnerId: string, points: number) {
    // Find killer player
    const killer = Object.values(this.state.players).find(
      p => p.id !== killerOwnerId
        ? false
        : true
    )
    if (!killer) return
    killer.score += points
    this.broadcastScores()
  }

  private broadcastScores() {
    const scores: Record<string, number> = {}
    for (const p of Object.values(this.state.players)) {
      scores[p.id] = p.score
    }
    this.io.to(this.id).emit('scoreUpdate', { scores })
  }

  private endByTimer() {
    this.state.gameOver = true
    // Winner is player with highest score
    const players = Object.values(this.state.players)
    players.sort((a, b) => b.score - a.score)
    const winner = players[0] ?? null
    this.state.winnerId = winner?.id ?? null
    this.io.to(this.id).emit('gameOver', { winner, reason: 'timeout' })
    this.stopLoop()
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
          unit.path = path.slice(1)
          unit.state = 'moving'
          unit.targetX = cmd.targetX
          unit.targetY = cmd.targetY
          unit.attackTargetId = null
          unit.chargeTimer = 0
        }
        break
      }

      case 'attack': {
        const unit = this.state.units[cmd.unitId]
        const target = this.state.units[cmd.targetUnitId]
        // Infantry targeting a tank → charging mode
        if (unit.type === 'infantry' && target?.type === 'tank') {
          const dist = Math.hypot(unit.x - target.x, unit.y - target.y)
          if (dist <= UNIT_STATS.infantry.range + 1) {
            unit.state = 'charging'
            unit.attackTargetId = cmd.targetUnitId
            unit.chargeTimer = 0
            unit.path = []
          } else {
            // Move closer first
            unit.state = 'moving'
            unit.attackTargetId = cmd.targetUnitId
            unit.targetX = target.x
            unit.targetY = target.y
          }
        } else {
          unit.state = 'attacking'
          unit.attackTargetId = cmd.targetUnitId
          unit.path = []
        }
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

  // Called externally when a building is destroyed
  notifyBuildingDestroyed(building: BuildingData, killerOwnerId: string) {
    this.awardKillScore(killerOwnerId, BUILDING_COSTS[building.type] || 50)
    building.state = 'destroyed'
    this.io.to(this.id).emit('buildingDestroyed', { buildingId: building.id })
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
      chargeTimer: 0,
    }
    this.state.units[id] = unit
    return unit
  }

  private spawnBuilding(ownerId: string, faction: FactionId, type: BuildingType, tileX: number, tileY: number): BuildingData {
    const id = uuidv4()
    const hp = BUILDING_HP[type] ?? 300
    const bldg: BuildingData = {
      id,
      type,
      ownerId,
      faction,
      tileX,
      tileY,
      hp,
      maxHp: hp,
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
      this.io.to(this.id).emit('gameOver', { winner: activePlayers[0] ?? null, reason: 'elimination' })
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
