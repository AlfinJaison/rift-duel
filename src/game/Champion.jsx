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
    move: ['Run_Base', 'Yone_Run01', 'Run_Fast'],
    attack: ['Attack1', 'Attack2', 'Attack3', 'Attack4', 'Yone_Attacks_Fast01.anm'],
    q: ['Spell1C_In', 'Spell1C_Out','Spell1C_ToIdle'],
    w: ['Spell2', 'Spell2_ToIdle'],
    e: ['Spell3_Dash', 'Spell3_BodyIn', 'Spell3_BodyLoop', 'Spell3_Out'],
    r: ['Spell4', 'Spell4_Out', 'Spell4_Out_Moving'],
    hit: ['Idle1_Base'],
  },
  mordekaiser: {
    idle: ['Idle.anm', 'Battle_Idle'],
    move: ['Walk', 'Run_Homeguard'],
    attack: ['Attack1_Fast', 'AutoAttack1.anm', 'Attack1'],
    q: ['Spell1'],
    w: ['Spell2_Cast.anm', 'Spell2_Consume_Shield.anm'],
    e: ['Spell3_Cast.anm', 'Spell3_Cast_Walk.anm'],
    r: ['Spell4', 'Spell4_To_Idle'],
    hit: ['Battle_Idle'],
  },
}

const Champion = forwardRef(function Champion({ id, initialPosition, animation, token }, externalRef) {
  const innerRoot = useRef(null)
  const { scene, animations } = useGLTF(MODEL_URLS[id])
  const modelSetup = useMemo(() => {
    const clone = cloneSkinned(scene)
    clone.traverse((object) => {
      if (object.isMesh) {
        object.castShadow = true
        object.receiveShadow = true
        const materials = Array.isArray(object.material) ? object.material : [object.material]
        for (const material of materials) if (material) material.side = DoubleSide
      }
    })
    clone.updateMatrixWorld(true)
    const bounds = new Box3().setFromObject(clone)
    const size = bounds.getSize(new Vector3())
    const center = bounds.getCenter(new Vector3())
    const scale = TARGET_HEIGHT[id] / Math.max(0.01, size.y)
    return {
      scene: clone,
      scale,
      offset: [-center.x * scale, -bounds.min.y * scale, -center.z * scale],
    }
  }, [id, scene])
  const { actions, mixer } = useAnimations(animations, innerRoot)

  useEffect(() => {
    const clips = ANIMATION_MAP[id][animation] || ANIMATION_MAP[id].idle
    let index = 0

    const play = () => {
      const action = actions[clips[index]]

      if (animation === 'idle' || animation === 'move') {
        action.reset()
        action.setLoop(LoopRepeat, Infinity)
        action.play()
        return
      }

      action.reset()
      action.setLoop(LoopOnce, 1)
      action.play()
    }

    play()

    const onFinished = (event) => {
      if (event.action !== actions[clips[index]]) return
      index += 1
      if (index < clips.length) play()
    }

    mixer.addEventListener('finished', onFinished)
  }, [actions, animation, id, mixer])

  return (
    <group ref={externalRef} position={initialPosition}>
      <group ref={innerRoot}>
        <primitive object={modelSetup.scene} position={modelSetup.offset} scale={modelSetup.scale} />
      </group>
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.78, 1.04, 48]} />
        <meshBasicMaterial color={id === 'yone' ? '#d85a69' : '#9b78e9'} transparent opacity={0.33} />
      </mesh>
    </group>
  )
})

useGLTF.preload(MODEL_URLS.yone)
useGLTF.preload(MODEL_URLS.mordekaiser)

export default Champion
