import * as THREE from 'three'
import type { BuildingData, BuildingType } from '@shared/types.js'
import { FACTION_COLORS, TILE_WORLD_SIZE } from '../utils/constants.js'

const BLDG_SIZE: Record<BuildingType, [number, number, number]> = {
  headquarters: [1.4, 0.9, 1.4],
  barracks: [1.2, 0.6, 1.0],
  factory: [1.4, 0.55, 1.2],
  artillery_base: [1.0, 0.5, 1.0],
  admin_building: [0.8, 0.7, 0.8],
}

const BLDG_COLOR: Record<BuildingType, number> = {
  headquarters: 0xc8a060,
  barracks: 0x7a6050,
  factory: 0x6a6060,
  artillery_base: 0x5a5040,
  admin_building: 0xb09070,
}

export class BuildingMesh {
  mesh: THREE.Group
  private body: THREE.Mesh
  private flagPole: THREE.Mesh | null = null
  public id: string
  public ownerId: string

  constructor(data: BuildingData) {
    this.id = data.id
    this.ownerId = data.ownerId
    this.mesh = new THREE.Group()

    const [w, h, d] = BLDG_SIZE[data.type] ?? [1, 0.6, 1]
    const color = BLDG_COLOR[data.type] ?? 0x888888
    const factionColor = FACTION_COLORS[data.faction] ?? 0xffffff

    // Base
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color, roughness: 0.9 })
    )
    base.position.y = h / 2
    base.castShadow = true
    base.receiveShadow = true
    this.mesh.add(base)
    this.body = base

    // Roof (darker)
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.05, 0.08, d + 0.05),
      new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.95 })
    )
    roof.position.y = h + 0.04
    roof.castShadow = true
    this.mesh.add(roof)

    // Flag pole for HQ
    if (data.type === 'headquarters') {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.025, 0.9, 6),
        new THREE.MeshStandardMaterial({ color: 0x888888 })
      )
      pole.position.set(w / 2 - 0.1, h + 0.5, d / 2 - 0.1)
      this.mesh.add(pole)
      this.flagPole = pole

      const flag = new THREE.Mesh(
        new THREE.PlaneGeometry(0.3, 0.18),
        new THREE.MeshBasicMaterial({ color: factionColor, side: THREE.DoubleSide })
      )
      flag.position.set(w / 2 + 0.05, h + 0.85, d / 2 - 0.1)
      this.mesh.add(flag)
    }

    // Faction color stripe
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.02, 0.07, d + 0.02),
      new THREE.MeshBasicMaterial({ color: factionColor })
    )
    stripe.position.y = h * 0.35
    this.mesh.add(stripe)

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
