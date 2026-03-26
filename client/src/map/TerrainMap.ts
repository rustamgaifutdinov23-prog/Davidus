import * as THREE from 'three'
import type { MapData, TileData } from '@shared/types.js'
import { TERRAIN_COLOR, TILE_WORLD_SIZE } from '../utils/constants.js'

const TILE_H: Record<string, number> = {
  grass: 0,
  forest: 0,
  mountain: 0.8,
  road: 0.02,
  river: -0.15,
  bridge: 0.05,
  swamp: -0.05,
}

export class TerrainMap {
  private group = new THREE.Group()
  private tileMeshes: THREE.Mesh[][] = []
  private waterMeshes: THREE.Mesh[] = []
  private waterTime = 0

  build(scene: THREE.Scene, mapData: MapData) {
    // Clear old
    scene.remove(this.group)
    this.group = new THREE.Group()
    this.tileMeshes = []
    this.waterMeshes = []

    const geom = new THREE.BoxGeometry(TILE_WORLD_SIZE, 0.3, TILE_WORLD_SIZE)

    for (let y = 0; y < mapData.height; y++) {
      this.tileMeshes[y] = []
      for (let x = 0; x < mapData.width; x++) {
        const tile = mapData.tiles[y][x]
        const mesh = this.createTileMesh(tile, geom)
        mesh.position.set(
          x * TILE_WORLD_SIZE,
          (TILE_H[tile.type] ?? 0) - 0.15,
          y * TILE_WORLD_SIZE
        )
        this.group.add(mesh)
        this.tileMeshes[y][x] = mesh

        // Forest: add tree cones
        if (tile.type === 'forest') {
          this.addTree(x, y)
        }
      }
    }

    // Resource points markers
    for (const point of mapData.resourcePoints) {
      this.addResourceMarker(point.x, point.y)
    }

    scene.add(this.group)
  }

  private createTileMesh(tile: TileData, geom: THREE.BoxGeometry): THREE.Mesh {
    const color = TERRAIN_COLOR[tile.type] ?? TERRAIN_COLOR.grass

    if (tile.type === 'river') {
      // Animated water material
      const mat = new THREE.MeshStandardMaterial({
        color: 0x2a6aaa,
        metalness: 0.1,
        roughness: 0.2,
        transparent: true,
        opacity: 0.85,
      })
      const mesh = new THREE.Mesh(geom, mat)
      mesh.receiveShadow = true
      this.waterMeshes.push(mesh)
      return mesh
    }

    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: tile.type === 'road' ? 0.9 : 0.8,
      metalness: 0.0,
    })

    const mesh = new THREE.Mesh(geom, mat)
    mesh.receiveShadow = true
    mesh.castShadow = false
    return mesh
  }

  private addTree(tileX: number, tileY: number) {
    // Trunk
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.12, 0.6, 6),
      new THREE.MeshStandardMaterial({ color: 0x5a3a1a })
    )
    trunk.position.set(tileX * TILE_WORLD_SIZE, 0.3, tileY * TILE_WORLD_SIZE)
    trunk.castShadow = true
    this.group.add(trunk)

    // Canopy
    const canopy = new THREE.Mesh(
      new THREE.ConeGeometry(0.55, 1.1, 7),
      new THREE.MeshStandardMaterial({ color: 0x1a5a0e })
    )
    canopy.position.set(tileX * TILE_WORLD_SIZE, 1.05, tileY * TILE_WORLD_SIZE)
    canopy.castShadow = true
    this.group.add(canopy)
  }

  private addResourceMarker(tileX: number, tileY: number) {
    // Small golden star shape (just a cylinder for now)
    const marker = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.25, 0.15, 5),
      new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0x886600, roughness: 0.3 })
    )
    marker.position.set(tileX * TILE_WORLD_SIZE, 0.5, tileY * TILE_WORLD_SIZE)
    marker.rotation.y = Math.PI / 5
    this.group.add(marker)
  }

  update(dt: number) {
    this.waterTime += dt
    // Animate water by shifting color slightly
    for (const mesh of this.waterMeshes) {
      const mat = mesh.material as THREE.MeshStandardMaterial
      const t = Math.sin(this.waterTime * 1.5) * 0.05
      mat.color.setRGB(0.16 + t, 0.42 + t * 0.5, 0.68)
    }
  }
}
