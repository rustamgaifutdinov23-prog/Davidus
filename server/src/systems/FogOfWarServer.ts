import type { GameState } from '../../../shared/types.js'
import { UNIT_STATS } from '../../../shared/constants.js'

export interface FogResult {
  playerId: string
  visibleTiles: [number, number][]
  visibleUnitIds: string[]
}

export function computeFogOfWar(state: GameState): FogResult[] {
  const results: FogResult[] = []

  for (const playerId of Object.keys(state.players)) {
    const visibleSet = new Set<string>()   // "x,y" keys
    const visibleUnitIds: string[] = []

    // Collect vision from own units
    for (const unit of Object.values(state.units)) {
      if (unit.ownerId !== playerId || unit.state === 'dead') continue

      const stats = UNIT_STATS[unit.type]
      const range = stats.visionRange
      const ux = Math.round(unit.x)
      const uy = Math.round(unit.y)

      for (let dy = -range; dy <= range; dy++) {
        for (let dx = -range; dx <= range; dx++) {
          if (dx * dx + dy * dy <= range * range) {
            const tx = ux + dx
            const ty = uy + dy
            if (tx >= 0 && ty >= 0 && tx < state.map.width && ty < state.map.height) {
              visibleSet.add(`${tx},${ty}`)
            }
          }
        }
      }
    }

    // Collect vision from own buildings
    for (const building of Object.values(state.buildings)) {
      if (building.ownerId !== playerId || building.state === 'destroyed') continue
      const range = 4
      const bx = building.tileX
      const by = building.tileY
      for (let dy = -range; dy <= range; dy++) {
        for (let dx = -range; dx <= range; dx++) {
          if (dx * dx + dy * dy <= range * range) {
            const tx = bx + dx
            const ty = by + dy
            if (tx >= 0 && ty >= 0 && tx < state.map.width && ty < state.map.height) {
              visibleSet.add(`${tx},${ty}`)
            }
          }
        }
      }
    }

    // Which enemy units are in visible tiles?
    for (const unit of Object.values(state.units)) {
      if (unit.ownerId === playerId || unit.state === 'dead') continue
      const key = `${Math.round(unit.x)},${Math.round(unit.y)}`
      if (visibleSet.has(key)) {
        visibleUnitIds.push(unit.id)
      }
    }

    const visibleTiles: [number, number][] = []
    for (const key of visibleSet) {
      const [x, y] = key.split(',').map(Number)
      visibleTiles.push([x, y])
    }

    results.push({ playerId, visibleTiles, visibleUnitIds })
  }

  return results
}
