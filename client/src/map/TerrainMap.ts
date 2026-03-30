import * as THREE from 'three'
import type { MapData, TileData } from '@shared/types.js'
import { TILE_WORLD_SIZE } from '../utils/constants.js'

// Tile base colors
const TILE_COLOR: Record<string, number> = {
  grass:    0x4a8c3f,
  forest:   0x2d6b28,
  mountain: 0x8a7a6a,
  road:     0x9a8878,
  river:    0x2a6aaa,
  bridge:   0x9a7a50,
  swamp:    0x4a6040,
}

// Tile height offsets
const TILE_H: Record<string, number> = {
  grass:    0,
  forest:   0,
  mountain: 0.5,
  road:     0.02,
  river:    -0.18,
  bridge:   0.06,
  swamp:    -0.06,
}

export class TerrainMap {
  private group = new THREE.Group()
  private waterMeshes: THREE.Mesh[] = []
  private waterTime = 0

  build(scene: THREE.Scene, mapData: MapData) {
    scene.remove(this.group)
    this.group = new THREE.Group()
    this.waterMeshes = []

    // Group tiles by type for instancing
    const tilesByType = new Map<string, { x: number; y: number; tile: TileData }[]>()
    for (let y = 0; y < mapData.height; y++) {
      for (let x = 0; x < mapData.width; x++) {
        const tile = mapData.tiles[y][x]
        if (!tilesByType.has(tile.type)) tilesByType.set(tile.type, [])
        tilesByType.get(tile.type)!.push({ x, y, tile })
      }
    }

    const baseGeom = new THREE.BoxGeometry(TILE_WORLD_SIZE, 0.32, TILE_WORLD_SIZE)

    for (const [type, tiles] of tilesByType) {
      if (type === 'river') {
        // Animated water — individual meshes (small count usually)
        const mat = new THREE.MeshStandardMaterial({
          color: 0x2a6aaa,
          metalness: 0.15,
          roughness: 0.15,
          transparent: true,
          opacity: 0.88,
        })
        for (const { x, y } of tiles) {
          const m = new THREE.Mesh(baseGeom, mat.clone())
          m.position.set(x * TILE_WORLD_SIZE, TILE_H.river - 0.16, y * TILE_WORLD_SIZE)
          m.receiveShadow = true
          this.group.add(m)
          this.waterMeshes.push(m)
        }
        continue
      }

      // InstancedMesh for each tile type
      const color = TILE_COLOR[type] ?? TILE_COLOR.grass
      const mat = new THREE.MeshStandardMaterial({
        color,
        roughness: type === 'road' ? 0.92 : 0.85,
        metalness: 0,
      })
      const mesh = new THREE.InstancedMesh(baseGeom, mat, tiles.length)
      mesh.receiveShadow = true
      mesh.castShadow = false

      const dummy = new THREE.Object3D()
      tiles.forEach(({ x, y }, i) => {
        const hy = (TILE_H[type] ?? 0) - 0.16
        dummy.position.set(x * TILE_WORLD_SIZE, hy, y * TILE_WORLD_SIZE)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
      })
      mesh.instanceMatrix.needsUpdate = true
      this.group.add(mesh)
    }

    // Forest trees
    for (let y = 0; y < mapData.height; y++) {
      for (let x = 0; x < mapData.width; x++) {
        const tile = mapData.tiles[y][x]
        if (tile.type === 'forest') this.addTree(x, y)
      }
    }

    // Mountain peaks
    for (let y = 0; y < mapData.height; y++) {
      for (let x = 0; x < mapData.width; x++) {
        if (mapData.tiles[y][x].type === 'mountain') this.addMountain(x, y)
      }
    }

    // Resource point markers
    for (const point of mapData.resourcePoints) {
      this.addResourceMarker(point.x, point.y)
    }

    scene.add(this.group)
  }

  // Low-poly tree — trunk + layered cones like the reference image
  private addTree(tileX: number, tileY: number) {
    const wx = tileX * TILE_WORLD_SIZE
    const wz = tileY * TILE_WORLD_SIZE
    const jx = (Math.random() - 0.5) * 0.3
    const jz = (Math.random() - 0.5) * 0.3

    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.9 })
    const trunkGeom = new THREE.CylinderGeometry(0.07, 0.12, 0.55, 6)
    const trunk = new THREE.Mesh(trunkGeom, trunkMat)
    trunk.position.set(wx + jx, 0.27, wz + jz)
    trunk.castShadow = true
    this.group.add(trunk)

    // 3 layered cones — vary color slightly per tree
    const hue = 0.28 + (Math.random() - 0.5) * 0.04
    const greenShade = new THREE.Color().setHSL(hue, 0.65, 0.22 + Math.random() * 0.08)
    const coneMat = new THREE.MeshStandardMaterial({ color: greenShade, roughness: 0.85, flatShading: true })

    const layers = [
      { r: 0.52, h: 0.72, y: 0.78 },
      { r: 0.40, h: 0.60, y: 1.22 },
      { r: 0.26, h: 0.50, y: 1.60 },
    ]
    for (const l of layers) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(l.r, l.h, 7, 1, false), coneMat)
      cone.position.set(wx + jx, l.y, wz + jz)
      cone.rotation.y = Math.random() * Math.PI
      cone.castShadow = true
      this.group.add(cone)
    }
  }

  // Low-poly mountain — multi-face pyramid
  private addMountain(tileX: number, tileY: number) {
    // Only add peak to roughly 1 in 3 mountain tiles (avoid crowding)
    if ((tileX + tileY) % 3 !== 0) return

    const wx = tileX * TILE_WORLD_SIZE
    const wz = tileY * TILE_WORLD_SIZE

    const h = 1.4 + Math.random() * 1.2
    const r = 1.0 + Math.random() * 0.5

    const rockColor = new THREE.Color().setHSL(0.07, 0.15, 0.45 + Math.random() * 0.1)
    const snowColor = new THREE.Color(0xd8e8f0)

    const rockMat = new THREE.MeshStandardMaterial({ color: rockColor, roughness: 0.95, flatShading: true })
    const snowMat = new THREE.MeshStandardMaterial({ color: snowColor, roughness: 0.8, flatShading: true })

    // Rock base cone
    const rock = new THREE.Mesh(new THREE.ConeGeometry(r, h, 6, 1), rockMat)
    rock.position.set(wx, h / 2 + 0.5, wz)
    rock.rotation.y = Math.random() * Math.PI
    rock.castShadow = true
    rock.receiveShadow = true
    this.group.add(rock)

    // Snow cap
    const snow = new THREE.Mesh(new THREE.ConeGeometry(r * 0.4, h * 0.35, 6, 1), snowMat)
    snow.position.set(wx, h * 0.82 + 0.5, wz)
    snow.rotation.y = Math.random() * Math.PI
    snow.castShadow = true
    this.group.add(snow)
  }

  private addResourceMarker(tileX: number, tileY: number) {
    const wx = tileX * TILE_WORLD_SIZE
    const wz = tileY * TILE_WORLD_SIZE

    // Gold star-like pentagon
    const mat = new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0x886600, roughness: 0.3, metalness: 0.4 })
    const marker = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.18, 5), mat)
    marker.position.set(wx, 0.55, wz)
    marker.rotation.y = Math.PI / 5
    this.group.add(marker)

    // Pulsing ring (static for now)
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.38, 0.48, 16),
      new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
    )
    ring.rotation.x = -Math.PI / 2
    ring.position.set(wx, 0.18, wz)
    this.group.add(ring)
  }

  update(dt: number) {
    this.waterTime += dt
    for (const mesh of this.waterMeshes) {
      const mat = mesh.material as THREE.MeshStandardMaterial
      const t = Math.sin(this.waterTime * 1.6) * 0.06
      mat.color.setRGB(0.14 + t, 0.40 + t * 0.4, 0.70)
    }
  }
}
