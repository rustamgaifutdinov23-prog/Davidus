import type { BuildingData, BuildingType, UnitType } from '@shared/types.js'
import { BUILDING_PRODUCES, UNIT_STATS } from '@shared/constants.js'
import type { NetworkManager } from '../systems/NetworkManager.js'

export class BuildPanel {
  private net: NetworkManager
  private el: HTMLElement
  private selectedBuildingId: string | null = null

  constructor(net: NetworkManager) {
    this.net = net
    this.el = document.getElementById('build-panel')!
  }

  showBuilding(building: BuildingData) {
    this.selectedBuildingId = building.id
    const produces = BUILDING_PRODUCES[building.type] ?? []

    if (produces.length === 0) {
      this.el.innerHTML = `<div class="bldg-name">${building.type.replace('_', ' ').toUpperCase()}</div><p>No production</p>`
      this.el.style.display = 'block'
      return
    }

    const btns = produces.map((ut) => {
      const stats = UNIT_STATS[ut]
      return `
        <button class="build-btn" data-unit="${ut}">
          <span class="unit-name">${ut}</span>
          <span class="unit-cost">💰${stats.cost}</span>
          <span class="unit-time">⏱${stats.buildTime}s</span>
        </button>
      `
    }).join('')

    this.el.innerHTML = `
      <div class="bldg-name">${building.type.replace('_', ' ').toUpperCase()}</div>
      <div class="production-queue">Queue: ${building.productionQueue.length}</div>
      ${btns}
    `
    this.el.style.display = 'block'

    this.el.querySelectorAll('.build-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const unitType = (btn as HTMLElement).dataset.unit as UnitType
        if (this.selectedBuildingId) {
          this.net.sendCommand({
            type: 'buildUnit',
            buildingId: this.selectedBuildingId,
            unitType,
          })
        }
      })
    })
  }

  hide() {
    this.el.style.display = 'none'
    this.selectedBuildingId = null
  }
}
