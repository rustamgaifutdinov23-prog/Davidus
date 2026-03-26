import * as THREE from 'three'
import type { MapData } from '@shared/types.js'
import { TILE_WORLD_SIZE } from '../utils/constants.js'

export type FogState = 'hidden' | 'explored' | 'visible'

export class FogOfWar {
  private fogMeshes: THREE.Mesh[][] = []
  private fogStates: FogState[][] = []
  private group = new THREE.Group()

  build(scene: THREE.Scene, mapData: MapData) {
    scene.remove(this.group)
    this.group = new THREE.Group()
    this.fogMeshes = []
    this.fogStates = []

    const geom = new THREE.PlaneGeometry(TILE_WORLD_SIZE, TILE_WORLD_SIZE)

    for (let y = 0; y < mapData.height; y++) {
      this.fogMeshes[y] = []
      this.fogStates[y] = []
      for (let x = 0; x < mapData.width; x++) {
        const mat = new THREE.MeshBasicMaterial({
          color: 0x000000,
          transparent: true,
          opacity: 0.95,
          depthWrite: false,
        })
        const mesh = new THREE.Mesh(geom, mat)
        mesh.rotation.x = -Math.PI / 2
        mesh.position.set(x * TILE_WORLD_SIZE, 1.5, y * TILE_WORLD_SIZE)
        mesh.renderOrder = 10
        this.group.add(mesh)
        this.fogMeshes[y][x] = mesh
        this.fogStates[y][x] = 'hidden'
      }
    }

    scene.add(this.group)
  }

  update(visibleTiles: [number, number][]) {
    // Mark previously visible as explored
    for (let y = 0; y < this.fogStates.length; y++) {
      for (let x = 0; x < (this.fogStates[y]?.length ?? 0); x++) {
        if (this.fogStates[y][x] === 'visible') {
          this.fogStates[y][x] = 'explored'
        }
      }
    }

    // Mark new visible
    for (const [tx, ty] of visibleTiles) {
      if (this.fogStates[ty]?.[tx] !== undefined) {
        this.fogStates[ty][tx] = 'visible'
      }
    }

    // Update mesh opacities
    for (let y = 0; y < this.fogMeshes.length; y++) {
      for (let x = 0; x < (this.fogMeshes[y]?.length ?? 0); x++) {
        const mesh = this.fogMeshes[y][x]
        const mat = mesh.material as THREE.MeshBasicMaterial
        const state = this.fogStates[y][x]
        if (state === 'visible') {
          mat.opacity = 0
          mesh.visible = false
        } else if (state === 'explored') {
          mesh.visible = true
          mat.opacity = 0.5
        } else {
          mesh.visible = true
          mat.opacity = 0.95
        }
      }
    }
  }

  isTileVisible(tileX: number, tileY: number): boolean {
    return this.fogStates[tileY]?.[tileX] === 'visible'
  }
}
