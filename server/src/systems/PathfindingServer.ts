import PF from 'pathfinding'
import type { MapData, UnitType } from '../../../shared/types'
import { INFANTRY_ONLY_TERRAIN } from '../../../shared/constants'

// Cache grids per unit category to avoid rebuilding 200x200 grid every call
const gridCache = new Map<string, PF.Grid>()

export function buildGridCache(map: MapData) {
  gridCache.clear()

  for (const category of ['infantry', 'vehicle'] as const) {
    const grid = new PF.Grid(map.width, map.height)
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const tile = map.tiles[y][x]
        let walkable = tile.passable
        if (category === 'vehicle' && INFANTRY_ONLY_TERRAIN.includes(tile.type)) {
          walkable = false
        }
        grid.setWalkableAt(x, y, walkable)
      }
    }
    gridCache.set(category, grid)
  }
}

export function findPath(
  map: MapData,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  unitType: UnitType
): { x: number; y: number }[] {
  const category = unitType === 'infantry' ? 'infantry' : 'vehicle'

  if (!gridCache.has(category)) {
    buildGridCache(map)
  }

  // Clone the cached grid — PF.Grid.clone() for A* to avoid mutation
  const baseGrid = gridCache.get(category)!
  const grid = baseGrid.clone()

  const finder = new PF.AStarFinder({
    allowDiagonal: false,
    dontCrossCorners: true,
  } as PF.FinderOptions)

  const fx = Math.max(0, Math.min(map.width - 1, Math.round(fromX)))
  const fy = Math.max(0, Math.min(map.height - 1, Math.round(fromY)))
  const tx = Math.max(0, Math.min(map.width - 1, Math.round(toX)))
  const ty = Math.max(0, Math.min(map.height - 1, Math.round(toY)))

  const rawPath = finder.findPath(fx, fy, tx, ty, grid)
  return rawPath.map(([x, y]) => ({ x, y }))
}
