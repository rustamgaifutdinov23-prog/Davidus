import * as THREE from 'three'
import type { UnitMesh } from '../entities/Unit.js'
import { raycastTile } from '../utils/isoMath.js'

export class SelectionSystem {
  private selectedIds = new Set<string>()
  private unitMeshes: Map<string, UnitMesh> = new Map()
  private camera: THREE.OrthographicCamera
  private canvas: HTMLCanvasElement

  // Box select
  private boxStart: THREE.Vector2 | null = null
  private boxEl: HTMLDivElement
  private isBoxSelecting = false

  onSelectUnits: (ids: string[]) => void = () => {}
  onRightClick: (tileX: number, tileY: number) => void = () => {}

  constructor(camera: THREE.OrthographicCamera, canvas: HTMLCanvasElement) {
    this.camera = camera
    this.canvas = canvas
    this.boxEl = this.createBoxEl()
    this.bindEvents()
  }

  private createBoxEl(): HTMLDivElement {
    const el = document.createElement('div')
    el.style.cssText = `
      position: fixed; border: 1px solid #00ffff; background: rgba(0,200,200,0.08);
      pointer-events: none; display: none; z-index: 100;
    `
    document.body.appendChild(el)
    return el
  }

  private bindEvents() {
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.boxStart = new THREE.Vector2(e.clientX, e.clientY)
        this.isBoxSelecting = false
      }
      if (e.button === 2) {
        const tile = raycastTile(e, this.camera, this.canvas)
        if (tile) this.onRightClick(Math.round(tile.x), Math.round(tile.y))
      }
    })

    this.canvas.addEventListener('mousemove', (e) => {
      if (!this.boxStart) return
      const dx = Math.abs(e.clientX - this.boxStart.x)
      const dy = Math.abs(e.clientY - this.boxStart.y)
      if (dx > 5 || dy > 5) {
        this.isBoxSelecting = true
        this.updateBoxEl(e)
      }
    })

    this.canvas.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        if (this.isBoxSelecting) {
          this.finishBoxSelect(e)
        } else {
          this.clickSelect(e)
        }
        this.boxStart = null
        this.isBoxSelecting = false
        this.boxEl.style.display = 'none'
      }
    })

    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault())
  }

  private updateBoxEl(e: MouseEvent) {
    if (!this.boxStart) return
    const left = Math.min(e.clientX, this.boxStart.x)
    const top = Math.min(e.clientY, this.boxStart.y)
    const w = Math.abs(e.clientX - this.boxStart.x)
    const h = Math.abs(e.clientY - this.boxStart.y)
    this.boxEl.style.cssText += `display:block; left:${left}px; top:${top}px; width:${w}px; height:${h}px;`
  }

  private clickSelect(e: MouseEvent) {
    // Raycast to find unit
    const rect = this.canvas.getBoundingClientRect()
    const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1
    const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1
    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera)

    const meshes: THREE.Object3D[] = []
    for (const [, um] of this.unitMeshes) {
      meshes.push(um.mesh)
    }

    const hits = raycaster.intersectObjects(meshes, true)
    if (hits.length > 0) {
      // Find which unit was hit
      const hit = hits[0].object
      for (const [id, um] of this.unitMeshes) {
        if (um.mesh === hit || um.mesh.getObjectById(hit.id)) {
          if (!e.shiftKey) this.clearSelection()
          this.selectUnit(id)
          return
        }
      }
    }

    // Nothing hit — deselect
    if (!e.shiftKey) this.clearSelection()
  }

  private finishBoxSelect(e: MouseEvent) {
    if (!this.boxStart) return
    const rect = this.canvas.getBoundingClientRect()
    const x1 = (Math.min(e.clientX, this.boxStart.x) - rect.left) / rect.width * 2 - 1
    const x2 = (Math.max(e.clientX, this.boxStart.x) - rect.left) / rect.width * 2 - 1
    const y1 = -((Math.max(e.clientY, this.boxStart.y) - rect.top) / rect.height * 2 - 1)
    const y2 = -((Math.min(e.clientY, this.boxStart.y) - rect.top) / rect.height * 2 - 1)

    if (!e.shiftKey) this.clearSelection()

    for (const [id, um] of this.unitMeshes) {
      const pos = um.mesh.position.clone().project(this.camera)
      if (pos.x >= x1 && pos.x <= x2 && pos.y >= y1 && pos.y <= y2) {
        this.selectUnit(id)
      }
    }
  }

  private selectUnit(id: string) {
    this.selectedIds.add(id)
    this.unitMeshes.get(id)?.setSelected(true)
    this.onSelectUnits([...this.selectedIds])
  }

  clearSelection() {
    for (const id of this.selectedIds) {
      this.unitMeshes.get(id)?.setSelected(false)
    }
    this.selectedIds.clear()
    this.onSelectUnits([])
  }

  get selectedUnitIds(): string[] {
    return [...this.selectedIds]
  }

  setUnitMeshes(meshes: Map<string, UnitMesh>) {
    this.unitMeshes = meshes
  }
}
