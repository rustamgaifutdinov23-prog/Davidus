import * as THREE from 'three'
import type { BuildingData, BuildingType } from '@shared/types.js'
import { FACTION_COLORS, TILE_WORLD_SIZE } from '../utils/constants.js'

// ---- HQ: large fortress with towers ----
function buildHQ(faction: number): THREE.Group {
  const g = new THREE.Group()
  const wallMat  = new THREE.MeshStandardMaterial({ color: 0xc8a878, roughness: 0.92, flatShading: true })
  const roofMat  = new THREE.MeshStandardMaterial({ color: 0x7a5a38, roughness: 0.88, flatShading: true })
  const flagMat  = new THREE.MeshBasicMaterial({ color: faction, side: THREE.DoubleSide })
  const windowMat = new THREE.MeshBasicMaterial({ color: 0x4488aa })

  // Main building
  const main = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 1.6), wallMat)
  main.position.y = 0.5
  main.castShadow = true; main.receiveShadow = true
  g.add(main)

  // Roof (pyramid)
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.15, 0.55, 4), roofMat)
  roof.position.y = 1.27
  roof.rotation.y = Math.PI / 4
  roof.castShadow = true
  g.add(roof)

  // 4 corner towers
  const towerGeom = new THREE.CylinderGeometry(0.22, 0.24, 1.2, 7)
  const towerTopGeom = new THREE.ConeGeometry(0.24, 0.4, 7)
  const towerOffsets = [[-0.72,-0.72],[0.72,-0.72],[-0.72,0.72],[0.72,0.72]]
  for (const [tx, tz] of towerOffsets) {
    const tower = new THREE.Mesh(towerGeom, wallMat)
    tower.position.set(tx, 0.6, tz)
    tower.castShadow = true
    g.add(tower)
    const towerRoof = new THREE.Mesh(towerTopGeom, roofMat)
    towerRoof.position.set(tx, 1.4, tz)
    g.add(towerRoof)
  }

  // Faction flag
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.1, 5), new THREE.MeshStandardMaterial({ color: 0x888888 }))
  pole.position.set(0.55, 1.85, 0.55)
  g.add(pole)
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.22), flagMat)
  flag.position.set(0.74, 2.28, 0.55)
  g.add(flag)

  // Windows
  const winGeom = new THREE.PlaneGeometry(0.14, 0.18)
  const winPositions = [
    { p: [0, 0.58, 0.81], r: 0 },
    { p: [0, 0.58, -0.81], r: Math.PI },
    { p: [0.81, 0.58, 0], r: Math.PI / 2 },
    { p: [-0.81, 0.58, 0], r: -Math.PI / 2 },
  ]
  for (const { p, r } of winPositions) {
    const win = new THREE.Mesh(winGeom, windowMat)
    win.position.set(p[0], p[1], p[2])
    win.rotation.y = r
    g.add(win)
  }

  return g
}

// ---- Barracks: rectangular building with yard ----
function buildBarracks(faction: number): THREE.Group {
  const g = new THREE.Group()
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x8a7060, roughness: 0.9, flatShading: true })
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x4a3828, roughness: 0.85, flatShading: true })
  const stripeMat = new THREE.MeshBasicMaterial({ color: faction })

  const main = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.7, 1.0), wallMat)
  main.position.y = 0.35
  main.castShadow = true; main.receiveShadow = true
  g.add(main)

  // Roof ridge
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.08, 1.05), roofMat)
  ridge.position.y = 0.74
  g.add(ridge)

  // Pitched roof
  for (const s of [-1, 1]) {
    const slope = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.06, 0.56), roofMat)
    slope.position.set(0, 0.62, s * 0.25)
    slope.rotation.x = s * 0.35
    g.add(slope)
  }

  // Faction stripe
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.06, 1.02), stripeMat)
  stripe.position.y = 0.1
  g.add(stripe)

  // Door
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.35, 0.04), new THREE.MeshStandardMaterial({ color: 0x2a1a0a }))
  door.position.set(0, 0.17, 0.52)
  g.add(door)

  // Small watchtower
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.8, 6), wallMat)
  tower.position.set(0.6, 0.4, -0.38)
  g.add(tower)
  const tRoof = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.22, 6), roofMat)
  tRoof.position.set(0.6, 0.9, -0.38)
  g.add(tRoof)

  return g
}

// ---- Factory: industrial hall with chimney ----
function buildFactory(faction: number): THREE.Group {
  const g = new THREE.Group()
  const metalMat  = new THREE.MeshStandardMaterial({ color: 0x6a6460, roughness: 0.85, flatShading: true })
  const roofMat   = new THREE.MeshStandardMaterial({ color: 0x3a3430, roughness: 0.9 })
  const chimMat   = new THREE.MeshStandardMaterial({ color: 0x2a2828, roughness: 0.95 })
  const stripeMat = new THREE.MeshBasicMaterial({ color: faction })

  // Main hall
  const hall = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7, 1.3), metalMat)
  hall.position.y = 0.35
  hall.castShadow = true; hall.receiveShadow = true
  g.add(hall)

  // Sawtooth roof (3 ridges)
  for (let i = 0; i < 3; i++) {
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.22, 0.4), roofMat)
    ridge.position.set(0, 0.81, -0.4 + i * 0.4)
    g.add(ridge)
  }

  // Chimneys
  for (const cx of [-0.5, 0.5]) {
    const chim = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.0, 7), chimMat)
    chim.position.set(cx, 1.2, -0.45)
    g.add(chim)
  }

  // Faction stripe
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.06, 1.32), stripeMat)
  stripe.position.y = 0.08
  g.add(stripe)

  // Gate
  const gate = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.42, 0.05), new THREE.MeshStandardMaterial({ color: 0x1a1412 }))
  gate.position.set(0, 0.21, 0.665)
  g.add(gate)

  return g
}

// ---- Artillery base: bunker with gun ----
function buildArtilleryBase(faction: number): THREE.Group {
  const g = new THREE.Group()
  const concrete = new THREE.MeshStandardMaterial({ color: 0x787060, roughness: 0.95, flatShading: true })
  const gunMat   = new THREE.MeshStandardMaterial({ color: 0x3a3830, roughness: 0.8, metalness: 0.2 })
  const stripeMat = new THREE.MeshBasicMaterial({ color: faction })

  // Bunker
  const bunker = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 1.2), concrete)
  bunker.position.y = 0.25
  bunker.castShadow = true
  g.add(bunker)

  // Sandbag wall (ring)
  const bagGeom = new THREE.CylinderGeometry(0.58, 0.62, 0.18, 16, 1, true)
  const bagMat  = new THREE.MeshStandardMaterial({ color: 0x9a8870, roughness: 0.95 })
  const bags = new THREE.Mesh(bagGeom, bagMat)
  bags.position.y = 0.59
  g.add(bags)

  // Howitzer barrel
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.18, 8), gunMat)
  base.position.set(0, 0.69, 0)
  g.add(base)
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.7, 7), gunMat)
  barrel.rotation.x = -Math.PI / 4
  barrel.position.set(0, 0.9, -0.3)
  g.add(barrel)

  // Faction stripe
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.05, 1.22), stripeMat)
  stripe.position.y = 0.05
  g.add(stripe)

  return g
}

// ---- Admin building: multi-story office ----
function buildAdmin(faction: number): THREE.Group {
  const g = new THREE.Group()
  const wallMat   = new THREE.MeshStandardMaterial({ color: 0xb09878, roughness: 0.8, flatShading: true })
  const roofMat   = new THREE.MeshStandardMaterial({ color: 0x2a2218, roughness: 0.9 })
  const glassMat  = new THREE.MeshBasicMaterial({ color: 0x88aacc, transparent: true, opacity: 0.6 })
  const stripeMat = new THREE.MeshBasicMaterial({ color: faction })

  // Ground floor
  const floor1 = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.38, 0.9), wallMat)
  floor1.position.y = 0.19
  floor1.castShadow = true; floor1.receiveShadow = true
  g.add(floor1)

  // 2nd floor (slightly smaller)
  const floor2 = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.34, 0.82), wallMat)
  floor2.position.y = 0.57
  floor2.castShadow = true
  g.add(floor2)

  // 3rd floor
  const floor3 = new THREE.Mesh(new THREE.BoxGeometry(0.70, 0.28, 0.70), wallMat)
  floor3.position.y = 0.91
  g.add(floor3)

  // Flat roof
  const roof = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.06, 0.74), roofMat)
  roof.position.y = 1.08
  g.add(roof)

  // Window grid on each floor
  const winGeom = new THREE.PlaneGeometry(0.1, 0.12)
  for (let fl = 0; fl < 3; fl++) {
    const flY = 0.26 + fl * 0.36
    const flHalf = (0.9 - fl * 0.1) / 2 + 0.005
    for (const offX of [-0.2, 0, 0.2]) {
      const win = new THREE.Mesh(winGeom, glassMat)
      win.position.set(offX, flY, flHalf)
      g.add(win)
      const winB = new THREE.Mesh(winGeom, glassMat)
      winB.position.set(offX, flY, -flHalf)
      winB.rotation.y = Math.PI
      g.add(winB)
    }
  }

  // Faction stripe at base
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.05, 0.92), stripeMat)
  stripe.position.y = 0.05
  g.add(stripe)

  return g
}

const BLDG_BUILDERS: Record<BuildingType, (faction: number) => THREE.Group> = {
  headquarters:   buildHQ,
  barracks:       buildBarracks,
  factory:        buildFactory,
  artillery_base: buildArtilleryBase,
  admin_building: buildAdmin,
}

export class BuildingMesh {
  mesh: THREE.Group
  public id: string
  public ownerId: string

  constructor(data: BuildingData) {
    this.id = data.id
    this.ownerId = data.ownerId
    this.mesh = new THREE.Group()

    const factionColor = FACTION_COLORS[data.faction] ?? 0x888888
    const builder = BLDG_BUILDERS[data.type]
    const body = builder ? builder(factionColor) : new THREE.Group()
    body.traverse(c => { if ((c as THREE.Mesh).isMesh) { c.castShadow = true; c.receiveShadow = true } })
    this.mesh.add(body)

    this.mesh.position.set(
      data.tileX * TILE_WORLD_SIZE,
      0,
      data.tileY * TILE_WORLD_SIZE
    )
  }

  destroy() {
    this.mesh.parent?.remove(this.mesh)
  }
}
