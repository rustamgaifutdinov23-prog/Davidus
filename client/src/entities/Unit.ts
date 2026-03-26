import * as THREE from 'three'
import type { UnitData, UnitType } from '@shared/types.js'
import { FACTION_COLORS, TILE_WORLD_SIZE } from '../utils/constants.js'

const UNIT_GEOM: Record<UnitType, THREE.BufferGeometry> = {
  infantry: new THREE.CylinderGeometry(0.15, 0.15, 0.55, 8),
  tank: new THREE.BoxGeometry(0.7, 0.35, 0.9),
  antitank: new THREE.BoxGeometry(0.55, 0.3, 0.65),
  howitzer: new THREE.BoxGeometry(0.5, 0.28, 0.75),
}

export class UnitMesh {
  mesh: THREE.Group
  private bodyMesh: THREE.Mesh
  private hpBar: THREE.Mesh
  private hpBg: THREE.Mesh
  private selectionRing: THREE.Mesh
  public id: string
  public ownerId: string

  private _x = 0
  private _y = 0
  private prevX = 0
  private prevZ = 0
  private targetX = 0
  private targetZ = 0
  private interpT = 1  // interpolation progress 0→1

  constructor(data: UnitData) {
    this.id = data.id
    this.ownerId = data.ownerId
    this.mesh = new THREE.Group()

    // Body
    const geom = UNIT_GEOM[data.type] ?? UNIT_GEOM.infantry
    const color = FACTION_COLORS[data.faction] ?? 0x888888
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7 })
    this.bodyMesh = new THREE.Mesh(geom, mat)
    this.bodyMesh.castShadow = true
    this.bodyMesh.position.y = 0.35
    this.mesh.add(this.bodyMesh)

    // HP bar background
    const hpBgGeom = new THREE.PlaneGeometry(0.8, 0.12)
    this.hpBg = new THREE.Mesh(hpBgGeom, new THREE.MeshBasicMaterial({ color: 0x330000, depthTest: false }))
    this.hpBg.position.set(0, 1.1, 0)
    this.hpBg.rotation.x = -Math.PI / 4
    this.hpBg.renderOrder = 5
    this.mesh.add(this.hpBg)

    // HP bar fill
    const hpGeom = new THREE.PlaneGeometry(0.8, 0.12)
    this.hpBar = new THREE.Mesh(hpGeom, new THREE.MeshBasicMaterial({ color: 0x00cc44, depthTest: false }))
    this.hpBar.position.set(0, 1.12, 0.001)
    this.hpBar.rotation.x = -Math.PI / 4
    this.hpBar.renderOrder = 6
    this.mesh.add(this.hpBar)

    // Selection ring
    const ringGeom = new THREE.RingGeometry(0.45, 0.55, 16)
    this.selectionRing = new THREE.Mesh(
      ringGeom,
      new THREE.MeshBasicMaterial({ color: 0x00ffff, side: THREE.DoubleSide, depthTest: false })
    )
    this.selectionRing.rotation.x = -Math.PI / 2
    this.selectionRing.position.y = 0.05
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
    this._x = tileX
    this._y = tileY
  }

  updateHp(hp: number, maxHp: number) {
    const ratio = Math.max(0, hp / maxHp)
    this.hpBar.scale.x = ratio
    this.hpBar.position.x = (ratio - 1) * 0.4;
    // Color: green → yellow → red
    const mat = this.hpBar.material as THREE.MeshBasicMaterial
    if (ratio > 0.6) mat.color.set(0x00cc44)
    else if (ratio > 0.3) mat.color.set(0xffcc00)
    else mat.color.set(0xff2200)
  }

  setSelected(v: boolean) {
    this.selectionRing.visible = v
  }

  update(dt: number) {
    if (this.interpT < 1) {
      this.interpT = Math.min(1, this.interpT + dt * 8)
      const t = this.interpT
      this.mesh.position.x = this.prevX + (this.targetX - this.prevX) * t
      this.mesh.position.z = this.prevZ + (this.targetZ - this.prevZ) * t
    }

    // Slight bob
    this.bodyMesh.position.y = 0.35 + Math.sin(Date.now() * 0.003 + this._x) * 0.015
  }

  destroy() {
    this.mesh.parent?.remove(this.mesh)
  }
}
