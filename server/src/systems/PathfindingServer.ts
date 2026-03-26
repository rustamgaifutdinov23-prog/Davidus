import PF from 'pathfinding'
import type { MapData, TileData, UnitType } from '../../../shared/types.js'
import { INFANTRY_ONLY_TERRAIN } from '../../../shared/constants.js'

export function findPath(
  map: MapData,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  unitType: UnitType
): { x: number; y: number }[] {
  const grid = new PF.Grid(map.width, map.height)

  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const tile = map.tiles[y][x]
      let walkable = tile.passable

      // Non-infantry cannot enter forest/swamp that is infantry-only passable
      if (unitType !== 'infantry' && INFANTRY_ONLY_TERRAIN.includes(tile.type)) {
        walkable = false
      }

      grid.setWalkableAt(x, y, walkable)
    }
  }

  const finder = new PF.AStarFinder({
    allowDiagonal: false,
    dontCrossCorners: true,
  } as PF.FinderOptions)

  const rawPath = finder.findPath(
    Math.round(fromX), Math.round(fromY),
    Math.round(toX), Math.round(toY),
    grid
  )

  return rawPath.map(([x, y]) => ({ x, y }))
}
