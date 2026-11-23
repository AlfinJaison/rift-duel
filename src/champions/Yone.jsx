import { forwardRef } from 'react'
import { useGLTF } from '@react-three/drei'
import Champion from '../game/Champion.jsx'
import modelUrl from '../../champion_models/yone.glb?url'

function castYoneE({ actor, engine, aimX, aimZ, moveTo }) {
  const directionX = aimX - actor.x
  const directionZ = aimZ - actor.z
  const aimDistance = Math.hypot(directionX, directionZ)
  const dashX = aimDistance > 0.001 ? directionX / aimDistance : Math.sin(actor.facing)
  const dashZ = aimDistance > 0.001 ? directionZ / aimDistance : Math.cos(actor.facing)

  actor.eClone = { x: actor.x, z: actor.z }
  actor.eReturnAt = engine.clock + 4
  actor.facing = Math.atan2(dashX, dashZ)
  moveTo({ x: actor.x + dashX * 3, z: actor.z + dashZ * 3 })
}

function recallYoneE(actor) {
  if (!actor.eClone) return
  actor.x = actor.eClone.x
  actor.z = actor.eClone.z
}

export const yone = {
  id: 'yone',
  name: 'Yone',
  title: 'The Unforgotten',
  color: '#dc5362',
  accent: '#f29c67',
  ringColor: '#d85a69',
  targetHeight: 2.15,
  colliderRadius: 0.52,
  spawnPosition: [-3.2, 0],
  initialFacing: 0,
  recallFromE: recallYoneE,
  modelUrl,
  animations: {
    idle: ['Idle1_Base'],
    move: ['Run_Base'],
    attack: ['Attack1'],
    attack2: ['Attack2'],
    q: ['Yone_Spell1_A_01.anm', 'Yone_Spell1_A_02.anm'],
    w: ['Spell2'],
    e: ['Spell3_Dash', 'Spell3_BodyIn', 'Spell3_BodyLoop', 'Spell3_Out'],
    r: ['Spell4', 'Spell4_Out'],
  },
  skills: {
    q: { name: 'Mortal Steel', label: 'Steel', damage: 18, cooldown: 1.0, color: '#80ded3', tint: '#83d4cf', animation: 'q', hitbox: { type: 'rectangle', length: 3, width: 1 } },
    w: { name: 'Spirit Cleave', label: 'Cleave', damage: 13, cooldown: 1.0, color: '#80aef3', tint: '#75a9ef', animation: 'w', hitbox: { type: 'equilateralTriangle', side: 6 } },
    e: { name: 'Soul Unbound', label: 'Unbound', damage: 17, range: 5.2, cooldown: 6.8, color: '#cf8cff', tint: '#db8bff', animation: 'e', cast: castYoneE },
    r: { name: 'Fate Sealed', label: 'Fate Sealed', damage: 28, range: 6.4, cooldown: 10.5, color: '#f5bd74', tint: '#f0bc70', animation: 'r' },
    attack: { damage: 8, range: 2.25, cooldown: 0.68, color: '#e7e4cd', animation: 'attack' },
  },
}

const Yone = forwardRef(function Yone(props, ref) {
  return <Champion ref={ref} champion={yone} {...props} />
})

useGLTF.preload(modelUrl)

export default Yone
