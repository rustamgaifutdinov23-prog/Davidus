import { Game } from './core/Game.js'
import { LobbyUI } from './ui/LobbyUI.js'

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement
const game = new Game(canvas)
const lobby = new LobbyUI(game.network)

lobby.onGameReady = () => {
  game.start()
}
