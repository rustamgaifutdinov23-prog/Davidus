import * as THREE from 'three'
import { MAP_WIDTH, MAP_HEIGHT } from '@shared/constants.js'
import { TILE_WORLD_SIZE } from '../utils/constants.js'

export class RTSCamera {
  readonly camera: THREE.OrthographicCamera
  private panSpeed = 0.5
  private zoomMin = 10
  private zoomMax = 120
  private zoom = 50

  // Focus point on ground that camera orbits around
  private focusX = (MAP_WIDTH / 2) * TILE_WORLD_SIZE
  private focusZ = (MAP_HEIGHT / 2) * TILE_WORLD_SIZE

  // Camera orbit angle (Q/E) and fixed distance
  private rotAngle = Math.PI * 1.25  // ~225°: camera is SW of map center (matches original view)
  private readonly arm = 56.6        // horizontal distance from focus to camera
  private readonly camHeight = 60

  private keys = new Set<string>()

  constructor() {
    const aspect = window.innerWidth / window.innerHeight
    this.camera = new THREE.OrthographicCamera(
      -this.zoom * aspect, this.zoom * aspect,
      this.zoom, -this.zoom,
      0.1, 1000
    )
    this.updateCameraPosition()
    this.bindEvents()
  }

  private updateCameraPosition() {
    this.camera.position.set(
      this.focusX + Math.cos(this.rotAngle) * this.arm,
      this.camHeight,
      this.focusZ + Math.sin(this.rotAngle) * this.arm
    )
    this.camera.lookAt(this.focusX, 0, this.focusZ)
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

    // Camera-relative forward/right vectors in XZ plane
    const fwdX = -Math.cos(this.rotAngle)
    const fwdZ = -Math.sin(this.rotAngle)
    const rightX = -Math.sin(this.rotAngle)
    const rightZ = Math.cos(this.rotAngle)

    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) {
      this.focusX += fwdX * speed
      this.focusZ += fwdZ * speed
    }
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) {
      this.focusX -= fwdX * speed
      this.focusZ -= fwdZ * speed
    }
    // A = left (negative right direction), D = right (positive right direction)
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) {
      this.focusX += rightX * speed
      this.focusZ += rightZ * speed
    }
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) {
      this.focusX -= rightX * speed
      this.focusZ -= rightZ * speed
    }

    // Q/E: rotate camera around the focus point
    if (this.keys.has('KeyQ')) this.rotAngle -= dt * 1.2
    if (this.keys.has('KeyE')) this.rotAngle += dt * 1.2

    // Clamp focus to map bounds
    const mapW = MAP_WIDTH * TILE_WORLD_SIZE
    const mapH = MAP_HEIGHT * TILE_WORLD_SIZE
    this.focusX = Math.max(-20, Math.min(mapW + 20, this.focusX))
    this.focusZ = Math.max(-20, Math.min(mapH + 20, this.focusZ))

    this.updateCameraPosition()
  }

  onResize() {
    this.updateProjection()
  }
}
