import type { GameState } from '../../../shared/types'
import { BUILDING_INCOME, RESOURCE_POINT_INCOME, ECONOMY_TICK_SEC } from '../../../shared/constants'

export function tickEconomy(state: GameState) {
  // Reset income
  for (const player of Object.values(state.players)) {
    player.income = 0
  }

  // Building income
  for (const building of Object.values(state.buildings)) {
    if (building.state === 'destroyed') continue
    const player = state.players[building.ownerId]
    if (!player) continue
    const income = BUILDING_INCOME[building.type] ?? 0
    player.income += income
    player.money += income
  }

  // Resource point income
  for (const point of state.map.resourcePoints) {
    if (!point.ownerId) continue
    const player = state.players[point.ownerId]
    if (!player) continue
    player.income += RESOURCE_POINT_INCOME
    player.money += RESOURCE_POINT_INCOME
  }
}

export function tickProduction(state: GameState, dtSec: number) {
  for (const building of Object.values(state.buildings)) {
    if (building.state !== 'producing' || building.productionQueue.length === 0) continue

    building.productionTimer -= dtSec

    if (building.productionTimer <= 0) {
      // Spawn the unit
      building.productionQueue.shift()
      building.state = building.productionQueue.length > 0 ? 'producing' : 'idle'
      if (building.productionQueue.length > 0) {
        // start next
        // timer is set externally in GameRoom when adding to queue
      }
    }
  }
}
