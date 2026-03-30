import { Game } from './core/Game.js'
import { LobbyUI } from './ui/LobbyUI.js'
import { NetworkManager } from './systems/NetworkManager.js'

console.log('[Davidus] main.ts v3 loaded')

const network = new NetworkManager()
const lobby = new LobbyUI(network)

lobby.onGameReady = (gameState) => {
  console.log('[Davidus] game starting...')
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement
  const game = new Game(canvas, network)
  game.start(gameState)
}
