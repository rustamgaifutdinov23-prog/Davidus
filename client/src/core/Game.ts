import * as THREE from 'three'
import { Renderer } from './Renderer.js'
import { RTSCamera } from './Camera.js'
import { TerrainMap } from '../map/TerrainMap.js'
import { FogOfWar } from '../map/FogOfWar.js'
import { NetworkManager } from '../systems/NetworkManager.js'
import { SelectionSystem } from '../systems/SelectionSystem.js'
import { BuildingPlacer } from '../systems/BuildingPlacer.js'
import { UnitMesh } from '../entities/Unit.js'
import { BuildingMesh } from '../entities/Building.js'
import type { GameState, StateTick, FogUpdate, UnitData, BuildingData, BuildingType } from '@shared/types.js'
import { HUD } from '../ui/HUD.js'
import { TILE_WORLD_SIZE } from '../utils/constants.js'

// ---- Hit / projectile effect ----
class HitEffect {
  private mesh: THREE.Mesh
  private life = 0
  private readonly duration = 0.45
  private dead = false

  constructor(x: number, z: number, scene: THREE.Scene, color: number) {
    const geo = new THREE.RingGeometry(0.1, 0.45, 18)
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
      depthTest: false,
    })
    this.mesh = new THREE.Mesh(geo, mat)
    this.mesh.rotation.x = -Math.PI / 2
    this.mesh.position.set(x, 0.25, z)
    this.mesh.renderOrder = 10
    scene.add(this.mesh)
  }

  update(dt: number): boolean {
    if (this.dead) return false
    this.life += dt
    const t = this.life / this.duration
    const mat = this.mesh.material as THREE.MeshBasicMaterial
    this.mesh.scale.setScalar(1 + t * 2.5)
    mat.opacity = 0.95 * (1 - t)
    if (t >= 1) {
      this.mesh.parent?.remove(this.mesh)
      this.dead = true
      return false
    }
    return true
  }
}

export class Game {
  private renderer!: Renderer
  private rtsCamera: RTSCamera
  private terrain: TerrainMap
  private fog: FogOfWar
  public network: NetworkManager
  private selection: SelectionSystem
  private hud: HUD
  private placer!: BuildingPlacer
  private canvas: HTMLCanvasElement

  private unitMeshes = new Map<string, UnitMesh>()
  private buildingMeshes = new Map<string, BuildingMesh>()
  private hitEffects: HitEffect[] = []

  // Track previous HP to detect hits
  private prevUnitHp = new Map<string, number>()

  private lastTime = 0
  private animId = 0
  private gameState: GameState | null = null
  public playerId = ''

  constructor(canvas: HTMLCanvasElement, network: NetworkManager) {
    this.canvas = canvas
    this.network = network
    this.rtsCamera = new RTSCamera()
    this.terrain = new TerrainMap()
    this.fog = new FogOfWar()
    this.selection = new SelectionSystem(this.rtsCamera.camera, canvas)
    this.hud = new HUD(network)

    this.setupNetworkHandlers()
    this.setupSelectionHandlers(canvas)
  }

  private setupNetworkHandlers() {
    this.network.onStateTick = (tick: StateTick) => {
      this.applyStateTick(tick)
    }

    this.network.onFogUpdate = (fog: FogUpdate) => {
      if (fog.playerId === this.playerId) {
        this.fog.update(fog.visibleTiles)
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

    this.network.onScoreUpdate = (data) => {
      this.hud.updateScore(data.scores)
    }

    this.network.onTimerUpdate = (data) => {
      this.hud.updateTimer(data.timeRemaining)
    }

    this.network.onUnitSpawned = ({ unit }) => {
      this.addUnitMesh(unit)
    }

    this.network.onUnitDied = ({ unitId }) => {
      const um = this.unitMeshes.get(unitId)
      if (um) {
        this.spawnHitEffect(um.mesh.position.x, um.mesh.position.z, 0xff4400)
        um.destroy()
        this.unitMeshes.delete(unitId)
      }
      this.prevUnitHp.delete(unitId)
      if (this.gameState?.units[unitId]) {
        delete this.gameState.units[unitId]
      }
    }

    this.network.onBuildingBuilt = ({ building }) => {
      this.addBuildingMesh(building)
      if (this.gameState) {
        this.gameState.buildings[building.id] = building
      }
    }

    this.network.onBuildingDestroyed = ({ buildingId }) => {
      const bm = this.buildingMeshes.get(buildingId)
      if (bm) {
        this.spawnHitEffect(bm.mesh.position.x, bm.mesh.position.z, 0xff6600)
        bm.destroy()
        this.buildingMeshes.delete(buildingId)
      }
    }

    this.network.onGameOver = ({ winner, reason }) => {
      const scores: Record<string, number> = {}
      if (this.gameState) {
        for (const p of Object.values(this.gameState.players)) {
          scores[p.id] = p.score ?? 0
        }
      }
      this.hud.showGameOver(winner?.name ?? 'Nobody', scores, reason ?? 'elimination')
    }
  }

  private spawnHitEffect(x: number, z: number, color: number) {
    if (!this.renderer) return
    // Spawn two rings: red inner + orange outer
    this.hitEffects.push(new HitEffect(x, z, this.renderer.scene, color))
    this.hitEffects.push(new HitEffect(x, z, this.renderer.scene, 0xff9900))
  }

  private setupSelectionHandlers(canvas: HTMLCanvasElement) {
    this.selection.onSelectUnits = (ids) => {
      this.hud.showSelectedUnits(ids, this.gameState)
      if (ids.length > 0) {
        this.hud.showSelectedBuilding('', 'barracks', [])
      }
    }

    this.selection.onRightClick = (tileX: number, tileY: number) => {
      if (this.placer?.isActive) return
      const selected = this.selection.selectedUnitIds
      if (selected.length === 0) return
      for (const unitId of selected) {
        this.network.sendCommand({ type: 'move', unitId, targetX: tileX, targetY: tileY })
      }
    }

    canvas.addEventListener('click', (e) => {
      if (this.placer?.isActive) return
      this.trySelectBuilding(e)
    })
  }

  private trySelectBuilding(e: MouseEvent) {
    if (!this.gameState) return
    const rect = this.canvas.getBoundingClientRect()
    const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1
    const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1

    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.rtsCamera.camera)

    for (const [id, bm] of this.buildingMeshes) {
      const hits = raycaster.intersectObject(bm.mesh, true)
      if (hits.length > 0 && bm.ownerId === this.playerId) {
        const bldg = this.gameState.buildings[id]
        if (bldg) {
          this.hud.showSelectedBuilding(id, bldg.type, bldg.productionQueue)
          this.selection.clearSelection()
        }
        return
      }
    }
  }

  private initGameState(state: GameState) {
    this.gameState = state
    this.terrain.build(this.renderer.scene, state.map)
    this.fog.build(this.renderer.scene, state.map)

    for (const unit of Object.values(state.units)) {
      this.addUnitMesh(unit)
      this.prevUnitHp.set(unit.id, unit.hp)
    }
    for (const building of Object.values(state.buildings)) {
      this.addBuildingMesh(building)
    }

    this.selection.setUnitMeshes(this.unitMeshes)
    this.hud.init(this.playerId, state)
    this.placer.setMap(state.map)

    this.hud.onBuildBuilding = (type: BuildingType) => {
      this.placer.activate(type)
    }
    this.placer.onCancelled = () => {
      this.hud.clearActiveBuildBtn()
      this.hud.showPlaceHint(false)
    }
    this.placer.onPlaced = () => {
      this.hud.clearActiveBuildBtn()
      this.hud.showPlaceHint(false)
    }
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
        const unitData = this.gameState?.units[u.id]
        const maxHp = unitData?.maxHp ?? 100
        um.updateHp(u.hp, maxHp)

        // Detect HP loss → spawn hit ring at unit position
        const prevHp = this.prevUnitHp.get(u.id) ?? u.hp
        if (u.hp < prevHp) {
          const wx = u.x * TILE_WORLD_SIZE
          const wz = u.y * TILE_WORLD_SIZE
          this.spawnHitEffect(wx, wz, 0xff2200)
        }
        this.prevUnitHp.set(u.id, u.hp)
      }
    }

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

  start(gameState: GameState) {
    this.renderer = new Renderer(this.canvas)
    this.placer = new BuildingPlacer(this.renderer.scene, this.rtsCamera, this.network, this.canvas)

    window.addEventListener('resize', () => {
      this.renderer.renderer.setSize(window.innerWidth, window.innerHeight)
      this.rtsCamera.onResize()
    })

    this.playerId = this.network.playerId
    this.initGameState(gameState)
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

    // Update hit effects, remove dead ones
    this.hitEffects = this.hitEffects.filter(e => e.update(dt))

    this.renderer.render(this.rtsCamera.camera)
    this.animId = requestAnimationFrame(this.loop)
  }

  stop() {
    cancelAnimationFrame(this.animId)
  }
}
