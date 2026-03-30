import * as THREE from 'three'
import { MAP_WIDTH, MAP_HEIGHT } from '@shared/constants.js'
import { TILE_WORLD_SIZE } from '../utils/constants.js'

export class RTSCamera {
  readonly camera: THREE.OrthographicCamera
  private panSpeed = 0.5
  private zoomMin = 10
  private zoomMax = 120
  private zoom = 50

  // Pan state
  private panning = false
  private panStart = new THREE.Vector2()
  private panDelta = new THREE.Vector2()

  // Keys held
  private keys = new Set<string>()

  constructor() {
    const aspect = window.innerWidth / window.innerHeight
    this.camera = new THREE.OrthographicCamera(
      -this.zoom * aspect, this.zoom * aspect,
      this.zoom, -this.zoom,
      0.1, 1000
    )

    // Isometric angle: rotated 45° around Y, then tilted ~60° down
    this.camera.position.set(40, 60, 40)
    this.camera.lookAt(
      (MAP_WIDTH / 2) * TILE_WORLD_SIZE,
      0,
      (MAP_HEIGHT / 2) * TILE_WORLD_SIZE
    )

    this.bindEvents()
  }

  private bindEvents() {
    window.addEventListener('wheel', (e) => this.onWheel(e))
    window.addEventListener('keydown', (e) => this.keys.add(e.code))
    window.addEventListener('keyup', (e) => this.keys.delete(e.code))
  }

  private onWheel(e: WheelEvent) {
    this.zoom = Math.min(this.zoomMax, Math.max(this.zoomMin, this.zoom + e.deltaY * 0.05))
    this.updateProjection()
  }

  private updateProjection() {
    const aspect = window.innerWidth / window.innerHeight
    this.camera.left = -this.zoom * aspect
    this.camera.right = this.zoom * aspect
    this.camera.top = this.zoom
    this.camera.bottom = -this.zoom
    this.camera.updateProjectionMatrix()
  }

  update(dt: number) {
    const speed = this.panSpeed * this.zoom * dt

    // WASD / arrow keys pan
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) {
      this.camera.position.x += speed * 0.7
      this.camera.position.z += speed * 0.7
    }
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) {
      this.camera.position.x -= speed * 0.7
      this.camera.position.z -= speed * 0.7
    }
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) {
      this.camera.position.x += speed * 0.7
      this.camera.position.z -= speed * 0.7
    }
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) {
      this.camera.position.x -= speed * 0.7
      this.camera.position.z += speed * 0.7
    }

    // Clamp camera to map bounds
    const mapW = MAP_WIDTH * TILE_WORLD_SIZE
    const mapH = MAP_HEIGHT * TILE_WORLD_SIZE
    this.camera.position.x = Math.max(-10, Math.min(mapW + 10, this.camera.position.x))
    this.camera.position.z = Math.max(-10, Math.min(mapH + 10, this.camera.position.z))
  }

  onResize() {
    this.updateProjection()
  }
}
