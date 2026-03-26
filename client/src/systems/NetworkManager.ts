import { io, Socket } from 'socket.io-client'
import { SERVER_URL } from '../utils/constants.js'
import type { GameState, GameCommand, FactionId, StateTick, FogUpdate, EconomyUpdate } from '@shared/types.js'

type Callback<T> = (data: T) => void

export class NetworkManager {
  private socket: Socket
  public playerId = ''

  // Callbacks
  onGameStarted: Callback<{ gameState: GameState }> = () => {}
  onStateTick: Callback<StateTick> = () => {}
  onFogUpdate: Callback<FogUpdate> = () => {}
  onEconomyUpdate: Callback<EconomyUpdate> = () => {}
  onUnitSpawned: Callback<{ unit: any }> = () => {}
  onUnitDied: Callback<{ unitId: string }> = () => {}
  onBuildingBuilt: Callback<{ building: any }> = () => {}
  onPointCaptured: Callback<{ pointId: string; playerId: string }> = () => {}
  onGameOver: Callback<{ winner: any }> = () => {}
  onPlayerJoined: Callback<{ playerId: string; name: string; faction: FactionId }> = () => {}
  onPlayerLeft: Callback<{ playerId: string }> = () => {}

  constructor() {
    this.socket = io(SERVER_URL)
    this.playerId = ''

    this.socket.on('connect', () => {
      this.playerId = this.socket.id ?? ''
      console.log('[Net] Connected:', this.playerId)
    })

    this.socket.on('gameStarted', (data) => this.onGameStarted(data))
    this.socket.on('stateTick', (data) => this.onStateTick(data))
    this.socket.on('fogUpdate', (data) => this.onFogUpdate(data))
    this.socket.on('economyUpdate', (data) => this.onEconomyUpdate(data))
    this.socket.on('unitSpawned', (data) => this.onUnitSpawned(data))
    this.socket.on('unitDied', (data) => this.onUnitDied(data))
    this.socket.on('buildingBuilt', (data) => this.onBuildingBuilt(data))
    this.socket.on('pointCaptured', (data) => this.onPointCaptured(data))
    this.socket.on('gameOver', (data) => this.onGameOver(data))
    this.socket.on('playerJoined', (data) => this.onPlayerJoined(data))
    this.socket.on('playerLeft', (data) => this.onPlayerLeft(data))
  }

  createRoom(name: string, faction: FactionId): Promise<{ ok: boolean; roomId?: string; error?: string }> {
    return new Promise((resolve) => {
      this.socket.emit('createRoom', { name, faction }, resolve)
    })
  }

  joinRoom(roomId: string, name: string, faction: FactionId): Promise<{ ok: boolean; gameState?: GameState; error?: string }> {
    return new Promise((resolve) => {
      this.socket.emit('joinRoom', { roomId, name, faction }, resolve)
    })
  }

  startGame(): Promise<{ ok: boolean; error?: string }> {
    return new Promise((resolve) => {
      this.socket.emit('startGame', resolve)
    })
  }

  sendCommand(cmd: GameCommand) {
    this.socket.emit('command', cmd)
  }
}
