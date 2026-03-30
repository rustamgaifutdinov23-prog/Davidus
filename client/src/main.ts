import { Game } from './core/Game.js'
import { LobbyUI } from './ui/LobbyUI.js'
import { NetworkManager } from './systems/NetworkManager.js'
import { preloadModels } from './utils/ModelLoader.js'

console.log('[Davidus] main.ts v4 loaded')

const MODELS_TO_PRELOAD = [
  // Units
  'soldier_pack', 'Tank', 'low_poly_anti-tank_gun', 'howitzer',
  // Buildings
  'building-castle', 'building-cabin', 'building-smelter', 'building-tower', 'building-market',
  // Terrain decorations
  'grass-forest', 'stone-mountain',
  // Road tiles
  'path-straight', 'path-corner', 'path-crossing', 'path-end', 'path-square', 'path-intersectionA',
  // River tiles
  'river-straight', 'river-corner', 'river-crossing', 'river-end', 'river-intersectionA',
  // Bridge
  'bridge',
]

const network = new NetworkManager()
const lobby = new LobbyUI(network)

lobby.onGameReady = async (gameState) => {
  console.log('[Davidus] preloading models...')

  // Show brief loading overlay
  const overlay = document.createElement('div')
  overlay.id = 'loading-overlay'
  overlay.style.cssText = 'position:fixed;inset:0;background:#1a1208;display:flex;align-items:center;justify-content:center;z-index:9999;font-family:monospace;color:#c8a060;font-size:1.1rem;letter-spacing:.05em'
  overlay.textContent = 'Loading models...'
  document.body.appendChild(overlay)

  await preloadModels(MODELS_TO_PRELOAD)
  document.body.removeChild(overlay)

  console.log('[Davidus] models loaded, starting game...')
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement
  const game = new Game(canvas, network)
  game.start(gameState)
}
