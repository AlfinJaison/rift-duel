import { forwardRef, useEffect, useMemo, useRef } from 'react'
import { useAnimations, useGLTF } from '@react-three/drei'
import { Box3, DoubleSide, LoopOnce, LoopRepeat, Vector3 } from 'three'
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js'
import yoneUrl from '../../champion_models/yone.glb?url'
import mordekaiserUrl from '../../champion_models/mordekaiser.glb?url'

const MODEL_URLS = { yone: yoneUrl, mordekaiser: mordekaiserUrl }
const TARGET_HEIGHT = { yone: 2.15, mordekaiser: 2.75 }
const ANIMATION_MAP = {
  yone: {
    idle: ['Idle1_Base'],
    move: ['Run_Base'],// 'Yone_Run01', 'Run_Fast'],
    attack: ['Attack1'],// 'Attack2', 'Attack3', 'Attack4', 'Yone_Attacks_Fast01.anm'],
    attack2: ['Attack2'],
    q: ['Yone_Spell1_A_01.anm', 'Yone_Spell1_A_02.anm'],// 'Spell1C_ToIdle'],
    w: ['Spell2'],// 'Spell2_ToIdle'],
    e: ['Spell3_Dash', 'Spell3_BodyIn', 'Spell3_BodyLoop', 'Spell3_Out'],
    r: ['Spell4', 'Spell4_Out'],// 'Spell4_Out_Moving'],
  },
  mordekaiser: {
    idle: ['Idle.anm', 'Battle_Idle'],
    move: ['Walk', 'Run_Homeguard'],
    attack: ['Attack1_Fast', 'AutoAttack1.anm', 'Attack1'],
    attack2: ['Attack2_Fast', 'AutoAttack2.anm', 'Attack2'],
    q: ['Spell1'],
    w: ['Spell2_Cast.anm', 'Spell2_Consume_Shield.anm'],
    e: ['Spell3_Cast.anm', 'Spell3_Cast_Walk.anm'],
    r: ['Spell4', 'Spell4_To_Idle'],
  },
}

const Champion = forwardRef(function Champion({ id, initialPosition, animation, token, onAnimationComplete, ghost = false }, externalRef) {
  const innerRoot = useRef(null)
  const { scene, animations } = useGLTF(MODEL_URLS[id])
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
    const scale = TARGET_HEIGHT[id] / Math.max(0.01, size.y)
    const groundMarker = clone.getObjectByName('Buffbone_Glb_Ground_Loc')
    const groundPosition = groundMarker?.getWorldPosition(new Vector3()) || center
    return {
      scene: clone,
      scale,
      offset: [-groundPosition.x * scale, -bounds.min.y * scale, -groundPosition.z * scale],
      meshes,
      materialStates,
    }
  }, [id, scene])
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
    const clips = ANIMATION_MAP[id][animation] || ANIMATION_MAP[id].idle
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
  }, [actions, animation, id, mixer, onAnimationComplete, token])

  return (
    <group ref={externalRef} position={initialPosition}>
      <group ref={innerRoot}>
        <primitive object={modelSetup.scene} position={modelSetup.offset} scale={modelSetup.scale} />
      </group>
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.78, 1.04, 48]} />
        <meshBasicMaterial color={ghost ? '#80ded3' : id === 'yone' ? '#d85a69' : '#9b78e9'} transparent opacity={ghost ? 0.55 : 0.33} />
      </mesh>
    </group>
  )
})

useGLTF.preload(MODEL_URLS.yone)
useGLTF.preload(MODEL_URLS.mordekaiser)

export default Champion
