import type { GameState, UnitData } from '../../../shared/types'
import { UNIT_STATS, TERRAIN_DEFENSE_BONUS, COMBAT_RANDOM_RANGE, ATTACK_COOLDOWN_MS } from '../../../shared/constants'

const lastAttackTime: Map<string, number> = new Map()

export function resolveCombat(state: GameState, now: number): string[] {
  const deadUnitIds: string[] = []

  for (const attacker of Object.values(state.units)) {
    if (attacker.state === 'dead') continue
    if (attacker.state !== 'attacking' || !attacker.attackTargetId) continue

    const last = lastAttackTime.get(attacker.id) ?? 0
    if (now - last < ATTACK_COOLDOWN_MS) continue

    const defender = state.units[attacker.attackTargetId]
    if (!defender || defender.state === 'dead') {
      attacker.state = 'idle'
      attacker.attackTargetId = null
      continue
    }

    // Range check
    const dist = Math.hypot(attacker.x - defender.x, attacker.y - defender.y)
    const range = UNIT_STATS[attacker.type].range
    if (dist > range + 0.5) {
      // Too far — try to approach
      attacker.state = 'moving'
      attacker.targetX = defender.x
      attacker.targetY = defender.y
      continue
    }

    // Compute damage
    const terrainType = state.map.tiles[Math.round(defender.y)]?.[Math.round(defender.x)]?.type ?? 'grass'
    const terrainBonus = TERRAIN_DEFENSE_BONUS[terrainType] ?? 0
    const atkStats = UNIT_STATS[attacker.type]
    const defStats = UNIT_STATS[defender.type]

    const rng = Math.floor(Math.random() * (COMBAT_RANDOM_RANGE * 2 + 1)) - COMBAT_RANDOM_RANGE
    const damage = Math.max(1, atkStats.attack - defStats.defense * (1 + terrainBonus) + rng)

    defender.hp = Math.max(0, defender.hp - damage)
    lastAttackTime.set(attacker.id, now)

    if (defender.hp <= 0) {
      defender.state = 'dead'
      deadUnitIds.push(defender.id)
    }
  }

  return deadUnitIds
}

export function checkAutoAttack(state: GameState) {
  for (const unit of Object.values(state.units)) {
    if (unit.state === 'dead' || unit.ownerId === undefined) continue
    if (unit.state === 'attacking') continue

    const range = UNIT_STATS[unit.type].range

    for (const enemy of Object.values(state.units)) {
      if (enemy.ownerId === unit.ownerId || enemy.state === 'dead') continue
      const dist = Math.hypot(unit.x - enemy.x, unit.y - enemy.y)
      if (dist <= range) {
        unit.state = 'attacking'
        unit.attackTargetId = enemy.id
        unit.path = []
        break
      }
    }
  }
}
