import * as THREE from 'three'
import type { UnitData, UnitType } from '@shared/types.js'
import { FACTION_COLORS, TILE_WORLD_SIZE } from '../utils/constants.js'

// Build a detailed low-poly infantry soldier
function buildSoldier(factionColor: number): THREE.Group {
  const g = new THREE.Group()
  const bodyMat = new THREE.MeshStandardMaterial({ color: factionColor, roughness: 0.8, flatShading: true })
  const skinMat  = new THREE.MeshStandardMaterial({ color: 0xd4a87a, roughness: 0.9, flatShading: true })
  const helmetMat = new THREE.MeshStandardMaterial({ color: 0x3a4a2a, roughness: 0.7, flatShading: true })
  const bootMat  = new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 0.95, flatShading: true })
  const gunMat   = new THREE.MeshStandardMaterial({ color: 0x1a1a18, roughness: 0.85 })

  // Legs
  const legGeom = new THREE.BoxGeometry(0.10, 0.25, 0.10)
  const legL = new THREE.Mesh(legGeom, bodyMat)
  legL.position.set(-0.065, 0.125, 0)
  g.add(legL)
  const legR = new THREE.Mesh(legGeom, bodyMat)
  legR.position.set(0.065, 0.125, 0)
  g.add(legR)

  // Boots
  const bootGeom = new THREE.BoxGeometry(0.11, 0.10, 0.14)
  const bootL = new THREE.Mesh(bootGeom, bootMat)
  bootL.position.set(-0.065, 0.05, 0.02)
  g.add(bootL)
  const bootR = new THREE.Mesh(bootGeom, bootMat)
  bootR.position.set(0.065, 0.05, 0.02)
  g.add(bootR)

  // Torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.28, 0.14), bodyMat)
  torso.position.set(0, 0.39, 0)
  g.add(torso)

  // Arms
  const armGeom = new THREE.BoxGeometry(0.08, 0.22, 0.08)
  const armL = new THREE.Mesh(armGeom, bodyMat)
  armL.position.set(-0.16, 0.36, 0)
  armL.rotation.z = 0.2
  g.add(armL)
  const armR = new THREE.Mesh(armGeom, bodyMat)
  armR.position.set(0.16, 0.36, 0)
  armR.rotation.z = -0.15
  g.add(armR)

  // Head
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.14), skinMat)
  head.position.set(0, 0.63, 0)
  g.add(head)

  // Helmet
  const helmet = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.09, 0.09, 6), helmetMat)
  helmet.position.set(0, 0.70, 0)
  g.add(helmet)
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.02, 8), helmetMat)
  brim.position.set(0, 0.665, 0)
  g.add(brim)

  // Rifle
  const rifle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.44), gunMat)
  rifle.position.set(0.18, 0.45, 0.18)
  rifle.rotation.x = 0.3
  g.add(rifle)

  return g
}

// Build a detailed low-poly tank
function buildTank(factionColor: number): THREE.Group {
  const g = new THREE.Group()
  const bodyMat  = new THREE.MeshStandardMaterial({ color: factionColor, roughness: 0.75, flatShading: true })
  const trackMat = new THREE.MeshStandardMaterial({ color: 0x1c1c18, roughness: 0.95 })
  const turretMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(factionColor).multiplyScalar(0.85), roughness: 0.7, flatShading: true })
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x606058, roughness: 0.6, metalness: 0.3 })

  // Hull
  const hull = new THREE.Mesh(new THREE.BoxGeometry(0.80, 0.30, 1.05), bodyMat)
  hull.position.y = 0.28
  hull.castShadow = true
  g.add(hull)

  // Upper hull (angled top)
  const upperHull = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.16, 0.75), bodyMat)
  upperHull.position.set(0, 0.50, -0.04)
  upperHull.rotation.x = 0.08
  g.add(upperHull)

  // Tracks (left and right)
  const trackGeom = new THREE.BoxGeometry(0.18, 0.22, 1.12)
  const trackL = new THREE.Mesh(trackGeom, trackMat)
  trackL.position.set(-0.44, 0.21, 0)
  g.add(trackL)
  const trackR = new THREE.Mesh(trackGeom, trackMat)
  trackR.position.set(0.44, 0.21, 0)
  g.add(trackR)

  // Track wheels (small cylinders along sides)
  const wheelGeom = new THREE.CylinderGeometry(0.10, 0.10, 0.07, 8)
  wheelGeom.rotateZ(Math.PI / 2)
  const wheelPositions = [-0.42, -0.18, 0.06, 0.30]
  for (const wz of wheelPositions) {
    const wL = new THREE.Mesh(wheelGeom, metalMat)
    wL.position.set(-0.485, 0.16, wz)
    g.add(wL)
    const wR = new THREE.Mesh(wheelGeom, metalMat)
    wR.position.set(0.485, 0.16, wz)
    g.add(wR)
  }

  // Turret base
  const turretBase = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.28, 0.16, 8), turretMat)
  turretBase.position.set(0, 0.64, -0.06)
  g.add(turretBase)

  // Turret top
  const turretTop = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.16, 0.50), turretMat)
  turretTop.position.set(0, 0.76, -0.08)
  g.add(turretTop)

  // Barrel
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.72, 7), metalMat)
  barrel.rotation.x = Math.PI / 2
  barrel.position.set(0, 0.76, -0.56)
  g.add(barrel)

  // Commander hatch
  const hatch = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.10, 0.06, 8), metalMat)
  hatch.position.set(0, 0.85, 0.08)
  g.add(hatch)

  return g
}

const UNIT_BUILDERS: Partial<Record<UnitType, (color: number) => THREE.Group>> = {
  infantry: buildSoldier,
  tank: buildTank,
}

function buildFallback(type: UnitType, color: number): THREE.Group {
  const g = new THREE.Group()
  const geoms: Record<string, THREE.BufferGeometry> = {
    antitank: new THREE.BoxGeometry(0.55, 0.3, 0.65),
    howitzer: new THREE.BoxGeometry(0.5, 0.28, 0.75),
  }
  const geom = geoms[type] ?? new THREE.BoxGeometry(0.5, 0.5, 0.5)
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.75 })
  const m = new THREE.Mesh(geom, mat)
  m.position.y = 0.35
  m.castShadow = true
  g.add(m)
  return g
}

export class UnitMesh {
  mesh: THREE.Group
  private body: THREE.Group
  private hpBar: THREE.Mesh
  private hpBg: THREE.Mesh
  private selectionRing: THREE.Mesh
  public id: string
  public ownerId: string

  private prevX = 0
  private prevZ = 0
  private targetX = 0
  private targetZ = 0
  private interpT = 1
  private _tileX = 0
  private _tileY = 0

  constructor(data: UnitData) {
    this.id = data.id
    this.ownerId = data.ownerId
    this.mesh = new THREE.Group()

    const factionColor = FACTION_COLORS[data.faction] ?? 0x888888

    // Build detailed body
    const builder = UNIT_BUILDERS[data.type]
    if (builder) {
      this.body = builder(factionColor)
    } else {
      this.body = buildFallback(data.type, factionColor)
    }
    this.body.traverse(c => { if ((c as THREE.Mesh).isMesh) { c.castShadow = true } })
    this.mesh.add(this.body)

    // HP bar background
    const hpBgGeom = new THREE.PlaneGeometry(0.85, 0.1)
    this.hpBg = new THREE.Mesh(hpBgGeom, new THREE.MeshBasicMaterial({ color: 0x220000, depthTest: false }))
    this.hpBg.position.set(0, 1.3, 0)
    this.hpBg.rotation.x = -Math.PI / 5
    this.hpBg.renderOrder = 5
    this.mesh.add(this.hpBg)

    // HP bar fill
    const hpGeom = new THREE.PlaneGeometry(0.85, 0.1)
    this.hpBar = new THREE.Mesh(hpGeom, new THREE.MeshBasicMaterial({ color: 0x00cc44, depthTest: false }))
    this.hpBar.position.set(0, 1.31, 0.001)
    this.hpBar.rotation.x = -Math.PI / 5
    this.hpBar.renderOrder = 6
    this.mesh.add(this.hpBar)

    // Selection ring
    const ringGeom = new THREE.RingGeometry(0.5, 0.65, 20)
    this.selectionRing = new THREE.Mesh(
      ringGeom,
      new THREE.MeshBasicMaterial({ color: 0x00ffcc, side: THREE.DoubleSide, depthTest: false, transparent: true, opacity: 0.85 })
    )
    this.selectionRing.rotation.x = -Math.PI / 2
    this.selectionRing.position.y = 0.04
    this.selectionRing.visible = false
    this.selectionRing.renderOrder = 7
    this.mesh.add(this.selectionRing)

    this.setPosition(data.x, data.y)
    this.updateHp(data.hp, data.maxHp)
  }

  setPosition(tileX: number, tileY: number) {
    this.prevX = this.mesh.position.x
    this.prevZ = this.mesh.position.z
    this.targetX = tileX * TILE_WORLD_SIZE
    this.targetZ = tileY * TILE_WORLD_SIZE
    this.interpT = 0
    this._tileX = tileX
    this._tileY = tileY
  }

  updateHp(hp: number, maxHp: number) {
    const ratio = Math.max(0, hp / maxHp)
    this.hpBar.scale.x = ratio
    this.hpBar.position.x = (ratio - 1) * 0.425
    const mat = this.hpBar.material as THREE.MeshBasicMaterial
    if (ratio > 0.6) mat.color.set(0x22cc44)
    else if (ratio > 0.3) mat.color.set(0xffcc00)
    else mat.color.set(0xff3300)
  }

  setSelected(v: boolean) {
    this.selectionRing.visible = v
  }

  update(dt: number) {
    if (this.interpT < 1) {
      this.interpT = Math.min(1, this.interpT + dt * 10)
      const t = smoothStep(this.interpT)
      this.mesh.position.x = this.prevX + (this.targetX - this.prevX) * t
      this.mesh.position.z = this.prevZ + (this.targetZ - this.prevZ) * t
    }

    // Subtle body movement
    this.body.position.y = Math.sin(Date.now() * 0.002 + this._tileX * 0.7) * 0.012
  }

  destroy() {
    this.mesh.parent?.remove(this.mesh)
  }
}

function smoothStep(t: number): number {
  return t * t * (3 - 2 * t)
}
