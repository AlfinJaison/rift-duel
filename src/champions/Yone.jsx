import { forwardRef } from 'react'
import { useGLTF } from '@react-three/drei'
import Champion from '../game/Champion.jsx'
import modelUrl from '../../champion_models/yone.glb?url'

const YONE_R_CHARGE_TIME = 1.5
const YONE_R_DASH_DISTANCE = 6
const YONE_R_DASH_SPEED = 36
const YONE_R_HITBOX = { type: 'rectangle', length: YONE_R_DASH_DISTANCE, width: 3 }

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

function castYoneR({ actor, aimX, aimZ, pushAnimation }) {
  const directionX = aimX - actor.x
  const directionZ = aimZ - actor.z
  actor.facing = Math.atan2(directionX, directionZ)
  actor.activeSkill = {
    key: 'r',
    phase: 'charging',
    elapsed: 0,
    directionX: Math.sin(actor.facing),
    directionZ: Math.cos(actor.facing),
    distanceTravelled: 0,
    didHit: false,
  }
  pushAnimation('rCharge')
}

function finishYoneR({ actor, pushAnimation, stopMovement }) {
  actor.activeSkill = null
  stopMovement()
  pushAnimation('idle')
}

function updateYoneR({ actor, target, delta, moveTo, isSkillHit, applySkillHit, pushAnimation, stopMovement }) {
  const action = actor.activeSkill
  if (!action || action.key !== 'r') return

  let dashDelta = delta
  if (action.phase === 'charging') {
    const chargeRemaining = Math.max(0, YONE_R_CHARGE_TIME - action.elapsed)
    if (delta < chargeRemaining) {
      action.elapsed += delta
      return
    }
    action.phase = 'dashing'
    dashDelta = delta - chargeRemaining
    pushAnimation('rDash')
  }

  const distanceRemaining = Math.max(0, YONE_R_DASH_DISTANCE - action.distanceTravelled)
  const distanceThisFrame = Math.min(distanceRemaining, YONE_R_DASH_SPEED * dashDelta)
  if (distanceThisFrame <= 0) return

  const substeps = Math.max(1, Math.ceil(distanceThisFrame / 0.08))
  const stepDistance = distanceThisFrame / substeps
  for (let step = 0; step < substeps; step += 1) {
    const movement = moveTo({
      x: actor.x + action.directionX * stepDistance,
      z: actor.z + action.directionZ * stepDistance,
    })
    action.distanceTravelled += movement.movedDistance

    if (!action.didHit && target.health > 0 && isSkillHit('r', target)) {
      action.didHit = applySkillHit('r', target)
      if (target.health <= 0) {
        finishYoneR({ actor, pushAnimation, stopMovement })
        return
      }
    }

    if (movement.blocked) {
      finishYoneR({ actor, pushAnimation, stopMovement })
      return
    }
    if (movement.movedDistance + 0.01 < stepDistance || action.distanceTravelled >= YONE_R_DASH_DISTANCE - 1e-4) {
      finishYoneR({ actor, pushAnimation, stopMovement })
      return
    }
  }
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
  updateActiveSkill: updateYoneR,
  modelUrl,
  animationDurations: { q: 0.5, w: 0.5, attack: 0.3, attack2: 0.3 },
  animations: {
    idle: ['Idle1_Base'],
    move: ['Run_Base'],
    attack: ['Attack1'],
    attack2: ['Attack2'],
    q: ['Yone_Spell1_A_01.anm', 'Yone_Spell1_A_02.anm'],
    w: ['Spell2'],
    e: ['Spell3_Dash', 'Spell3_BodyIn', 'Spell3_BodyLoop', 'Spell3_Out'],
    r: ['Spell4', 'Spell4_Out'],
    rCharge: ['Spell4'],
    rDash: ['Spell4_Out'],
  },
  skills: {
    q: { name: 'Mortal Steel', label: 'Steel', damage: 18, cooldown: 1.0, color: '#80ded3', tint: '#83d4cf', animation: 'q', hitbox: { type: 'rectangle', length: 3, width: 1 } },
    w: { name: 'Spirit Cleave', label: 'Cleave', damage: 13, cooldown: 1.0, color: '#80aef3', tint: '#75a9ef', animation: 'w', hitbox: { type: 'equilateralTriangle', side: 6 } },
    e: { name: 'Soul Unbound', label: 'Unbound', damage: 17, range: 5.2, cooldown: 6.8, color: '#cf8cff', tint: '#db8bff', animation: 'e', cast: castYoneE },
    r: { name: 'Fate Sealed', label: 'Fate Sealed', damage: 28, cooldown: 10.5, color: '#f5bd74', tint: '#f0bc70', animation: 'rCharge', hitbox: YONE_R_HITBOX, cast: castYoneR },
    attack: { damage: 8, range: 2.25, cooldown: 0.68, color: '#e7e4cd', animation: 'attack' },
  },
}

const Yone = forwardRef(function Yone(props, ref) {
  return <Champion ref={ref} champion={yone} {...props} />
})

useGLTF.preload(modelUrl)

export default Yone
