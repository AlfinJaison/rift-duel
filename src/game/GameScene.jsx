import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Html } from '@react-three/drei'
import { Plane, Raycaster, Vector2, Vector3 } from 'three'
import Arena from './Arena.jsx'
import CombatEffect from './CombatEffect.jsx'
import DamageNumber from './DamageNumber.jsx'
import { createHitboxPolygon, getHitboxForwardExtent, isColliderTouchingHitbox } from './hitboxes.js'
import {
  clearActorPath,
  createMovementState,
  moveActorToPosition,
  refreshActorPath,
  setActorPath,
  shouldReplanActorPath,
  walkActorPath,
} from './collision.js'
import { CHAMPIONS } from '../champions/index.js'
import Yone from '../champions/Yone.jsx'
import Mordekaiser from '../champions/Mordekaiser.jsx'

const ABILITY_KEYS = ['q', 'w', 'e', 'r']
const MAX_HEALTH = 100

function createActor(id) {
  const champion = CHAMPIONS[id]
  return {
    id,
    x: champion.spawnPosition[0],
    z: champion.spawnPosition[1],
    ...createMovementState(),
    facing: champion.initialFacing,
    eClone: null,
    eReturnAt: null,
    health: MAX_HEALTH,
    cooldowns: { q: 0, w: 0, e: 0, r: 0, attack: 0 },
    animation: 'idle',
    nextAttack: 'attack',
    token: 0,
    aiTimer: 0.8,
  }
}

function createEngine(player) {
  const opponent = player === 'yone' ? 'mordekaiser' : 'yone'
  return {
    player,
    actors: Object.fromEntries(Object.keys(CHAMPIONS).map((id) => [id, createActor(id)])),
    winner: null,
    clock: 0,
    snapshotClock: 0,
    effects: [],
    effectId: 0,
    damageNumbers: [],
    damageNumberId: 0,
    keys: new Set(),
    queued: [],
    nextBotSkill: 1.5,
    aimX: CHAMPIONS[opponent].spawnPosition[0],
    aimZ: 0,
  }
}

function pushAnimation(actor, name) {
  actor.animation = name
  actor.token += 1
}

function snapshot(engine) {
  const playerActor = engine.actors[engine.player]
  return {
    health: {
      yone: engine.actors.yone.health,
      mordekaiser: engine.actors.mordekaiser.health,
    },
    cooldowns: Object.fromEntries(ABILITY_KEYS.map((key) => [key, Math.max(0, playerActor.cooldowns[key])])),
    winner: engine.winner,
  }
}

function addEffect(engine, type, from, to, color) {
  const hitboxDefinition = CHAMPIONS[from.id]?.skills[type]?.hitbox
  const hitboxPolygon = hitboxDefinition ? createHitboxPolygon(from, from.facing, hitboxDefinition) : null
  engine.effects.push({
    id: ++engine.effectId,
    type,
    from: [from.x, from.z],
    to: [to.x, to.z],
    color,
    start: engine.clock,
    duration: type === 'r' ? 1.05 : hitboxDefinition ? (type === 'q' ? 1.1 : 0.9) : 0.72,
    hitboxPolygon,
  })
}

function addDamageNumber(engine, target, damage) {
  engine.damageNumbers.push({
    id: ++engine.damageNumberId,
    damage,
    position: [target.x, target.z],
    start: engine.clock,
    duration: 0.5,
  })
}

function isSkillHit(actor, target, skill) {
  const data = CHAMPIONS[actor.id].skills[skill]
  const targetRadius = CHAMPIONS[target.id].colliderRadius
  if (data.hitbox) {
    return isColliderTouchingHitbox(actor, target, actor.facing, data.hitbox, targetRadius)
  }
  return Math.hypot(actor.x - target.x, actor.z - target.z) <= data.range + targetRadius
}

function applyHit(engine, attacker, target, skill, type, effectTarget = target) {
  const data = CHAMPIONS[attacker.id].skills[skill]
  if (!isSkillHit(attacker, target, skill)) return false
  target.health = Math.max(0, target.health - data.damage)
  addDamageNumber(engine, target, data.damage)
  addEffect(engine, type, attacker, effectTarget, data.color)
  if (target.health <= 0) engine.winner = attacker.id
  return true
}

function castSkill(engine, actor, target, skill) {
  const data = CHAMPIONS[actor.id].skills[skill]
  if (!data || isActionLocked(actor) || actor.cooldowns[skill] > 0 || actor.health <= 0) return
  const aimX = actor.id === engine.player ? engine.aimX : target.x
  const aimZ = actor.id === engine.player ? engine.aimZ : target.z
  const directionX = aimX - actor.x
  const directionZ = aimZ - actor.z
  const aimDistance = Math.hypot(directionX, directionZ)
  const aimDirectionX = aimDistance > 0.001 ? directionX / aimDistance : 0
  const aimDirectionZ = aimDistance > 0.001 ? directionZ / aimDistance : 1
  actor.cooldowns[skill] = data.cooldown
  if (data.cast) {
    data.cast({
      actor,
      target,
      engine,
      aimX,
      aimZ,
      moveTo: (position) => moveActorToPosition(engine, actor, position),
    })
    refreshActorPath(engine, actor)
    return
  }

  actor.facing = Math.atan2(directionX, directionZ)
  pushAnimation(actor, data.animation)
  if (data.dash) {
    const dx = directionX
    const dz = directionZ
    const distance = Math.hypot(dx, dz) || 1
    const dash = Math.min(1.75, Math.max(0, distance - 1.6))
    moveActorToPosition(engine, actor, {
      x: actor.x + (dx / distance) * dash,
      z: actor.z + (dz / distance) * dash,
    })
    refreshActorPath(engine, actor)
  }
  const skillRange = data.hitbox ? getHitboxForwardExtent(data.hitbox) : data.range
  const effectDistance = Math.min(skillRange, aimDistance)
  const effectTarget = {
    x: actor.x + aimDirectionX * effectDistance,
    z: actor.z + aimDirectionZ * effectDistance,
  }
  const didHit = applyHit(engine, actor, target, skill, skill, effectTarget)
  if (!didHit) addEffect(engine, skill, actor, effectTarget, data.color)
}

function castAttack(engine, actor, target) {
  const data = CHAMPIONS[actor.id].skills.attack
  if (isActionLocked(actor) || actor.cooldowns.attack > 0 || actor.health <= 0) return
  const distance = Math.hypot(target.x - actor.x, target.z - actor.z)
  if (distance > data.range + CHAMPIONS[target.id].colliderRadius) return
  actor.facing = Math.atan2(target.x - actor.x, target.z - actor.z)
  actor.cooldowns.attack = data.cooldown
  pushAnimation(actor, actor.nextAttack)
  actor.nextAttack = actor.nextAttack === 'attack' ? 'attack2' : 'attack'
  applyHit(engine, actor, target, 'attack', 'attack')
}

function updateActorPositions(actors, refs) {
  for (const id of ['yone', 'mordekaiser']) {
    const node = refs[id].current
    const actor = actors[id]
    if (!node) continue
    node.position.set(actor.x, 0, actor.z)
    const opponent = actors[id === 'yone' ? 'mordekaiser' : 'yone']
    node.rotation.y = actor.facing ?? Math.atan2(opponent.x - actor.x, opponent.z - actor.z)
  }
}

function isActionLocked(actor) {
  return actor.animation !== 'idle' && actor.animation !== 'move'
}

function setLocomotion(engine, actor, moving) {
  if (isActionLocked(actor)) return
  const next = moving ? 'move' : 'idle'
  if (actor.animation !== next) pushAnimation(actor, next)
}

function stepEngine(engine, dt, refs, onHud, setEffects, setDamageNumbers) {
  if (!engine) return
  engine.clock += dt
  if (engine.winner) {
    const stillLive = engine.effects.filter((effect) => engine.clock - effect.start < effect.duration)
    if (stillLive.length !== engine.effects.length) {
      engine.effects = stillLive
      setEffects(stillLive.slice())
    }
    const liveDamageNumbers = engine.damageNumbers.filter((item) => engine.clock - item.start < item.duration)
    if (liveDamageNumbers.length !== engine.damageNumbers.length) {
      engine.damageNumbers = liveDamageNumbers
      setDamageNumbers(liveDamageNumbers.slice())
    }
    return
  }
  for (const actor of Object.values(engine.actors)) {
    if (actor.eReturnAt !== null && engine.clock >= actor.eReturnAt) {
      CHAMPIONS[actor.id].recallFromE?.(actor)
      actor.eClone = null
      actor.eReturnAt = null
      clearActorPath(actor)
    }
  }
  let publishedEffectId = engine.effectId
  let publishedDamageNumberId = engine.damageNumberId
  const playerActor = engine.actors[engine.player]
  const enemyId = engine.player === 'yone' ? 'mordekaiser' : 'yone'
  const bot = engine.actors[enemyId]
  const keys = engine.keys

  for (const actor of Object.values(engine.actors)) {
    for (const skill of [...ABILITY_KEYS, 'attack']) actor.cooldowns[skill] = Math.max(0, actor.cooldowns[skill] - dt)
  }

  const playerActionLocked = isActionLocked(playerActor)
  const playerMoving = !playerActionLocked && walkActorPath(engine, playerActor, 4.25, dt)
  setLocomotion(engine, playerActor, playerMoving)

  while (engine.queued.length) {
    const key = engine.queued.shift()
    if (key === ' ') castAttack(engine, playerActor, bot)
    else if (ABILITY_KEYS.includes(key)) castSkill(engine, playerActor, bot, key)
  }

  if (engine.effectId !== publishedEffectId) {
    setEffects(engine.effects.slice())
    publishedEffectId = engine.effectId
  }
  if (engine.damageNumberId !== publishedDamageNumberId) {
    setDamageNumbers(engine.damageNumbers.slice())
    publishedDamageNumberId = engine.damageNumberId
  }
  if (engine.winner) return

  if (engine.player !== 'yone') {
    const dx = playerActor.x - bot.x
    const dz = playerActor.z - bot.z
    const distance = Math.hypot(dx, dz) || 1
    bot.aiTimer -= dt
    if (!isActionLocked(bot)) {
      if (distance > 2.05) {
        const desiredRange = 1.75
        const destination = {
          x: playerActor.x - (dx / distance) * desiredRange,
          z: playerActor.z - (dz / distance) * desiredRange,
        }
        if (shouldReplanActorPath(bot, destination)) setActorPath(engine, bot, destination)
        const botMoving = walkActorPath(engine, bot, 2.05, dt)
        setLocomotion(engine, bot, botMoving)
      } else {
        clearActorPath(bot)
        setLocomotion(engine, bot, false)
        if (bot.aiTimer <= 0) {
          castAttack(engine, bot, playerActor)
          bot.aiTimer = 1.05 + Math.random() * 0.35
        }
      }
    }

    if (!isActionLocked(bot)) {
      engine.nextBotSkill -= dt
      if (engine.nextBotSkill <= 0 && distance < 6.2) {
        const candidates = ['q', 'e', 'r'].filter((skill) => bot.cooldowns[skill] <= 0 && isSkillHit(bot, playerActor, skill))
        if (candidates.length) castSkill(engine, bot, playerActor, candidates[Math.floor(Math.random() * candidates.length)])
        engine.nextBotSkill = 2.2 + Math.random() * 1.4
      }
    }
  }

  if (engine.effectId !== publishedEffectId) setEffects(engine.effects.slice())
  if (engine.damageNumberId !== publishedDamageNumberId) setDamageNumbers(engine.damageNumbers.slice())

  updateActorPositions(engine.actors, refs)
  const liveIds = new Set(engine.effects.filter((effect) => engine.clock - effect.start < effect.duration).map((effect) => effect.id))
  if (liveIds.size !== engine.effects.length) {
    engine.effects = engine.effects.filter((effect) => liveIds.has(effect.id))
    setEffects(engine.effects.slice())
  }
  const liveDamageNumberIds = new Set(engine.damageNumbers
    .filter((item) => engine.clock - item.start < item.duration)
    .map((item) => item.id))
  if (liveDamageNumberIds.size !== engine.damageNumbers.length) {
    engine.damageNumbers = engine.damageNumbers.filter((item) => liveDamageNumberIds.has(item.id))
    setDamageNumbers(engine.damageNumbers.slice())
  }
  engine.snapshotClock += dt
  if (engine.snapshotClock >= 0.1) {
    engine.snapshotClock = 0
    onHud(snapshot(engine))
  }
}

function RightClickMovement({ engine }) {
  const { camera, gl } = useThree()
  const raycaster = useRef(new Raycaster())
  const pointer = useRef(new Vector2())
  const ground = useRef(new Plane(new Vector3(0, 1, 0), 0))
  const intersection = useRef(new Vector3())
  const rightHeld = useRef(false)

  useEffect(() => {
    const updatePointerTarget = (event, moveActor) => {
      const rect = gl.domElement.getBoundingClientRect()
      pointer.current.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      )
      raycaster.current.setFromCamera(pointer.current, camera)
      if (!raycaster.current.ray.intersectPlane(ground.current, intersection.current)) return
      const current = engine.current
      const actor = current?.actors[current.player]
      if (!actor) return
      current.aimX = intersection.current.x
      current.aimZ = intersection.current.z
      if (moveActor) {
        setActorPath(current, actor, { x: intersection.current.x, z: intersection.current.z })
      }
    }

    const handlePointerDown = (event) => {
      if (event.button !== 2) return
      event.preventDefault()
      rightHeld.current = true
      updatePointerTarget(event, true)
    }
    const handlePointerMove = (event) => {
      updatePointerTarget(event, rightHeld.current)
    }
    const handlePointerUp = (event) => {
      if (event.button === 2) rightHeld.current = false
    }
    const handleContextMenu = (event) => event.preventDefault()

    gl.domElement.addEventListener('pointerdown', handlePointerDown)
    gl.domElement.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    gl.domElement.addEventListener('contextmenu', handleContextMenu)
    return () => {
      gl.domElement.removeEventListener('pointerdown', handlePointerDown)
      gl.domElement.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      gl.domElement.removeEventListener('contextmenu', handleContextMenu)
    }
  }, [camera, gl, engine])

  return null
}

function CameraRig({ engine }) {
  const { camera } = useThree()
  const lookTarget = useRef(new Vector3(0, 0.8, 0))

  useFrame((_, delta) => {
    const actor = engine.current?.actors[engine.current.player]
    if (!actor) return

    const smoothing = 1 - Math.exp(-delta * 7)
    const desiredCameraPosition = new Vector3(actor.x, 14.5, actor.z + 8)
    camera.position.lerp(desiredCameraPosition, smoothing)

    lookTarget.current.lerp(new Vector3(actor.x, 0.8, actor.z), smoothing)
    camera.lookAt(lookTarget.current)
  })

  return null
}

function KeyboardInput({ engine }) {
  useEffect(() => {
    const handleDown = (event) => {
      const key = event.key.toLowerCase()
      if ([' ', 'q', 'w', 'e', 'r'].includes(key)) event.preventDefault()
      if (event.repeat) return
      if ([' ', 'q', 'w', 'e', 'r'].includes(key) && engine.current) engine.current.queued.push(key)
    }
    const handleUp = (event) => engine.current?.keys.delete(event.key.toLowerCase())
    window.addEventListener('keydown', handleDown)
    window.addEventListener('keyup', handleUp)
    return () => {
      window.removeEventListener('keydown', handleDown)
      window.removeEventListener('keyup', handleUp)
    }
  }, [engine])
  return null
}

function SceneLighting() {
  return (
    <>
      <ambientLight intensity={0.7} color="#cad9cf" />
      <hemisphereLight args={['#bfd6d0', '#1b2520', 1.3]} />
      <directionalLight
        castShadow
        position={[-6, 12, 7]}
        intensity={2.5}
        color="#ffdfbd"
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-13}
        shadow-camera-right={13}
        shadow-camera-top={11}
        shadow-camera-bottom={-11}
        shadow-bias={-0.0002}
      />
      <pointLight position={[0, 4, 0]} color="#60d4c4" intensity={24} distance={17} />
    </>
  )
}

function GameScene({ player, round, onHud }) {
  const yoneRef = useRef(null)
  const mordekaiserRef = useRef(null)
  const refs = useRef({ yone: yoneRef, mordekaiser: mordekaiserRef })
  const engine = useRef(createEngine(player))
  const [effects, setEffects] = useState([])
  const [damageNumbers, setDamageNumbers] = useState([])
  const [yoneClonePosition, setYoneClonePosition] = useState(null)
  const yoneCloneRef = useRef(null)
  const [visuals, setVisuals] = useState({
    yone: { animation: 'idle', token: 0 },
    mordekaiser: { animation: 'idle', token: 0 },
  })
  const handleAnimationComplete = useCallback((id) => {
    const actor = engine.current.actors[id]
    if (!actor) return
    pushAnimation(actor, 'idle')
    setVisuals((previous) => ({
      ...previous,
      [id]: { animation: 'idle', token: actor.token },
    }))
  }, [])

  useEffect(() => {
    engine.current = createEngine(player)
    setEffects([])
    setDamageNumbers([])
    yoneCloneRef.current = null
    setYoneClonePosition(null)
    setVisuals({
      yone: { animation: 'idle', token: 0 },
      mordekaiser: { animation: 'idle', token: 0 },
    })
    onHud(snapshot(engine.current))
  }, [player, round, onHud])

  useFrame((_, delta) => {
    const current = engine.current
    const before = {
      yone: `${current.actors.yone.animation}:${current.actors.yone.token}`,
      mordekaiser: `${current.actors.mordekaiser.animation}:${current.actors.mordekaiser.token}`,
    }
    stepEngine(current, Math.min(delta, 0.04), refs.current, onHud, setEffects, setDamageNumbers)
    const clone = current.actors.yone.eClone
    if (clone !== yoneCloneRef.current) {
      yoneCloneRef.current = clone
      setYoneClonePosition(clone ? [clone.x, clone.z] : null)
    }
    const next = {
      yone: current.actors.yone,
      mordekaiser: current.actors.mordekaiser,
    }
    if (`${next.yone.animation}:${next.yone.token}` !== before.yone || `${next.mordekaiser.animation}:${next.mordekaiser.token}` !== before.mordekaiser) {
      setVisuals({
        yone: { animation: next.yone.animation, token: next.yone.token },
        mordekaiser: { animation: next.mordekaiser.animation, token: next.mordekaiser.token },
      })
      if (current.winner) onHud(snapshot(current))
    }
  })

  return (
    <>
      <RightClickMovement engine={engine} />
      <CameraRig engine={engine} />
      <KeyboardInput engine={engine} />
      <SceneLighting />
      <Arena />
      <ContactShadows position={[0, 0.015, 0]} opacity={0.33} scale={24} blur={2.4} far={7} />
      <Suspense fallback={<Html center className="loading-note">Loading champion models...</Html>}>
        <Yone
          ref={yoneRef}
          initialPosition={[CHAMPIONS.yone.spawnPosition[0], 0, CHAMPIONS.yone.spawnPosition[1]]}
          animation={visuals.yone.animation}
          token={visuals.yone.token}
          onAnimationComplete={handleAnimationComplete}
          ghost={Boolean(yoneClonePosition)}
        />
        <Mordekaiser
          ref={mordekaiserRef}
          initialPosition={[CHAMPIONS.mordekaiser.spawnPosition[0], 0, CHAMPIONS.mordekaiser.spawnPosition[1]]}
          animation={visuals.mordekaiser.animation}
          token={visuals.mordekaiser.token}
          onAnimationComplete={handleAnimationComplete}
        />
        {yoneClonePosition && (
          <Yone
            key={`${yoneClonePosition[0]}:${yoneClonePosition[1]}`}
            initialPosition={[yoneClonePosition[0], 0, yoneClonePosition[1]]}
            animation="idle"
            token={0}
          />
        )}
      </Suspense>
      {effects.map((effect) => <CombatEffect key={effect.id} effect={effect} />)}
      {damageNumbers.map((item) => (
        <DamageNumber key={item.id} damage={item.damage} position={item.position} />
      ))}
    </>
  )
}

export default GameScene
