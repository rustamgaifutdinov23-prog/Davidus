import * as THREE from 'three'

export class Renderer {
  readonly renderer: THREE.WebGLRenderer
  readonly scene: THREE.Scene

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x87ceeb) // sky blue

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    this.renderer.setPixelRatio(window.devicePixelRatio)
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap

    this.setupLighting()

    window.addEventListener('resize', () => this.onResize())
  }

  private setupLighting() {
    // Ambient
    const ambient = new THREE.AmbientLight(0xfff8e7, 0.6)
    this.scene.add(ambient)

    // Sun directional light with shadows
    const sun = new THREE.DirectionalLight(0xfff5d0, 1.2)
    sun.position.set(50, 80, 30)
    sun.castShadow = true
    sun.shadow.mapSize.width = 2048
    sun.shadow.mapSize.height = 2048
    sun.shadow.camera.near = 0.5
    sun.shadow.camera.far = 300
    sun.shadow.camera.left = -100
    sun.shadow.camera.right = 100
    sun.shadow.camera.top = 100
    sun.shadow.camera.bottom = -100
    sun.shadow.bias = -0.001
    this.scene.add(sun)

    // Hemisphere sky/ground light for realism
    const hemi = new THREE.HemisphereLight(0xc9e8ff, 0x7ab552, 0.4)
    this.scene.add(hemi)
  }

  private onResize() {
    this.renderer.setSize(window.innerWidth, window.innerHeight)
  }

  render(camera: THREE.Camera) {
    this.renderer.render(this.scene, camera)
  }
}
