import { forwardRef } from 'react'
import { useGLTF } from '@react-three/drei'
import { DoubleSide } from 'three'
import Champion from '../game/Champion.jsx'
import modelUrl from '../../champion_models/mordekaiser.glb?url'

const MORDEKAISER_Q_DELAY = 0.8
const MORDEKAISER_Q_LENGTH = 4
const MORDEKAISER_Q_WIDTH = 2
const MORDEKAISER_Q_EDGES = new Float32Array([
  -MORDEKAISER_Q_WIDTH / 2, 0, 0, MORDEKAISER_Q_WIDTH / 2, 0, 0,
  MORDEKAISER_Q_WIDTH / 2, 0, 0, MORDEKAISER_Q_WIDTH / 2, MORDEKAISER_Q_LENGTH, 0,
  MORDEKAISER_Q_WIDTH / 2, MORDEKAISER_Q_LENGTH, 0, -MORDEKAISER_Q_WIDTH / 2, MORDEKAISER_Q_LENGTH, 0,
  -MORDEKAISER_Q_WIDTH / 2, MORDEKAISER_Q_LENGTH, 0, -MORDEKAISER_Q_WIDTH / 2, 0, 0,
])

function MordekaiserQHitbox() {
  return (
    <group position={[0, 0.07, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <mesh position={[0, MORDEKAISER_Q_LENGTH / 2, 0]}>
        <planeGeometry args={[MORDEKAISER_Q_WIDTH, MORDEKAISER_Q_LENGTH]} />
        <meshBasicMaterial color="#9a8cf4" transparent opacity={0.14} depthWrite={false} depthTest={false} side={DoubleSide} toneMapped={false} />
      </mesh>
      <lineSegments position={[0, 0, -0.02]}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[MORDEKAISER_Q_EDGES, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color="#9a8cf4" transparent opacity={0.95} depthWrite={false} depthTest={false} toneMapped={false} />
      </lineSegments>
    </group>
  )
}

function castMordekaiserQ({ actor, aimX, aimZ, pushAnimation }) {
  actor.facing = Math.atan2(aimX - actor.x, aimZ - actor.z)
  actor.activeSkill = { key: 'q', elapsed: 0 }
  pushAnimation('q')
}

function updateMordekaiserQ({ actor, target, delta, isSkillHit, applySkillHit, pushAnimation, stopMovement }) {
  const action = actor.activeSkill
  if (!action || action.key !== 'q') return

  action.elapsed += delta
  if (action.elapsed < MORDEKAISER_Q_DELAY) return

  if (target.health > 0 && isSkillHit('q', target)) applySkillHit('q', target)
  actor.activeSkill = null
  stopMovement()
  pushAnimation('idle')
}

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
  updateActiveSkill: updateMordekaiserQ,
  modelUrl,
  animationDurations: { q: 0.9, attack: 0.9, attack2: 0.9 },
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
    q: { name: 'Obliterate', label: 'Obliterate', damage: 20, cooldown: 3.7, color: '#9a8cf4', tint: '#9a8cf4', animation: 'q', hitbox: { type: 'rectangle', length: MORDEKAISER_Q_LENGTH, width: MORDEKAISER_Q_WIDTH }, cast: castMordekaiserQ },
    w: { name: 'Indestructible', label: 'Indestructible', damage: 12, range: 3.2, cooldown: 5.8, color: '#4bd8ba', tint: '#4bd8ba', animation: 'w' },
    e: { name: "Death's Grasp", label: "Death's Grasp", damage: 16, range: 5.4, cooldown: 7.2, color: '#8d76e9', tint: '#8d76e9', animation: 'e', dash: true },
    r: { name: 'Realm of Death', label: 'Realm of Death', damage: 25, range: 6.5, cooldown: 10.5, color: '#e86787', tint: '#e86787', animation: 'r' },
    attack: { damage: 9, range: 2.45, cooldown: 0.82, color: '#a48cf0', animation: 'attack' },
  },
}

const Mordekaiser = forwardRef(function Mordekaiser({ initialPosition, animation, ...props }, ref) {
  return (
    <group ref={ref} position={initialPosition}>
      <Champion champion={mordekaiser} initialPosition={[0, 0, 0]} animation={animation} {...props} />
      {animation === 'q' && <MordekaiserQHitbox />}
    </group>
  )
})

useGLTF.preload(modelUrl)

export default Mordekaiser
