import { forwardRef, useEffect, useMemo, useRef } from 'react'
import { useAnimations, useGLTF } from '@react-three/drei'
import { Box3, DoubleSide, LoopOnce, LoopRepeat, Vector3 } from 'three'
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js'

const Champion = forwardRef(function Champion({ champion, initialPosition, animation, token, onAnimationComplete, ghost = false }, externalRef) {
  const { id } = champion
  const innerRoot = useRef(null)
  const { scene, animations } = useGLTF(champion.modelUrl)
  const modelSetup = useMemo(() => {
    const clone = cloneSkinned(scene)
    const meshes = []
    const materialStates = []
    clone.traverse((object) => {
      if (object.isMesh) {
        meshes.push(object)
        const materials = Array.isArray(object.material) ? object.material : [object.material]
        const displayMaterials = materials.map((material) => {
          if (!material) return material
          const displayMaterial = material.clone()
          displayMaterial.side = DoubleSide
          materialStates.push({
            material: displayMaterial,
            transparent: displayMaterial.transparent,
            opacity: displayMaterial.opacity,
            depthWrite: displayMaterial.depthWrite,
          })
          return displayMaterial
        })
        object.material = Array.isArray(object.material) ? displayMaterials : displayMaterials[0]
      }
    })
    clone.updateMatrixWorld(true)
    const bounds = new Box3().setFromObject(clone)
    const size = bounds.getSize(new Vector3())
    const center = bounds.getCenter(new Vector3())
    const scale = champion.targetHeight / Math.max(0.01, size.y)
    const groundMarker = clone.getObjectByName('Buffbone_Glb_Ground_Loc')
    const groundPosition = groundMarker?.getWorldPosition(new Vector3()) || center
    return {
      scene: clone,
      scale,
      offset: [-groundPosition.x * scale, -bounds.min.y * scale, -groundPosition.z * scale],
      meshes,
      materialStates,
    }
  }, [champion, scene])
  const { actions, mixer } = useAnimations(animations, innerRoot)

  useEffect(() => {
    for (const mesh of modelSetup.meshes) {
      mesh.castShadow = !ghost
      mesh.receiveShadow = !ghost
    }
    for (const state of modelSetup.materialStates) {
      state.material.transparent = ghost || state.transparent
      state.material.opacity = ghost ? 0.42 : state.opacity
      state.material.depthWrite = ghost ? false : state.depthWrite
      state.material.needsUpdate = true
    }
  }, [ghost, modelSetup])

  useEffect(() => {
    const clips = champion.animations[animation] || champion.animations.idle
    let index = 0
    let activeAction = null
    const blendDuration = 0.18

    const play = () => {
      const action = actions[clips[index]]
      if (!action) {
        if (index >= clips.length - 1) onAnimationComplete?.(id)
        return
      }

      if (animation === 'idle' || animation === 'move') {
        action.reset()
        action.setLoop(LoopRepeat, Infinity)
      } else {
        action.reset()
        action.setLoop(LoopOnce, 1)
        const animationDuration = champion.animationDurations?.[animation]
        if (animationDuration) action.setDuration(animationDuration / clips.length)
      }

      action.clampWhenFinished = true
      action.play()

      if (activeAction && activeAction !== action) {
        activeAction.crossFadeTo(action, blendDuration, true)
      } else if (!activeAction) {
        action.fadeIn(blendDuration)
      }
      activeAction = action
    }

    play()

    const onFinished = (event) => {
      if (event.action !== actions[clips[index]]) return
      index += 1
      if (index < clips.length) {
        play()
        return
      }
      onAnimationComplete?.(id)
    }

    mixer.addEventListener('finished', onFinished)

    return () => {
      mixer.removeEventListener('finished', onFinished)
      if (activeAction) activeAction.fadeOut(blendDuration)
    }
  }, [actions, animation, champion, id, mixer, onAnimationComplete, token])

  return (
    <group ref={externalRef} position={initialPosition}>
      <group ref={innerRoot}>
        <primitive object={modelSetup.scene} position={modelSetup.offset} scale={modelSetup.scale} />
      </group>
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.78, 1.04, 48]} />
        <meshBasicMaterial color={ghost ? '#80ded3' : champion.ringColor} transparent opacity={ghost ? 0.55 : 0.33} />
      </mesh>
    </group>
  )
})

export default Champion
