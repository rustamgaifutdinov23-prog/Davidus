import type { GameState, GameCommand, BuildingType, UnitType } from '../../../shared/types.js'
import { BUILDING_COSTS, BUILDING_PRODUCES, UNIT_STATS, FACTION_MODIFIERS } from '../../../shared/constants.js'

export type ValidationResult = { ok: true } | { ok: false; error: string }

export function validateCommand(
  state: GameState,
  playerId: string,
  cmd: GameCommand
): ValidationResult {
  const player = state.players[playerId]
  if (!player) return { ok: false, error: 'Player not found' }
  if (!state.started) return { ok: false, error: 'Game not started' }

  switch (cmd.type) {
    case 'move': {
      const unit = state.units[cmd.unitId]
      if (!unit) return { ok: false, error: 'Unit not found' }
      if (unit.ownerId !== playerId) return { ok: false, error: 'Not your unit' }
      if (unit.state === 'dead') return { ok: false, error: 'Unit is dead' }
      if (cmd.targetX < 0 || cmd.targetY < 0 || cmd.targetX >= state.map.width || cmd.targetY >= state.map.height)
        return { ok: false, error: 'Out of bounds' }
      const tile = state.map.tiles[Math.round(cmd.targetY)]?.[Math.round(cmd.targetX)]
      if (!tile || !tile.passable) return { ok: false, error: 'Tile not passable' }
      return { ok: true }
    }

    case 'attack': {
      const unit = state.units[cmd.unitId]
      if (!unit) return { ok: false, error: 'Unit not found' }
      if (unit.ownerId !== playerId) return { ok: false, error: 'Not your unit' }
      const target = state.units[cmd.targetUnitId]
      if (!target) return { ok: false, error: 'Target not found' }
      if (target.ownerId === playerId) return { ok: false, error: 'Cannot attack own unit' }
      if (target.state === 'dead') return { ok: false, error: 'Target already dead' }
      return { ok: true }
    }

    case 'buildUnit': {
      const building = state.buildings[cmd.buildingId]
      if (!building) return { ok: false, error: 'Building not found' }
      if (building.ownerId !== playerId) return { ok: false, error: 'Not your building' }
      if (building.state === 'destroyed') return { ok: false, error: 'Building destroyed' }

      const allowed = BUILDING_PRODUCES[building.type]
      if (!allowed || !allowed.includes(cmd.unitType)) {
        return { ok: false, error: `Building cannot produce ${cmd.unitType}` }
      }

      const baseCost = UNIT_STATS[cmd.unitType].cost
      const mods = FACTION_MODIFIERS[player.faction]
      const cost = cmd.unitType === 'infantry'
        ? Math.floor(baseCost * mods.infantryCostMult)
        : baseCost

      if (player.money < cost) return { ok: false, error: 'Not enough money' }
      return { ok: true }
    }

    case 'buildBuilding': {
      const cost = BUILDING_COSTS[cmd.buildingType]
      if (player.money < cost) return { ok: false, error: 'Not enough money' }
      if (cmd.tileX < 0 || cmd.tileY < 0 || cmd.tileX >= state.map.width || cmd.tileY >= state.map.height)
        return { ok: false, error: 'Out of bounds' }
      const tile = state.map.tiles[cmd.tileY]?.[cmd.tileX]
      if (!tile || !tile.passable) return { ok: false, error: 'Cannot build here' }
      // Check no other building on this tile
      const occupied = Object.values(state.buildings).some(
        b => b.tileX === cmd.tileX && b.tileY === cmd.tileY && b.state !== 'destroyed'
      )
      if (occupied) return { ok: false, error: 'Tile occupied' }
      return { ok: true }
    }

    case 'capture': {
      const unit = state.units[cmd.unitId]
      if (!unit) return { ok: false, error: 'Unit not found' }
      if (unit.ownerId !== playerId) return { ok: false, error: 'Not your unit' }
      if (unit.type !== 'infantry') return { ok: false, error: 'Only infantry can capture' }
      const point = state.map.resourcePoints.find(p => p.id === cmd.pointId)
      if (!point) return { ok: false, error: 'Resource point not found' }
      if (point.ownerId === playerId) return { ok: false, error: 'Already yours' }
      return { ok: true }
    }

    default:
      return { ok: false, error: 'Unknown command' }
  }
}
