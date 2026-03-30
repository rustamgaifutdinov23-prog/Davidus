import * as THREE from 'three'
import type { MapData } from '@shared/types.js'
import { TILE_WORLD_SIZE } from '../utils/constants.js'

export type FogState = 'hidden' | 'explored' | 'visible'

// Use InstancedMesh with per-instance color for performance on large maps
export class FogOfWar {
  private fogStates: FogState[][] = []
  private instancedMesh: THREE.InstancedMesh | null = null
  private width = 0
  private height = 0
  private dirtyInstances = new Set<number>()

  private readonly HIDDEN_COLOR   = new THREE.Color(0x000000)
  private readonly EXPLORED_COLOR = new THREE.Color(0x000000)
  private readonly VISIBLE_COLOR  = new THREE.Color(0x000000)

  build(scene: THREE.Scene, mapData: MapData) {
    if (this.instancedMesh) {
      scene.remove(this.instancedMesh)
    }

    this.width = mapData.width
    this.height = mapData.height
    this.fogStates = []

    const count = mapData.width * mapData.height
    const geom = new THREE.PlaneGeometry(TILE_WORLD_SIZE, TILE_WORLD_SIZE)
    const mat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 1,
      depthWrite: false,
      vertexColors: false,
    })

    // We'll use a different trick: store opacity per-instance isn't possible directly.
    // Instead use three separate instanced meshes: hidden, explored (semi), visible (invisible).
    // Simpler: Use a single InstancedMesh and toggle visibility per instance by scale.

    this.instancedMesh = new THREE.InstancedMesh(geom, mat, count)
    this.instancedMesh.renderOrder = 10

    const dummy = new THREE.Object3D()
    dummy.rotation.x = -Math.PI / 2

    for (let y = 0; y < mapData.height; y++) {
      this.fogStates[y] = []
      for (let x = 0; x < mapData.width; x++) {
        const i = y * mapData.width + x
        dummy.position.set(x * TILE_WORLD_SIZE, 1.5, y * TILE_WORLD_SIZE)
        dummy.scale.set(1, 1, 1)
        dummy.updateMatrix()
        this.instancedMesh.setMatrixAt(i, dummy.matrix)
        this.instancedMesh.setColorAt(i, this.HIDDEN_COLOR)
        this.fogStates[y][x] = 'hidden'
      }
    }

    this.instancedMesh.instanceMatrix.needsUpdate = true
    if (this.instancedMesh.instanceColor) this.instancedMesh.instanceColor.needsUpdate = true

    scene.add(this.instancedMesh)
  }

  update(visibleTiles: [number, number][]) {
    if (!this.instancedMesh) return

    // Mark previously visible as explored
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.fogStates[y]?.[x] === 'visible') {
          this.fogStates[y][x] = 'explored'
          this.dirtyInstances.add(y * this.width + x)
        }
      }
    }

    // Mark new visible
    for (const [tx, ty] of visibleTiles) {
      if (ty >= 0 && ty < this.height && tx >= 0 && tx < this.width) {
        if (this.fogStates[ty][tx] !== 'visible') {
          this.fogStates[ty][tx] = 'visible'
          this.dirtyInstances.add(ty * this.width + tx)
        }
      }
    }

    // Flush dirty instances
    const dummy = new THREE.Object3D()
    dummy.rotation.x = -Math.PI / 2

    for (const i of this.dirtyInstances) {
      const tx = i % this.width
      const ty = Math.floor(i / this.width)
      const state = this.fogStates[ty]?.[tx] ?? 'hidden'

      dummy.position.set(tx * TILE_WORLD_SIZE, 1.5, ty * TILE_WORLD_SIZE)

      if (state === 'visible') {
        dummy.scale.set(0, 0, 0) // invisible
      } else {
        dummy.scale.set(1, 1, 1)
        // explored = dark semi-transparent, hidden = full black
        const c = state === 'explored'
          ? new THREE.Color(0x000000)
          : new THREE.Color(0x000000)
        this.instancedMesh!.setColorAt(i, c)
      }

      dummy.updateMatrix()
      this.instancedMesh!.setMatrixAt(i, dummy.matrix)
    }

    if (this.dirtyInstances.size > 0) {
      this.instancedMesh.instanceMatrix.needsUpdate = true
      if (this.instancedMesh.instanceColor) this.instancedMesh.instanceColor.needsUpdate = true
      this.dirtyInstances.clear()
    }

    // Adjust material opacity based on states — we use a trick:
    // Hidden tiles use opacity 0.92, explored 0.45, visible 0 (scaled to 0)
    // Since we can't vary opacity per-instance, we use two separate layers.
    // For simplicity, keep one layer at opacity 0.92 and hide visible tiles via scale.
    ;(this.instancedMesh.material as THREE.MeshBasicMaterial).opacity = 0.92
  }

  isTileVisible(tileX: number, tileY: number): boolean {
    return this.fogStates[tileY]?.[tileX] === 'visible'
  }
}
