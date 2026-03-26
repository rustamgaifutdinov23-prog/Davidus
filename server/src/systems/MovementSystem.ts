import type { GameState, UnitData } from '../../../shared/types.js'
import { UNIT_STATS, TERRAIN_SPEED } from '../../../shared/constants.js'

export function updateMovement(state: GameState, dtSec: number) {
  for (const unit of Object.values(state.units)) {
    if (unit.state !== 'moving' || unit.path.length === 0 || unit.state === 'dead' as string) continue

    const stats = UNIT_STATS[unit.type]
    const currentTile = state.map.tiles[Math.round(unit.y)]?.[Math.round(unit.x)]
    const terrainSpeed = currentTile ? (TERRAIN_SPEED[currentTile.type] ?? 1.0) : 1.0
    const speed = stats.speed * terrainSpeed   // tiles/sec

    let distRemaining = speed * dtSec

    while (distRemaining > 0 && unit.path.length > 0) {
      const next = unit.path[0]
      const dx = next.x - unit.x
      const dy = next.y - unit.y
      const dist = Math.hypot(dx, dy)

      if (dist <= distRemaining) {
        unit.x = next.x
        unit.y = next.y
        unit.path.shift()
        distRemaining -= dist
      } else {
        const ratio = distRemaining / dist
        unit.x += dx * ratio
        unit.y += dy * ratio
        distRemaining = 0
      }
    }

    if (unit.path.length === 0) {
      unit.state = 'idle'
      unit.targetX = null
      unit.targetY = null
    }
  }
}
