import * as THREE from 'three'
import type { BuildingData, BuildingType } from '@shared/types.js'
import { FACTION_COLORS, TILE_WORLD_SIZE } from '../utils/constants.js'
import { cloneModel } from '../utils/ModelLoader.js'

const BUILDING_MODEL: Record<BuildingType, string> = {
  headquarters:   'building-castle',
  barracks:       'building-cabin',
  factory:        'building-smelter',
  artillery_base: 'building-tower',
  admin_building: 'building-market',
}

export class BuildingMesh {
  mesh: THREE.Group
  public id: string
  public ownerId: string

  constructor(data: BuildingData) {
    this.id = data.id
    this.ownerId = data.ownerId
    this.mesh = new THREE.Group()

    // GLB body
    const modelName = BUILDING_MODEL[data.type]
    const body = cloneModel(modelName)
    if (body.children.length > 0) {
      body.scale.setScalar(TILE_WORLD_SIZE)
      body.traverse(c => {
        if ((c as THREE.Mesh).isMesh) {
          c.castShadow = true
          c.receiveShadow = true
        }
      })
    } else {
      // Fallback colored box
      const fallback = new THREE.Mesh(
        new THREE.BoxGeometry(1.4, 1.0, 1.4),
        new THREE.MeshStandardMaterial({ color: 0x8a7060, roughness: 0.9, flatShading: true })
      )
      fallback.position.y = 0.5
      body.add(fallback)
    }
    this.mesh.add(body)

    // Faction color ring on ground
    const factionColor = FACTION_COLORS[data.faction] ?? 0x888888
    const ringGeo = new THREE.RingGeometry(0.7, 0.95, 24)
    const ringMat = new THREE.MeshBasicMaterial({
      color: factionColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7,
      depthTest: false,
    })
    const factionRing = new THREE.Mesh(ringGeo, ringMat)
    factionRing.rotation.x = -Math.PI / 2
    factionRing.position.y = 0.02
    factionRing.renderOrder = 4
    this.mesh.add(factionRing)

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
