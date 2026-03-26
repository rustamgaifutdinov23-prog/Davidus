import type { FactionId } from '@shared/types.js'
import { NetworkManager } from '../systems/NetworkManager.js'

export class LobbyUI {
  private net: NetworkManager
  private inRoom = false
  onGameReady: () => void = () => {}

  constructor(net: NetworkManager) {
    this.net = net
    this.render()
    this.bindEvents()
  }

  private render() {
    const lobbyEl = document.getElementById('lobby')!
    lobbyEl.style.display = 'flex'
    lobbyEl.innerHTML = `
      <div class="lobby-box">
        <h1 class="game-title">DAVIDUS</h1>
        <p class="subtitle">Asian War Strategy</p>

        <div class="form-group">
          <label>Your Name</label>
          <input id="player-name" type="text" value="Commander" maxlength="20" />
        </div>

        <div class="form-group">
          <label>Faction</label>
          <select id="faction-select">
            <option value="korea">🇰🇷 Korea — Infantry -10% cost</option>
            <option value="japan">🇯🇵 Japan — Tanks +15% speed</option>
            <option value="china">🇨🇳 China — +100 starting gold</option>
            <option value="vietnam">🇻🇳 Vietnam — Infantry invisible in forest</option>
          </select>
        </div>

        <div class="btn-row">
          <button id="btn-create">CREATE ROOM</button>
          <button id="btn-join">JOIN ROOM</button>
        </div>

        <div id="join-section" style="display:none">
          <input id="room-code" type="text" placeholder="Room code (4 letters)" maxlength="4" style="text-transform:uppercase" />
          <button id="btn-join-confirm">JOIN</button>
        </div>

        <div id="room-info" style="display:none">
          <p>Room: <strong id="room-code-display"></strong></p>
          <p id="players-list"></p>
          <button id="btn-start" style="display:none">▶ START GAME</button>
          <p class="waiting">Waiting for players...</p>
        </div>

        <div id="lobby-error" class="error" style="display:none"></div>
      </div>
    `
  }

  private bindEvents() {
    document.getElementById('btn-create')!.onclick = () => this.createRoom()
    document.getElementById('btn-join')!.onclick = () => {
      const s = document.getElementById('join-section')!
      s.style.display = s.style.display === 'none' ? 'block' : 'none'
    }
    document.getElementById('btn-join-confirm')!.onclick = () => this.joinRoom()
    document.getElementById('btn-start')!.onclick = () => this.startGame()

    this.net.onPlayerJoined = ({ name, faction }) => {
      const list = document.getElementById('players-list')!
      list.innerHTML += `<br>${name} (${faction})`
    }

    this.net.onGameStarted = ({ gameState }) => {
      console.log('[Lobby] gameStarted received, inRoom:', this.inRoom, 'myId:', this.net.playerId, 'inPlayers:', !!gameState?.players?.[this.net.playerId])
      if (!this.inRoom) return
      if (!gameState?.players?.[this.net.playerId]) return
      document.getElementById('lobby')!.style.display = 'none'
      this.onGameReady()
    }
  }

  private getName(): string {
    return (document.getElementById('player-name') as HTMLInputElement).value.trim() || 'Commander'
  }

  private getFaction(): FactionId {
    return (document.getElementById('faction-select') as HTMLSelectElement).value as FactionId
  }

  private async createRoom() {
    const res = await this.net.createRoom(this.getName(), this.getFaction())
    if (!res.ok) return this.showError(res.error ?? 'Error')
    this.inRoom = true
    this.showRoomInfo(res.roomId!, true)
  }

  private async joinRoom() {
    const code = (document.getElementById('room-code') as HTMLInputElement).value.toUpperCase()
    const res = await this.net.joinRoom(code, this.getName(), this.getFaction())
    if (!res.ok) return this.showError(res.error ?? 'Error')
    this.inRoom = true
    this.showRoomInfo(code, false)
  }

  private async startGame() {
    const res = await this.net.startGame()
    if (!res.ok) this.showError(res.error ?? 'Error')
  }

  private showRoomInfo(code: string, isHost: boolean) {
    document.getElementById('room-info')!.style.display = 'block';
    (document.getElementById('room-code-display') as HTMLElement).textContent = code
    if (isHost) {
      (document.getElementById('btn-start') as HTMLElement).style.display = 'block'
    }
    this.clearError()
  }

  private showError(msg: string) {
    const el = document.getElementById('lobby-error')!
    el.textContent = msg
    el.style.display = 'block'
  }

  private clearError() {
    document.getElementById('lobby-error')!.style.display = 'none'
  }
}
