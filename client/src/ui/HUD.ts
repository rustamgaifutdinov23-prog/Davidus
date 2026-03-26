import type { GameState } from '@shared/types.js'

export class HUD {
  private moneyEl: HTMLElement
  private incomeEl: HTMLElement
  private selectedEl: HTMLElement
  private gameOverEl: HTMLElement

  constructor() {
    this.moneyEl = document.getElementById('hud-money')!
    this.incomeEl = document.getElementById('hud-income')!
    this.selectedEl = document.getElementById('hud-selected')!
    this.gameOverEl = document.getElementById('game-over')!
  }

  updateEconomy(money: number, income: number) {
    this.moneyEl.textContent = `💰 ${Math.floor(money)}`
    this.incomeEl.textContent = `+${income}/tick`
  }

  showSelectedUnits(ids: string[], state: GameState | null) {
    if (ids.length === 0) {
      this.selectedEl.innerHTML = ''
      return
    }
    if (!state) return
    const lines = ids.map((id) => {
      const u = state.units[id]
      if (!u) return ''
      return `<div class="unit-info">${u.type} HP:${Math.ceil(u.hp)}/${u.maxHp}</div>`
    })
    this.selectedEl.innerHTML = lines.join('')
  }

  showGameOver(winnerName: string) {
    this.gameOverEl.style.display = 'flex'
    this.gameOverEl.querySelector('.winner-name')!.textContent = `🏆 ${winnerName} wins!`
  }
}
