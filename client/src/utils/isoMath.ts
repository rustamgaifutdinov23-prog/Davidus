import * as THREE from 'three'
import { TILE_WORLD_SIZE } from './constants.js'

/**
 * Convert tile grid coords → Three.js world XZ position
 * The map lies flat on the XZ plane (Y is up).
 */
export function tileToWorld(tileX: number, tileY: number): THREE.Vector3 {
  return new THREE.Vector3(
    tileX * TILE_WORLD_SIZE,
    0,
    tileY * TILE_WORLD_SIZE
  )
}

/**
 * Convert world XZ → tile grid coords (float)
 */
export function worldToTile(worldX: number, worldZ: number): { x: number; y: number } {
  return {
    x: worldX / TILE_WORLD_SIZE,
    y: worldZ / TILE_WORLD_SIZE,
  }
}

/**
 * Raycast from camera through mouse position onto XZ plane (y=0)
 */
export function raycastTile(
  event: MouseEvent,
  camera: THREE.OrthographicCamera,
  canvas: HTMLCanvasElement
): { x: number; y: number } | null {
  const rect = canvas.getBoundingClientRect()
  const ndcX = ((event.clientX - rect.left) / rect.width) * 2 - 1
  const ndcY = -((event.clientY - rect.top) / rect.height) * 2 + 1

  const raycaster = new THREE.Raycaster()
  raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera)

  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  const target = new THREE.Vector3()
  raycaster.ray.intersectPlane(plane, target)

  if (!target) return null
  return worldToTile(target.x, target.z)
}
