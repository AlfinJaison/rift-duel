import { forwardRef } from 'react'
import { useGLTF } from '@react-three/drei'
import Champion from '../game/Champion.jsx'
import modelUrl from '../../champion_models/mordekaiser.glb?url'

export const mordekaiser = {
  id: 'mordekaiser',
  name: 'Mordekaiser',
  title: 'The Iron Revenant',
  color: '#9f72ed',
  accent: '#49c9aa',
  ringColor: '#9b78e9',
  targetHeight: 2.75,
  colliderRadius: 0.66,
  spawnPosition: [3.2, 0],
  initialFacing: Math.PI,
  modelUrl,
  animationDurations: { attack: 0.9, attack2: 0.9 },
  animations: {
    idle: ['Idle.anm', 'Battle_Idle'],
    move: ['Walk', 'Run_Homeguard'],
    attack: ['Attack1_Fast'],
    attack2: ['Attack1_Fast'],
    q: ['Spell1'],
    w: ['Spell2_Cast.anm'],
    e: ['Spell3_Cast.anm'],
    r: ['Spell4'],
  },
  skills: {
    q: { name: 'Obliterate', label: 'Obliterate', damage: 20, cooldown: 3.7, color: '#9a8cf4', tint: '#9a8cf4', animation: 'q', hitbox: { type: 'rectangle', length: 4, width: 2 } },
    w: { name: 'Indestructible', label: 'Indestructible', damage: 12, range: 3.2, cooldown: 5.8, color: '#4bd8ba', tint: '#4bd8ba', animation: 'w' },
    e: { name: "Death's Grasp", label: "Death's Grasp", damage: 16, range: 5.4, cooldown: 7.2, color: '#8d76e9', tint: '#8d76e9', animation: 'e', dash: true },
    r: { name: 'Realm of Death', label: 'Realm of Death', damage: 25, range: 6.5, cooldown: 10.5, color: '#e86787', tint: '#e86787', animation: 'r' },
    attack: { damage: 9, range: 2.45, cooldown: 0.82, color: '#a48cf0', animation: 'attack' },
  },
}

const Mordekaiser = forwardRef(function Mordekaiser(props, ref) {
  return <Champion ref={ref} champion={mordekaiser} {...props} />
})

useGLTF.preload(modelUrl)

export default Mordekaiser
