import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import * as THREE from 'three'

const loader = new GLTFLoader()
const cache = new Map<string, THREE.Group>()

// Kenney models share one texture atlas — preload it so it's ready before models use it
const colormapTexture = new THREE.TextureLoader().load('/models/Textures/colormap.png')
colormapTexture.flipY = false   // GLB UVs are Y-up

export async function preloadModels(names: string[]): Promise<void> {
  await Promise.all(names.map(async (name) => {
    if (cache.has(name)) return
    try {
      const gltf = await loader.loadAsync(`/models/${name}.glb`)
      const scene = gltf.scene

      // Center model: bottom at Y=0, XZ centered at origin
      const box = new THREE.Box3().setFromObject(scene)
      const center = box.getCenter(new THREE.Vector3())
      scene.position.x -= center.x
      scene.position.z -= center.z
      scene.position.y -= box.min.y
      scene.updateMatrixWorld(true)

      scene.traverse(c => {
        if (!(c as THREE.Mesh).isMesh) return
        const mesh = c as THREE.Mesh
        c.castShadow = true
        c.receiveShadow = true

        // Apply shared colormap texture if material has no map
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        for (const mat of mats) {
          if (mat instanceof THREE.MeshStandardMaterial && !mat.map) {
            mat.map = colormapTexture
            mat.needsUpdate = true
          }
        }
      })

      cache.set(name, scene)
    } catch (e) {
      console.warn(`[ModelLoader] Failed to load ${name}:`, e)
    }
  }))
}

export function cloneModel(name: string): THREE.Group {
  const cached = cache.get(name)
  if (!cached) {
    console.warn(`[ModelLoader] ${name} not preloaded — using placeholder`)
    return new THREE.Group()
  }
  return cached.clone(true)
}
