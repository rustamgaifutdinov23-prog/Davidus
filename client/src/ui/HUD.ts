import type { GameState, BuildingType, UnitType } from '@shared/types.js'
import { BUILDING_PRODUCES, UNIT_STATS, BUILDING_COSTS } from '@shared/constants.js'
import type { NetworkManager } from '../systems/NetworkManager.js'

const UNIT_ICONS: Record<UnitType, string> = {
  infantry: '🪖',
  tank: '🚀',
  antitank: '💥',
  howitzer: '🎯',
}

const BLDG_ICONS: Record<BuildingType, string> = {
  headquarters: '🏯',
  barracks: '⚔️',
  factory: '🏭',
  artillery_base: '🎯',
  admin_building: '🏢',
}

function formatTime(seconds: number): string {
  if (seconds <= 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export class HUD {
  private moneyEl: HTMLElement
  private incomeEl: HTMLElement
  private timerEl: HTMLElement
  private scoresEl: HTMLElement
  private selectedEl: HTMLElement
  private prodContentEl: HTMLElement
  private gameOverEl: HTMLElement
  private placeHintEl: HTMLElement

  private myPlayerId = ''
  private playerNames: Record<string, string> = {}
  private playerColors: Record<string, string> = {}
  private currentMoney = 0
  private selectedBuildingId: string | null = null
  private selectedBuildingType: BuildingType | null = null

  private net: NetworkManager

  onBuildBuilding: (type: BuildingType) => void = () => {}
  onTrainUnit: (buildingId: string, type: UnitType) => void = () => {}

  constructor(net: NetworkManager) {
    this.net = net
    this.moneyEl = document.getElementById('hud-money')!
    this.incomeEl = document.getElementById('hud-income')!
    this.timerEl = document.getElementById('hud-timer')!
    this.scoresEl = document.getElementById('hud-scores')!
    this.selectedEl = document.getElementById('hud-selected')!
    this.prodContentEl = document.getElementById('prod-content')!
    this.gameOverEl = document.getElementById('game-over')!
    this.placeHintEl = document.getElementById('place-hint')!

    this.bindBuildButtons()
  }

  private bindBuildButtons() {
    document.querySelectorAll<HTMLButtonElement>('#hud-build .build-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.type as BuildingType
        if (!type) return
        const cost = BUILDING_COSTS[type] ?? 999
        if (this.currentMoney < cost) return
        this.onBuildBuilding(type)
        this.setActiveBuildBtn(btn)
      })
    })
  }

  setActiveBuildBtn(activeBtn: HTMLButtonElement | null) {
    document.querySelectorAll<HTMLButtonElement>('#hud-build .build-btn').forEach(b => b.classList.remove('active'))
    activeBtn?.classList.add('active')
  }

  clearActiveBuildBtn() {
    document.querySelectorAll<HTMLButtonElement>('#hud-build .build-btn').forEach(b => b.classList.remove('active'))
  }

  init(playerId: string, gameState: GameState) {
    this.myPlayerId = playerId
    for (const p of Object.values(gameState.players)) {
      this.playerNames[p.id] = p.name
      this.playerColors[p.id] = p.color
    }

    // Show HUD bars
    document.getElementById('hud-top')!.style.display = 'flex'
    document.getElementById('hud-bottom')!.style.display = 'flex'

    // Build score display
    this.rebuildScores(gameState)

    // Init timer
    if (gameState.gameDurationSec !== null) {
      this.timerEl.textContent = formatTime(gameState.timeRemaining)
    } else {
      this.timerEl.textContent = '∞'
    }
  }

  private rebuildScores(gameState: GameState) {
    const players = Object.values(gameState.players)
    this.scoresEl.innerHTML = players.map((p, i) => {
      const isMe = p.id === this.myPlayerId
      const color = p.color ?? '#e8c060'
      return `
        ${i > 0 ? '<span class="score-sep">vs</span>' : ''}
        <div class="score-block">
          <span class="sn" style="color:${isMe ? '#a89060' : '#6a5030'}">${isMe ? '▶ ' : ''}${p.name}</span>
          <span class="sv" style="color:${color}" id="score-val-${p.id}">${p.score ?? 0}</span>
        </div>
      `
    }).join('')
  }

  updateEconomy(money: number, income: number) {
    this.currentMoney = money
    this.moneyEl.textContent = `${Math.floor(money)}`
    this.incomeEl.textContent = `+${income}/tick`
    this.refreshBuildButtonAffordability()
  }

  private refreshBuildButtonAffordability() {
    document.querySelectorAll<HTMLButtonElement>('#hud-build .build-btn').forEach(btn => {
      const type = btn.dataset.type as BuildingType
      const cost = BUILDING_COSTS[type] ?? 999
      if (this.currentMoney < cost) {
        btn.classList.add('cant-afford')
      } else {
        btn.classList.remove('cant-afford')
      }
    })
  }

  updateScore(scores: Record<string, number>) {
    for (const [pid, score] of Object.entries(scores)) {
      const el = document.getElementById(`score-val-${pid}`)
      if (el) el.textContent = String(score)
    }
  }

  updateTimer(timeRemaining: number) {
    this.timerEl.textContent = formatTime(timeRemaining)
    if (timeRemaining <= 60) {
      this.timerEl.classList.add('urgent')
    } else {
      this.timerEl.classList.remove('urgent')
    }
  }

  showSelectedUnits(ids: string[], state: GameState | null) {
    if (!state) return
    const container = this.selectedEl
    if (ids.length === 0) {
      container.innerHTML = '<div class="sel-hdr">Selected</div>'
      // Don't reset building selection — building panel managed separately
      return
    }

    const lines = ids.slice(0, 6).map(id => {
      const u = state.units[id]
      if (!u) return ''
      const ratio = u.hp / u.maxHp
      const hpClass = ratio > 0.6 ? 'ok' : ratio > 0.3 ? 'mid' : 'low'
      const icon = UNIT_ICONS[u.type] ?? '⬜'
      return `
        <div class="unit-card">
          <span class="uc-icon">${icon}</span>
          <span class="uc-name">${u.type}</span>
          <span class="uc-hp ${hpClass}">${Math.ceil(u.hp)}/${u.maxHp}</span>
        </div>
      `
    })

    container.innerHTML = `<div class="sel-hdr">Selected (${ids.length})</div>${lines.join('')}`
  }

  showSelectedBuilding(buildingId: string, buildingType: BuildingType, productionQueue: UnitType[]) {
    this.selectedBuildingId = buildingId
    this.selectedBuildingType = buildingType
    this.showProductionForBuilding(buildingId, buildingType, productionQueue)
  }

  private showProductionForBuilding(
    buildingId: string | null,
    buildingType: BuildingType | null,
    queue: UnitType[] = []
  ) {
    const el = this.prodContentEl
    if (!buildingId || !buildingType) {
      el.innerHTML = '<span style="font-size:0.65rem;color:#302818">Select a building</span>'
      return
    }

    const produces = BUILDING_PRODUCES[buildingType] ?? []
    if (produces.length === 0) {
      const icon = BLDG_ICONS[buildingType] ?? '🏠'
      el.innerHTML = `<div class="prod-bldg-name">${icon} ${buildingType.replace('_', ' ')}</div><div style="font-size:0.62rem;color:#3a3020">No production</div>`
      return
    }

    const queueStr = queue.length > 0 ? `<div style="font-size:0.6rem;color:#8878a0;margin:2px 0">Queue: ${queue.join(', ')}</div>` : ''
    const icon = BLDG_ICONS[buildingType] ?? '🏠'
    const btns = produces.map(ut => {
      const stats = UNIT_STATS[ut]
      const canAfford = this.currentMoney >= stats.cost
      return `
        <div class="prod-btn ${canAfford ? '' : 'cant-afford'}" data-unit="${ut}" data-bldg="${buildingId}">
          <span class="pb-icon">${UNIT_ICONS[ut] ?? '⬜'}</span>
          <span class="pb-name">${ut}</span>
          <span class="pb-cost">$${stats.cost}</span>
          <span class="pb-time">${stats.buildTime}s</span>
        </div>
      `
    }).join('')

    el.innerHTML = `<div class="prod-bldg-name">${icon} ${buildingType.replace('_', ' ')}</div>${queueStr}${btns}`

    el.querySelectorAll<HTMLElement>('.prod-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const ut = btn.dataset.unit as UnitType
        const bldg = btn.dataset.bldg!
        if (this.currentMoney < UNIT_STATS[ut].cost) return
        this.net.sendCommand({ type: 'buildUnit', buildingId: bldg, unitType: ut })
      })
    })
  }

  showPlaceHint(show: boolean) {
    this.placeHintEl.style.display = show ? 'block' : 'none'
  }

  showGameOver(winnerName: string, scores: Record<string, number>, reason: string) {
    const scoreHtml = Object.entries(scores).map(([pid, score]) => {
      const name = this.playerNames[pid] ?? pid.slice(0, 6)
      const color = this.playerColors[pid] ?? '#e8c060'
      return `<div class="go-entry"><div class="gen">${name}</div><div class="gev" style="color:${color}">${score} pts</div></div>`
    }).join('')

    const reasonText = reason === 'timeout' ? 'Time limit reached' : 'Opponent eliminated'

    document.getElementById('go-winner-name')!.textContent = `🏆 ${winnerName} wins!`
    document.getElementById('go-scores')!.innerHTML = scoreHtml
    document.getElementById('go-reason')!.textContent = reasonText
    this.gameOverEl.style.display = 'flex'
  }
}
