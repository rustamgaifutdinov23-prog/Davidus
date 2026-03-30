import * as THREE from 'three'
import type { BuildingType, MapData } from '@shared/types.js'
import { BUILDING_COSTS } from '@shared/constants.js'
import { TILE_WORLD_SIZE } from '../utils/constants.js'
import type { RTSCamera } from '../core/Camera.js'
import type { NetworkManager } from './NetworkManager.js'

const BLDG_SIZE: Record<BuildingType, [number, number]> = {
  headquarters:   [2, 2],
  barracks:       [2, 1],
  factory:        [2, 2],
  artillery_base: [2, 2],
  admin_building: [1, 1],
}

export class BuildingPlacer {
  private scene: THREE.Scene
  private camera: RTSCamera
  private net: NetworkManager
  private canvas: HTMLCanvasElement
  private mapData: MapData | null = null

  private activeType: BuildingType | null = null
  private ghost: THREE.Group | null = null
  private ghostTileX = 0
  private ghostTileY = 0
  private canPlace = false

  onPlaced: () => void = () => {}
  onCancelled: () => void = () => {}

  private boundMouseMove: (e: MouseEvent) => void
  private boundClick: (e: MouseEvent) => void
  private boundKeyDown: (e: KeyboardEvent) => void

  constructor(scene: THREE.Scene, camera: RTSCamera, net: NetworkManager, canvas: HTMLCanvasElement) {
    this.scene = scene
    this.camera = camera
    this.net = net
    this.canvas = canvas

    this.boundMouseMove = this.onMouseMove.bind(this)
    this.boundClick = this.onClick.bind(this)
    this.boundKeyDown = this.onKeyDown.bind(this)
  }

  setMap(mapData: MapData) {
    this.mapData = mapData
  }

  activate(type: BuildingType) {
    this.cancel()
    this.activeType = type
    this.createGhost(type)

    this.canvas.addEventListener('mousemove', this.boundMouseMove)
    this.canvas.addEventListener('click', this.boundClick)
    window.addEventListener('keydown', this.boundKeyDown)

    document.getElementById('place-hint')!.style.display = 'block'
  }

  cancel() {
    if (this.ghost) {
      this.scene.remove(this.ghost)
      this.ghost = null
    }
    this.activeType = null
    this.canvas.removeEventListener('mousemove', this.boundMouseMove)
    this.canvas.removeEventListener('click', this.boundClick)
    window.removeEventListener('keydown', this.boundKeyDown)
    document.getElementById('place-hint')!.style.display = 'none'
    this.onCancelled()
  }

  get isActive() {
    return this.activeType !== null
  }

  private createGhost(type: BuildingType) {
    this.ghost = new THREE.Group()
    const [w, d] = BLDG_SIZE[type] ?? [1, 1]
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w * TILE_WORLD_SIZE * 0.95, 0.6, d * TILE_WORLD_SIZE * 0.95),
      new THREE.MeshBasicMaterial({ color: 0x40ff80, transparent: true, opacity: 0.45, wireframe: false })
    )
    mesh.position.y = 0.3

    // Wireframe outline
    const wire = new THREE.Mesh(
      new THREE.BoxGeometry(w * TILE_WORLD_SIZE, 0.62, d * TILE_WORLD_SIZE),
      new THREE.MeshBasicMaterial({ color: 0x80ffaa, wireframe: true, transparent: true, opacity: 0.8 })
    )
    wire.position.y = 0.31
    this.ghost.add(mesh)
    this.ghost.add(wire)
    this.scene.add(this.ghost)
  }

  private setGhostColor(canPlace: boolean) {
    if (!this.ghost) return
    this.ghost.children.forEach(child => {
      const mat = (child as THREE.Mesh).material as THREE.MeshBasicMaterial
      mat.color.set(canPlace ? 0x40ff80 : 0xff3020)
    })
  }

  private onMouseMove(e: MouseEvent) {
    if (!this.ghost || !this.mapData) return
    const [tileX, tileY] = this.screenToTile(e.clientX, e.clientY)
    this.ghostTileX = tileX
    this.ghostTileY = tileY
    this.ghost.position.set(tileX * TILE_WORLD_SIZE, 0, tileY * TILE_WORLD_SIZE)
    this.canPlace = this.checkCanPlace(tileX, tileY)
    this.setGhostColor(this.canPlace)
  }

  private onClick(e: MouseEvent) {
    if (e.button !== 0) return
    if (!this.activeType || !this.canPlace) return
    this.net.sendCommand({
      type: 'buildBuilding',
      tileX: this.ghostTileX,
      tileY: this.ghostTileY,
      buildingType: this.activeType,
    })
    this.cancel()
    this.onPlaced()
  }

  private onKeyDown(e: KeyboardEvent) {
    if (e.code === 'Escape') this.cancel()
  }

  private checkCanPlace(tileX: number, tileY: number): boolean {
    if (!this.mapData) return false
    const [w, d] = BLDG_SIZE[this.activeType ?? 'barracks'] ?? [1, 1]
    for (let dy = 0; dy < d; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const tx = tileX + dx
        const ty = tileY + dy
        if (tx < 0 || ty < 0 || tx >= this.mapData.width || ty >= this.mapData.height) return false
        const tile = this.mapData.tiles[ty]?.[tx]
        if (!tile || !tile.passable) return false
        if (tile.type === 'river' || tile.type === 'mountain') return false
      }
    }
    return true
  }

  private screenToTile(screenX: number, screenY: number): [number, number] {
    const rect = this.canvas.getBoundingClientRect()
    const ndcX = ((screenX - rect.left) / rect.width) * 2 - 1
    const ndcY = -((screenY - rect.top) / rect.height) * 2 + 1

    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera.camera)

    // Intersect with ground plane y=0
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
    const target = new THREE.Vector3()
    raycaster.ray.intersectPlane(plane, target)

    const tileX = Math.round(target.x / TILE_WORLD_SIZE)
    const tileY = Math.round(target.z / TILE_WORLD_SIZE)
    return [tileX, tileY]
  }
}
