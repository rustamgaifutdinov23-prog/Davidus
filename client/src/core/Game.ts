import * as THREE from 'three'
import { Renderer } from './Renderer.js'
import { RTSCamera } from './Camera.js'
import { TerrainMap } from '../map/TerrainMap.js'
import { FogOfWar } from '../map/FogOfWar.js'
import { NetworkManager } from '../systems/NetworkManager.js'
import { SelectionSystem } from '../systems/SelectionSystem.js'
import { UnitMesh } from '../entities/Unit.js'
import { BuildingMesh } from '../entities/Building.js'
import type { GameState, StateTick, FogUpdate, UnitData, BuildingData } from '@shared/types.js'
import { raycastTile } from '../utils/isoMath.js'
import { HUD } from '../ui/HUD.js'

export class Game {
  private renderer: Renderer
  private rtsCamera: RTSCamera
  private terrain: TerrainMap
  private fog: FogOfWar
  public network: NetworkManager
  private selection: SelectionSystem
  private hud: HUD

  private unitMeshes = new Map<string, UnitMesh>()
  private buildingMeshes = new Map<string, BuildingMesh>()

  private lastTime = 0
  private animId = 0
  private gameState: GameState | null = null
  public playerId = ''

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new Renderer(canvas)
    this.rtsCamera = new RTSCamera()
    this.terrain = new TerrainMap()
    this.fog = new FogOfWar()
    this.network = new NetworkManager()
    this.selection = new SelectionSystem(this.rtsCamera.camera, canvas)
    this.hud = new HUD()

    this.setupNetworkHandlers()
    this.setupSelectionHandlers(canvas)

    window.addEventListener('resize', () => {
      this.renderer.renderer.setSize(window.innerWidth, window.innerHeight)
      this.rtsCamera.onResize()
    })
  }

  private setupNetworkHandlers() {
    this.network.onGameStarted = ({ gameState }) => {
      this.playerId = this.network.playerId
      this.initGameState(gameState)
    }

    this.network.onStateTick = (tick: StateTick) => {
      this.applyStateTick(tick)
    }

    this.network.onFogUpdate = (fog: FogUpdate) => {
      if (fog.playerId === this.playerId) {
        this.fog.update(fog.visibleTiles)
        // Hide enemy units not in visible set
        for (const [id, um] of this.unitMeshes) {
          if (um.ownerId !== this.playerId) {
            um.mesh.visible = fog.visibleUnitIds.includes(id)
          }
        }
      }
    }

    this.network.onEconomyUpdate = (eco) => {
      if (eco.playerId === this.playerId) {
        this.hud.updateEconomy(eco.money, eco.income)
      }
    }

    this.network.onUnitSpawned = ({ unit }) => {
      this.addUnitMesh(unit)
    }

    this.network.onUnitDied = ({ unitId }) => {
      const um = this.unitMeshes.get(unitId)
      if (um) {
        um.destroy()
        this.unitMeshes.delete(unitId)
      }
    }

    this.network.onBuildingBuilt = ({ building }) => {
      this.addBuildingMesh(building)
    }

    this.network.onGameOver = ({ winner }) => {
      this.hud.showGameOver(winner?.name ?? 'Nobody')
    }
  }

  private setupSelectionHandlers(canvas: HTMLCanvasElement) {
    this.selection.onSelectUnits = (ids) => {
      this.hud.showSelectedUnits(ids, this.gameState)
    }

    this.selection.onRightClick = (tileX: number, tileY: number) => {
      const selected = this.selection.selectedUnitIds
      if (selected.length === 0) return

      for (const unitId of selected) {
        this.network.sendCommand({
          type: 'move',
          unitId,
          targetX: tileX,
          targetY: tileY,
        })
      }
    }

    // Attack: click on enemy unit with A key held
    canvas.addEventListener('click', (e) => {
      // handled in SelectionSystem
    })
  }

  private initGameState(state: GameState) {
    this.gameState = state
    this.terrain.build(this.renderer.scene, state.map)
    this.fog.build(this.renderer.scene, state.map)

    // Spawn all units
    for (const unit of Object.values(state.units)) {
      this.addUnitMesh(unit)
    }
    // Spawn all buildings
    for (const building of Object.values(state.buildings)) {
      this.addBuildingMesh(building)
    }

    this.selection.setUnitMeshes(this.unitMeshes)
  }

  private addUnitMesh(unit: UnitData) {
    const um = new UnitMesh(unit)
    this.renderer.scene.add(um.mesh)
    this.unitMeshes.set(unit.id, um)
    this.selection.setUnitMeshes(this.unitMeshes)
  }

  private addBuildingMesh(building: BuildingData) {
    const bm = new BuildingMesh(building)
    this.renderer.scene.add(bm.mesh)
    this.buildingMeshes.set(building.id, bm)
  }

  private applyStateTick(tick: StateTick) {
    for (const u of tick.units) {
      const um = this.unitMeshes.get(u.id)
      if (um) {
        um.setPosition(u.x, u.y)
        // Find maxHp
        const unitData = this.gameState?.units[u.id]
        const maxHp = unitData?.maxHp ?? 100
        um.updateHp(u.hp, maxHp)
      }
    }

    // Update gameState units reference
    if (this.gameState) {
      for (const u of tick.units) {
        if (this.gameState.units[u.id]) {
          this.gameState.units[u.id].x = u.x
          this.gameState.units[u.id].y = u.y
          this.gameState.units[u.id].hp = u.hp
          this.gameState.units[u.id].state = u.state
        }
      }
    }
  }

  start() {
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement
    canvas.style.display = 'block'
    this.lastTime = performance.now()
    this.loop(this.lastTime)
  }

  private loop = (now: number) => {
    const dt = Math.min((now - this.lastTime) / 1000, 0.1)
    this.lastTime = now

    this.rtsCamera.update(dt)
    this.terrain.update(dt)

    for (const um of this.unitMeshes.values()) {
      um.update(dt)
    }

    this.renderer.render(this.rtsCamera.camera)
    this.animId = requestAnimationFrame(this.loop)
  }

  stop() {
    cancelAnimationFrame(this.animId)
  }
}
