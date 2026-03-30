import * as THREE from 'three'
import type { MapData, TileData } from '@shared/types.js'
import { TILE_WORLD_SIZE } from '../utils/constants.js'
import { cloneModel } from '../utils/ModelLoader.js'

// Tile base colors (InstancedMesh floor)
const TILE_COLOR: Record<string, number> = {
  grass:    0x5a8c3c,
  forest:   0x2d6e1e,
  mountain: 0x8a7a6a,
  swamp:    0x4a6a2a,
  road:     0x9a8878,
  river:    0x2a6aaa,
  bridge:   0x9a7a50,
}

// Tile height offsets for base mesh
const TILE_H: Record<string, number> = {
  grass:    0,
  forest:   0,
  mountain: 0.1,
  swamp:    -0.04,
  road:     0.02,
  river:    -0.18,
  bridge:   0.06,
}

// --- Road/River direction detection ---

type Conn = { n: boolean; e: boolean; s: boolean; w: boolean }

function getConnections(mapData: MapData, x: number, y: number, selfType: string): Conn {
  const connects = (nx: number, ny: number): boolean => {
    if (nx < 0 || ny < 0 || nx >= mapData.width || ny >= mapData.height) return false
    const t = mapData.tiles[ny][nx].type
    if (selfType === 'road')   return t === 'road' || t === 'bridge'
    if (selfType === 'river')  return t === 'river' || t === 'bridge'
    if (selfType === 'bridge') return t === 'road' || t === 'bridge' || t === 'river'
    return false
  }
  return {
    n: connects(x, y - 1),
    e: connects(x + 1, y),
    s: connects(x, y + 1),
    w: connects(x - 1, y),
  }
}

// Returns { model, rotY } for a road tile based on neighbors
// rotY convention: 0 = default model orientation (assumed S↔N straight)
function pickRoadVariant(c: Conn, prefix: string): { model: string; rotY: number } {
  const cnt = [c.n, c.e, c.s, c.w].filter(Boolean).length

  if (cnt === 4) return { model: `${prefix}-crossing`, rotY: 0 }

  if (cnt === 0) return { model: `${prefix}-square`, rotY: 0 }

  if (cnt === 1) {
    // Dead end pointing toward the single connection
    if (c.s) return { model: `${prefix}-end`, rotY: 0 }
    if (c.e) return { model: `${prefix}-end`, rotY: -Math.PI / 2 }
    if (c.n) return { model: `${prefix}-end`, rotY: Math.PI }
    return           { model: `${prefix}-end`, rotY: Math.PI / 2 }   // w
  }

  if (cnt === 2) {
    if (c.n && c.s) return { model: `${prefix}-straight`, rotY: 0 }
    if (c.e && c.w) return { model: `${prefix}-straight`, rotY: Math.PI / 2 }
    // Corners
    if (c.s && c.e) return { model: `${prefix}-corner`, rotY: 0 }
    if (c.e && c.n) return { model: `${prefix}-corner`, rotY: -Math.PI / 2 }
    if (c.n && c.w) return { model: `${prefix}-corner`, rotY: Math.PI }
    return           { model: `${prefix}-corner`, rotY: Math.PI / 2 }  // s && w
  }

  // cnt === 3: T-junction — missing side determines rotation
  if (!c.n) return { model: `${prefix}-intersectionA`, rotY: 0 }
  if (!c.e) return { model: `${prefix}-intersectionA`, rotY: Math.PI / 2 }
  if (!c.s) return { model: `${prefix}-intersectionA`, rotY: Math.PI }
  return     { model: `${prefix}-intersectionA`, rotY: -Math.PI / 2 }
}

export class TerrainMap {
  private group = new THREE.Group()
  private waterMeshes: THREE.Mesh[] = []
  private waterTime = 0

  build(scene: THREE.Scene, mapData: MapData) {
    scene.remove(this.group)
    this.group = new THREE.Group()
    this.waterMeshes = []

    this.buildBaseTiles(mapData)
    this.buildRoads(mapData)
    this.buildRiverBridges(mapData)
    this.buildPerimeterRoad(mapData)
    this.buildDecorations(mapData)
    this.buildResourceMarkers(mapData)

    scene.add(this.group)
  }

  // ---- Base flat tiles (InstancedMesh, fast) ---

  private buildBaseTiles(mapData: MapData) {
    const byType = new Map<string, { x: number; y: number }[]>()
    for (let y = 0; y < mapData.height; y++) {
      for (let x = 0; x < mapData.width; x++) {
        const t = mapData.tiles[y][x].type
        // Road/river/bridge are handled with GLB, still need a base for non-GLB types
        if (!byType.has(t)) byType.set(t, [])
        byType.get(t)!.push({ x, y })
      }
    }

    const baseGeom = new THREE.BoxGeometry(TILE_WORLD_SIZE, 0.32, TILE_WORLD_SIZE)

    for (const [type, tiles] of byType) {
      if (type === 'river') {
        // Animated water tiles
        const mat = new THREE.MeshStandardMaterial({
          color: 0x2a6aaa,
          metalness: 0.15,
          roughness: 0.15,
          transparent: true,
          opacity: 0.88,
        })
        for (const { x, y } of tiles) {
          const m = new THREE.Mesh(baseGeom, mat.clone())
          m.position.set(x * TILE_WORLD_SIZE, (TILE_H.river ?? -0.18) - 0.16, y * TILE_WORLD_SIZE)
          m.receiveShadow = true
          this.group.add(m)
          this.waterMeshes.push(m)
        }
        continue
      }

      const color = TILE_COLOR[type] ?? TILE_COLOR.grass
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0 })
      const mesh = new THREE.InstancedMesh(baseGeom, mat, tiles.length)
      mesh.receiveShadow = true
      mesh.castShadow = false

      const dummy = new THREE.Object3D()
      tiles.forEach(({ x, y }, i) => {
        const hy = ((TILE_H[type] ?? 0) - 0.16)
        dummy.position.set(x * TILE_WORLD_SIZE, hy, y * TILE_WORLD_SIZE)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
      })
      mesh.instanceMatrix.needsUpdate = true
      this.group.add(mesh)
    }
  }

  // ---- Road GLB tiles (directional). Rivers are pure colored boxes — no GLBs ----

  private buildRoads(mapData: MapData) {
    const T = TILE_WORLD_SIZE

    for (let y = 0; y < mapData.height; y++) {
      for (let x = 0; x < mapData.width; x++) {
        const type = mapData.tiles[y][x].type

        if (type === 'bridge') {
          const m = cloneModel('bridge')
          if (m.children.length === 0) continue
          m.scale.setScalar(T)
          m.position.set(x * T, 0, y * T)
          this.group.add(m)
          continue
        }

        if (type !== 'road') continue

        const conn = getConnections(mapData, x, y, 'road')
        const { model, rotY } = pickRoadVariant(conn, 'path')

        const m = cloneModel(model)
        if (m.children.length === 0) continue
        m.scale.setScalar(T)
        m.position.set(x * T, 0, y * T)
        m.rotation.y = rotY
        this.group.add(m)
      }
    }
  }

  // ---- Square road ring around the whole map perimeter ----

  private buildPerimeterRoad(mapData: MapData) {
    const T = TILE_WORLD_SIZE
    const W = mapData.width
    const H = mapData.height
    const mat = new THREE.MeshStandardMaterial({ color: 0x9a8878, roughness: 0.92, metalness: 0 })
    const roadH = 0.18  // slightly above ground

    // Road strip width = T, height = 0.2, centered 1 tile outside map edge
    const offset = T * 0.5  // half-tile outside edge

    // Top and Bottom strips (full width + corners)
    const stripW = (W + 2) * T
    const topBot = new THREE.BoxGeometry(stripW, 0.20, T)
    const top = new THREE.Mesh(topBot, mat)
    top.position.set((W / 2 - 0.5) * T, roadH, -offset)
    top.receiveShadow = true
    this.group.add(top)

    const bot = new THREE.Mesh(topBot, mat)
    bot.position.set((W / 2 - 0.5) * T, roadH, (H - 1) * T + offset)
    bot.receiveShadow = true
    this.group.add(bot)

    // Left and Right strips (inner height only, corners already covered)
    const stripD = (H - 2) * T
    const sideBuf = new THREE.BoxGeometry(T, 0.20, stripD)
    const left = new THREE.Mesh(sideBuf, mat)
    left.position.set(-offset, roadH, (H / 2 - 0.5) * T)
    left.receiveShadow = true
    this.group.add(left)

    const right = new THREE.Mesh(sideBuf, mat)
    right.position.set((W - 1) * T + offset, roadH, (H / 2 - 0.5) * T)
    right.receiveShadow = true
    this.group.add(right)
  }

  // ---- Auto-bridge: small bridge models at every river↔land edge ----

  private buildRiverBridges(mapData: MapData) {
    const T = TILE_WORLD_SIZE
    const HALF = T * 0.5

    const isRiverLike = (nx: number, ny: number) => {
      if (nx < 0 || ny < 0 || nx >= mapData.width || ny >= mapData.height) return false
      const t = mapData.tiles[ny][nx].type
      return t === 'river' || t === 'bridge'
    }

    // [dx, dy, rotY, offsetX, offsetZ]
    const SIDES: [number, number, number, number, number][] = [
      [  0, -1, 0,           0,    -HALF ],  // N
      [  1,  0, Math.PI / 2, HALF,  0    ],  // E
      [  0,  1, Math.PI,     0,     HALF ],  // S
      [ -1,  0, -Math.PI/2, -HALF,  0    ],  // W
    ]

    for (let y = 0; y < mapData.height; y++) {
      for (let x = 0; x < mapData.width; x++) {
        if (!isRiverLike(x, y)) continue
        if (mapData.tiles[y][x].type === 'bridge') continue  // real bridge tile already handled

        for (const [dx, dy, rotY, ox, oz] of SIDES) {
          const nx = x + dx, ny = y + dy
          if (isRiverLike(nx, ny)) continue  // neighbor is also river → no bridge needed

          const m = cloneModel('bridge')
          if (m.children.length === 0) continue
          // Half scale: sits at the edge of the river tile
          m.scale.setScalar(T * 0.55)
          m.position.set(x * T + ox, 0.02, y * T + oz)
          m.rotation.y = rotY
          this.group.add(m)
        }
      }
    }
  }

  // ---- Decorative GLB on forest / mountain tiles ----

  private buildDecorations(mapData: MapData) {
    const T = TILE_WORLD_SIZE

    for (let y = 0; y < mapData.height; y++) {
      for (let x = 0; x < mapData.width; x++) {
        const type = mapData.tiles[y][x].type

        if (type === 'forest') {
          const m = cloneModel('grass-forest')
          if (m.children.length > 0) {
            m.scale.setScalar(T)
            m.position.set(x * T, 0, y * T)
            // slight rotation variation per tile for natural look
            m.rotation.y = ((x * 3 + y * 7) % 6) * (Math.PI / 3)
            this.group.add(m)
          } else {
            this.addFallbackTree(x, y)
          }
          continue
        }

        if (type === 'mountain') {
          // Only every 3rd tile to avoid crowding
          if ((x + y) % 3 !== 0) continue
          const m = cloneModel('stone-mountain')
          if (m.children.length > 0) {
            m.scale.setScalar(T * 1.2)
            m.position.set(x * T, 0, y * T)
            m.rotation.y = ((x * 5 + y * 11) % 6) * (Math.PI / 3)
            this.group.add(m)
          } else {
            this.addFallbackMountain(x, y)
          }
        }
      }
    }
  }

  // Fallback procedural tree (if GLB not loaded)
  private addFallbackTree(tileX: number, tileY: number) {
    const wx = tileX * TILE_WORLD_SIZE
    const wz = tileY * TILE_WORLD_SIZE
    const jx = (Math.random() - 0.5) * 0.3
    const jz = (Math.random() - 0.5) * 0.3

    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.9 })
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.12, 0.55, 6), trunkMat)
    trunk.position.set(wx + jx, 0.27, wz + jz)
    trunk.castShadow = true
    this.group.add(trunk)

    const greenShade = new THREE.Color().setHSL(0.28 + (Math.random() - 0.5) * 0.04, 0.65, 0.25)
    const coneMat = new THREE.MeshStandardMaterial({ color: greenShade, roughness: 0.85, flatShading: true })
    for (const l of [{ r: 0.52, h: 0.72, y: 0.78 }, { r: 0.40, h: 0.60, y: 1.22 }, { r: 0.26, h: 0.50, y: 1.60 }]) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(l.r, l.h, 7), coneMat)
      cone.position.set(wx + jx, l.y, wz + jz)
      cone.rotation.y = Math.random() * Math.PI
      cone.castShadow = true
      this.group.add(cone)
    }
  }

  // Fallback procedural mountain (if GLB not loaded)
  private addFallbackMountain(tileX: number, tileY: number) {
    const wx = tileX * TILE_WORLD_SIZE
    const wz = tileY * TILE_WORLD_SIZE
    const h = 1.4 + Math.random() * 1.2
    const r = 1.0 + Math.random() * 0.5
    const rockMat = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0.07, 0.15, 0.48), roughness: 0.95, flatShading: true })
    const snowMat = new THREE.MeshStandardMaterial({ color: 0xd8e8f0, roughness: 0.8, flatShading: true })
    const rock = new THREE.Mesh(new THREE.ConeGeometry(r, h, 6), rockMat)
    rock.position.set(wx, h / 2 + 0.5, wz)
    rock.rotation.y = Math.random() * Math.PI
    rock.castShadow = true
    this.group.add(rock)
    const snow = new THREE.Mesh(new THREE.ConeGeometry(r * 0.4, h * 0.35, 6), snowMat)
    snow.position.set(wx, h * 0.82 + 0.5, wz)
    snow.rotation.y = Math.random() * Math.PI
    this.group.add(snow)
  }

  private buildResourceMarkers(mapData: MapData) {
    const T = TILE_WORLD_SIZE
    const mat = new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0x886600, roughness: 0.3, metalness: 0.4 })
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.5, side: THREE.DoubleSide })

    for (const point of mapData.resourcePoints) {
      const marker = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.18, 5), mat)
      marker.position.set(point.x * T, 0.55, point.y * T)
      marker.rotation.y = Math.PI / 5
      this.group.add(marker)

      const ring = new THREE.Mesh(new THREE.RingGeometry(0.38, 0.48, 16), ringMat)
      ring.rotation.x = -Math.PI / 2
      ring.position.set(point.x * T, 0.18, point.y * T)
      this.group.add(ring)
    }
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
