import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Html } from '@react-three/drei'
import { Plane, Raycaster, Vector2, Vector3 } from 'three'
import Champion from './Champion.jsx'
import Arena from './Arena.jsx'
import CombatEffect from './CombatEffect.jsx'

const ABILITY_KEYS = ['q', 'w', 'e', 'r']
const MAX_HEALTH = 100
const ARENA_BOUNDS = { x: 8.2, z: 4.2 }
const SKILL_DATA = {
  yone: {
    q: { damage: 18, range: 3.6, cooldown: 3.4, color: '#80ded3', animation: 'q' },
    w: { damage: 13, range: 3.1, cooldown: 1.0, color: '#80aef3', animation: 'w' },
    e: { damage: 17, range: 5.2, cooldown: 6.8, color: '#cf8cff', animation: 'e' },
    r: { damage: 28, range: 6.4, cooldown: 10.5, color: '#f5bd74', animation: 'r' },
    attack: { damage: 8, range: 2.25, cooldown: 0.68, color: '#e7e4cd', animation: 'attack' },
  },
  mordekaiser: {
    q: { damage: 20, range: 3.9, cooldown: 3.7, color: '#9a8cf4', animation: 'q' },
    w: { damage: 12, range: 3.2, cooldown: 5.8, color: '#4bd8ba', animation: 'w' },
    e: { damage: 16, range: 5.4, cooldown: 7.2, color: '#8d76e9', animation: 'e' },
    r: { damage: 25, range: 6.5, cooldown: 10.5, color: '#e86787', animation: 'r' },
    attack: { damage: 9, range: 2.45, cooldown: 0.82, color: '#a48cf0', animation: 'attack' },
  },
}

function createActor(id, x) {
  return {
    id,
    x,
    z: 0,
    targetX: null,
    targetZ: null,
    facing: id === 'yone' ? 0 : Math.PI,
    health: MAX_HEALTH,
    cooldowns: { q: 0, w: 0, e: 0, r: 0, attack: 0 },
    animation: 'idle',
    nextAttack: 'attack',
    token: 0,
    aiTimer: 0.8,
  }
}

function createEngine(player) {
  return {
    player,
    actors: {
      yone: createActor('yone', -3.2),
      mordekaiser: createActor('mordekaiser', 3.2),
    },
    winner: null,
    clock: 0,
    snapshotClock: 0,
    effects: [],
    effectId: 0,
    keys: new Set(),
    queued: [],
    nextBotSkill: 1.5,
    aimX: player === 'yone' ? 3.2 : -3.2,
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
  engine.effects.push({
    id: ++engine.effectId,
    type,
    from: [from.x, from.z],
    to: [to.x, to.z],
    color,
    start: engine.clock,
    duration: type === 'r' ? 1.05 : 0.72,
  })
}

function applyHit(engine, attacker, target, skill, type, effectTarget = target) {
  const data = SKILL_DATA[attacker.id][skill]
  const distance = Math.hypot(attacker.x - target.x, attacker.z - target.z)
  if (distance > data.range) return false
  target.health = Math.max(0, target.health - data.damage)
  addEffect(engine, type, attacker, effectTarget, data.color)
  if (target.health <= 0) engine.winner = attacker.id
  return true
}

function castSkill(engine, actor, target, skill) {
  const data = SKILL_DATA[actor.id][skill]
  if (!data || isActionLocked(actor) || actor.cooldowns[skill] > 0 || actor.health <= 0) return
  const aimX = actor.id === engine.player ? engine.aimX : target.x
  const aimZ = actor.id === engine.player ? engine.aimZ : target.z
  const directionX = aimX - actor.x
  const directionZ = aimZ - actor.z
  const aimDistance = Math.hypot(directionX, directionZ)
  const aimDirectionX = aimDistance > 0.001 ? directionX / aimDistance : 0
  const aimDirectionZ = aimDistance > 0.001 ? directionZ / aimDistance : 1
  actor.facing = Math.atan2(directionX, directionZ)
  actor.cooldowns[skill] = data.cooldown
  pushAnimation(actor, data.animation)
  if (skill === 'e') {
    const dx = directionX
    const dz = directionZ
    const distance = Math.hypot(dx, dz) || 1
    const dash = Math.min(1.75, Math.max(0, distance - 1.6))
    actor.x += (dx / distance) * dash
    actor.z += (dz / distance) * dash
    actor.x = Math.max(-ARENA_BOUNDS.x, Math.min(ARENA_BOUNDS.x, actor.x))
    actor.z = Math.max(-ARENA_BOUNDS.z, Math.min(ARENA_BOUNDS.z, actor.z))
  }
  const effectDistance = Math.min(data.range, aimDistance)
  const effectTarget = {
    x: actor.x + aimDirectionX * effectDistance,
    z: actor.z + aimDirectionZ * effectDistance,
  }
  const didHit = applyHit(engine, actor, target, skill, skill, effectTarget)
  if (!didHit) addEffect(engine, skill, actor, effectTarget, data.color)
}

function castAttack(engine, actor, target) {
  const data = SKILL_DATA[actor.id].attack
  if (isActionLocked(actor) || actor.cooldowns.attack > 0 || actor.health <= 0) return
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

function stepEngine(engine, dt, refs, onHud, setEffects) {
  if (!engine) return
  engine.clock += dt
  if (engine.winner) {
    const stillLive = engine.effects.filter((effect) => engine.clock - effect.start < effect.duration)
    if (stillLive.length !== engine.effects.length) {
      engine.effects = stillLive
      setEffects(stillLive.slice())
    }
    return
  }
  const playerActor = engine.actors[engine.player]
  const enemyId = engine.player === 'yone' ? 'mordekaiser' : 'yone'
  const bot = engine.actors[enemyId]
  const keys = engine.keys

  for (const actor of Object.values(engine.actors)) {
    for (const skill of [...ABILITY_KEYS, 'attack']) actor.cooldowns[skill] = Math.max(0, actor.cooldowns[skill] - dt)
  }

  let moveX = 0
  let moveZ = 0
  const playerActionLocked = isActionLocked(playerActor)
  if (!playerActionLocked && playerActor.targetX !== null && playerActor.targetZ !== null) {
    moveX = playerActor.targetX - playerActor.x
    moveZ = playerActor.targetZ - playerActor.z
  }
  const moveLength = Math.hypot(moveX, moveZ)
  if (moveLength > 0.12) {
    moveX /= moveLength
    moveZ /= moveLength
    const speed = 4.25
    playerActor.x += moveX * speed * dt
    playerActor.z += moveZ * speed * dt
    playerActor.x = Math.max(-ARENA_BOUNDS.x, Math.min(ARENA_BOUNDS.x, playerActor.x))
    playerActor.z = Math.max(-ARENA_BOUNDS.z, Math.min(ARENA_BOUNDS.z, playerActor.z))
    if (playerActor.animation === 'idle' || playerActor.animation === 'move') {
      playerActor.facing = Math.atan2(moveX, moveZ)
    }
  } else if (!playerActionLocked && playerActor.targetX !== null) {
    playerActor.targetX = null
    playerActor.targetZ = null
  }
  setLocomotion(engine, playerActor, !playerActionLocked && moveLength > 0.12)

  while (engine.queued.length) {
    const key = engine.queued.shift()
    if (key === ' ') castAttack(engine, playerActor, bot)
    else if (ABILITY_KEYS.includes(key)) castSkill(engine, playerActor, bot, key)
  }

  if (engine.winner) return

  if (engine.player !== 'yone') {
    const dx = playerActor.x - bot.x
    const dz = playerActor.z - bot.z
    const distance = Math.hypot(dx, dz) || 1
    bot.aiTimer -= dt
    if (!isActionLocked(bot)) {
      if (distance > 2.05) {
        const speed = 2.05
        bot.x += (dx / distance) * speed * dt
        bot.z += (dz / distance) * speed * dt
        bot.x = Math.max(-ARENA_BOUNDS.x, Math.min(ARENA_BOUNDS.x, bot.x))
        bot.z = Math.max(-ARENA_BOUNDS.z, Math.min(ARENA_BOUNDS.z, bot.z))
        setLocomotion(engine, bot, true)
      } else {
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
        const candidates = ['q', 'e', 'r'].filter((skill) => bot.cooldowns[skill] <= 0 && distance <= SKILL_DATA[bot.id][skill].range)
        if (candidates.length) castSkill(engine, bot, playerActor, candidates[Math.floor(Math.random() * candidates.length)])
        engine.nextBotSkill = 2.2 + Math.random() * 1.4
      }
    }
  }

  updateActorPositions(engine.actors, refs)
  const liveIds = new Set(engine.effects.filter((effect) => engine.clock - effect.start < effect.duration).map((effect) => effect.id))
  if (liveIds.size !== engine.effects.length) {
    engine.effects = engine.effects.filter((effect) => liveIds.has(effect.id))
    setEffects(engine.effects.slice())
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
        actor.targetX = Math.max(-ARENA_BOUNDS.x, Math.min(ARENA_BOUNDS.x, intersection.current.x))
        actor.targetZ = Math.max(-ARENA_BOUNDS.z, Math.min(ARENA_BOUNDS.z, intersection.current.z))
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
    stepEngine(current, Math.min(delta, 0.04), refs.current, onHud, setEffects)
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
        <Champion
          ref={yoneRef}
          id="yone"
          initialPosition={[-3.2, 0, 0]}
          animation={visuals.yone.animation}
          token={visuals.yone.token}
          onAnimationComplete={handleAnimationComplete}
        />
        <Champion
          ref={mordekaiserRef}
          id="mordekaiser"
          initialPosition={[3.2, 0, 0]}
          animation={visuals.mordekaiser.animation}
          token={visuals.mordekaiser.token}
          onAnimationComplete={handleAnimationComplete}
        />
      </Suspense>
      {effects.map((effect) => <CombatEffect key={effect.id} effect={effect} />)}
    </>
  )
}

export default GameScene
