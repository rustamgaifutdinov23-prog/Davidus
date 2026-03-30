import * as THREE from 'three'
import type { UnitData, UnitType } from '@shared/types.js'
import { FACTION_COLORS, TILE_WORLD_SIZE } from '../utils/constants.js'
import { cloneModel } from '../utils/ModelLoader.js'

const UNIT_MODEL: Record<UnitType, string> = {
  infantry: 'soldier_pack',
  tank:     'Tank',
  antitank: 'low_poly_anti-tank_gun',
  howitzer: 'howitzer',
}

// Scale up so models are clearly visible from RTS camera
const UNIT_SCALE: Record<UnitType, number> = {
  infantry: 1.8,
  tank:     1.8,
  antitank: 1.8,
  howitzer: 1.8,
}

// Deterministic XZ slot offset — units on the same tile don't visually overlap
function idSlot(id: string): { x: number; z: number } {
  const h = id.split('').reduce((a, c, i) => (a + c.charCodeAt(0) * (i + 1)) | 0, 0)
  const slots = [
    [  0.0,  0.0 ], [  0.38,  0.0 ], [ -0.38,  0.0 ],
    [  0.0,  0.38 ], [  0.0, -0.38 ],
    [  0.28,  0.28 ], [ -0.28, -0.28 ], [  0.28, -0.28 ], [ -0.28,  0.28 ],
  ]
  const s = slots[Math.abs(h) % slots.length]
  return { x: s[0], z: s[1] }
}

export class UnitMesh {
  mesh: THREE.Group
  // bobWrapper wraps the GLB so idle bob doesn't overwrite the model's centering offset
  private bobWrapper: THREE.Group
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

  private readonly offsetX: number
  private readonly offsetZ: number

  // Facing direction
  private facingAngle = 0
  private targetFacing = 0

  constructor(data: UnitData) {
    this.id = data.id
    this.ownerId = data.ownerId
    this.mesh = new THREE.Group()

    const slot = idSlot(data.id)
    this.offsetX = slot.x
    this.offsetZ = slot.z

    // bobWrapper: we bob this group, not the GLB body (so GLB's own Y offset is preserved)
    this.bobWrapper = new THREE.Group()
    this.mesh.add(this.bobWrapper)

    // GLB body inside the wrapper
    const modelName = UNIT_MODEL[data.type]
    const glbBody = cloneModel(modelName)
    if (glbBody.children.length > 0) {
      glbBody.scale.setScalar(UNIT_SCALE[data.type])
      glbBody.traverse(c => { if ((c as THREE.Mesh).isMesh) c.castShadow = true })
      this.bobWrapper.add(glbBody)
    } else {
      this.bobWrapper.add(this.buildFallback(data.type))
    }

    // Faction color ring (flat circle on ground, radius = UNIT_SCALE based)
    const factionColor = FACTION_COLORS[data.faction] ?? 0x888888
    const factionRing = new THREE.Mesh(
      new THREE.RingGeometry(0.38, 0.58, 28),
      new THREE.MeshBasicMaterial({
        color: factionColor,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9,
        depthTest: false,
      })
    )
    factionRing.rotation.x = -Math.PI / 2
    factionRing.position.y = 0.03
    factionRing.renderOrder = 4
    this.mesh.add(factionRing)

    // HP bar background
    this.hpBg = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9, 0.12),
      new THREE.MeshBasicMaterial({ color: 0x220000, depthTest: false })
    )
    this.hpBg.position.set(0, 1.8, 0)
    this.hpBg.rotation.x = -Math.PI / 5
    this.hpBg.renderOrder = 5
    this.mesh.add(this.hpBg)

    // HP bar fill
    this.hpBar = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9, 0.12),
      new THREE.MeshBasicMaterial({ color: 0x00cc44, depthTest: false })
    )
    this.hpBar.position.set(0, 1.81, 0.001)
    this.hpBar.rotation.x = -Math.PI / 5
    this.hpBar.renderOrder = 6
    this.mesh.add(this.hpBar)

    // Selection ring
    this.selectionRing = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 0.68, 22),
      new THREE.MeshBasicMaterial({ color: 0x00ffcc, side: THREE.DoubleSide, depthTest: false, transparent: true, opacity: 0.85 })
    )
    this.selectionRing.rotation.x = -Math.PI / 2
    this.selectionRing.position.y = 0.05
    this.selectionRing.visible = false
    this.selectionRing.renderOrder = 7
    this.mesh.add(this.selectionRing)

    this.setPosition(data.x, data.y)
    this.updateHp(data.hp, data.maxHp)
  }

  private buildFallback(type: UnitType): THREE.Group {
    const g = new THREE.Group()
    const geom: Record<UnitType, THREE.BoxGeometry> = {
      infantry: new THREE.BoxGeometry(0.45, 0.9, 0.45),
      tank:     new THREE.BoxGeometry(0.9, 0.55, 1.1),
      antitank: new THREE.BoxGeometry(0.6, 0.35, 0.7),
      howitzer: new THREE.BoxGeometry(0.55, 0.32, 0.8),
    }
    const m = new THREE.Mesh(geom[type], new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.75 }))
    m.position.y = 0.4
    m.castShadow = true
    g.add(m)
    return g
  }

  setPosition(tileX: number, tileY: number) {
    const newX = tileX * TILE_WORLD_SIZE + this.offsetX
    const newZ = tileY * TILE_WORLD_SIZE + this.offsetZ

    // Update facing direction from movement vector
    const dx = newX - this.targetX
    const dz = newZ - this.targetZ
    if (this.interpT >= 1 && (Math.abs(dx) > 0.05 || Math.abs(dz) > 0.05)) {
      this.targetFacing = Math.atan2(dx, dz)
    }

    this.prevX = this.mesh.position.x
    this.prevZ = this.mesh.position.z
    this.targetX = newX
    this.targetZ = newZ
    this.interpT = 0
    this._tileX = tileX
  }

  updateHp(hp: number, maxHp: number) {
    const ratio = Math.max(0, hp / maxHp)
    this.hpBar.scale.x = ratio
    this.hpBar.position.x = (ratio - 1) * 0.45
    const mat = this.hpBar.material as THREE.MeshBasicMaterial
    if (ratio > 0.6) mat.color.set(0x22cc44)
    else if (ratio > 0.3) mat.color.set(0xffcc00)
    else mat.color.set(0xff3300)
  }

  setSelected(v: boolean) {
    this.selectionRing.visible = v
  }

  update(dt: number) {
    // Smooth position interpolation
    if (this.interpT < 1) {
      this.interpT = Math.min(1, this.interpT + dt * 10)
      const t = smoothStep(this.interpT)
      this.mesh.position.x = this.prevX + (this.targetX - this.prevX) * t
      this.mesh.position.z = this.prevZ + (this.targetZ - this.prevZ) * t
    }

    // Smooth facing rotation
    let da = this.targetFacing - this.facingAngle
    while (da > Math.PI) da -= 2 * Math.PI
    while (da < -Math.PI) da += 2 * Math.PI
    if (Math.abs(da) > 0.005) {
      this.facingAngle += da * Math.min(1, dt * 8)
      this.bobWrapper.rotation.y = this.facingAngle
    }

    // Idle bob on the wrapper — doesn't touch the GLB's own Y offset
    this.bobWrapper.position.y = Math.sin(Date.now() * 0.0018 + this._tileX * 0.7) * 0.018
  }

  destroy() {
    this.mesh.parent?.remove(this.mesh)
  }
}

function smoothStep(t: number): number {
  return t * t * (3 - 2 * t)
}
