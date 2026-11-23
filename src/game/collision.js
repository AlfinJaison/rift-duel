import { CHAMPIONS } from '../champions/index.js'
import { findShortestPath } from './navigation.js'

const ARENA_BOUNDS = { x: 8.2, z: 4.2 }

export const ARENA_ROCKS = [
  [-9.5, -3.7, 0.75], [-8.6, 2.8, 0.58], [-5.6, -6.4, 0.4], [-3.8, 6.1, 0.62],
  [4.8, -6.6, 0.54], [7.2, 3.7, 0.72], [9.5, -2.3, 0.5], [2.3, 6.1, 0.38],
]

const ARENA_COLLIDERS = [
  { x: 0, z: 0, radius: 2.05 },
  ...ARENA_ROCKS.map(([x, z, scale]) => ({ x, z, radius: scale * 0.78 })),
]

function getActorRadius(actor) {
  return CHAMPIONS[actor.id].colliderRadius
}

export function createMovementState() {
  return {
    targetX: null,
    targetZ: null,
    routeGoal: null,
    path: [],
    pathIndex: 0,
    repathTimer: 0,
  }
}

function getActorBounds(actor) {
  const radius = getActorRadius(actor)
  return {
    minX: -ARENA_BOUNDS.x + radius,
    maxX: ARENA_BOUNDS.x - radius,
    minZ: -ARENA_BOUNDS.z + radius,
    maxZ: ARENA_BOUNDS.z - radius,
  }
}

function getNavigationObstacles(engine, actor) {
  return [
    ...ARENA_COLLIDERS,
    ...Object.values(engine.actors)
      .filter((other) => other !== actor && other.health > 0)
      .flatMap((other) => [
        { x: other.x, z: other.z, radius: getActorRadius(other) },
        ...(other.eClone ? [{ x: other.eClone.x, z: other.eClone.z, radius: getActorRadius(other) }] : []),
      ]),
  ]
}

export function setActorPath(engine, actor, destination) {
  const route = findShortestPath(
    { x: actor.x, z: actor.z },
    destination,
    getNavigationObstacles(engine, actor),
    getActorBounds(actor),
    getActorRadius(actor),
  )
  actor.path = route ? route.slice(1) : []
  actor.pathIndex = 0
  actor.routeGoal = { x: destination.x, z: destination.z }
  actor.targetX = route ? route[route.length - 1].x : null
  actor.targetZ = route ? route[route.length - 1].z : null
  actor.repathTimer = 0.25
  return Boolean(route)
}

export function refreshActorPath(engine, actor) {
  return actor.routeGoal ? setActorPath(engine, actor, actor.routeGoal) : false
}

export function shouldReplanActorPath(actor, destination, threshold = 0.35) {
  return !actor.routeGoal
    || Math.hypot(destination.x - actor.routeGoal.x, destination.z - actor.routeGoal.z) > threshold
    || actor.repathTimer <= 0
}

export function clearActorPath(actor) {
  actor.targetX = null
  actor.targetZ = null
  actor.routeGoal = null
  actor.path = []
  actor.pathIndex = 0
  actor.repathTimer = 0
}

function getPhysicalObstacles(engine, actor) {
  return [
    ...ARENA_COLLIDERS,
    ...Object.values(engine.actors)
      .filter((other) => other !== actor && other.health > 0)
      .flatMap((other) => [
        { x: other.x, z: other.z, radius: getActorRadius(other) },
        ...(other.eClone ? [{ x: other.eClone.x, z: other.eClone.z, radius: getActorRadius(other) }] : []),
      ]),
  ]
}

function segmentCircleEntry(start, end, circle, radius) {
  const dx = end.x - start.x
  const dz = end.z - start.z
  const fx = start.x - circle.x
  const fz = start.z - circle.z
  const a = dx * dx + dz * dz
  if (a < 1e-12) return null
  const c = fx * fx + fz * fz - radius * radius
  if (c < -1e-6) return 0
  const b = 2 * (fx * dx + fz * dz)
  if (Math.abs(c) <= 1e-6 && b >= 0) return null
  const discriminant = b * b - 4 * a * c
  if (discriminant < 0) return null
  const entry = (-b - Math.sqrt(discriminant)) / (2 * a)
  return entry >= 0 && entry <= 1 ? entry : null
}

export function moveActorToPosition(engine, actor, destination) {
  const start = { x: actor.x, z: actor.z }
  const bounds = getActorBounds(actor)
  const desired = {
    x: Math.max(bounds.minX, Math.min(bounds.maxX, destination.x)),
    z: Math.max(bounds.minZ, Math.min(bounds.maxZ, destination.z)),
  }
  const obstacles = getPhysicalObstacles(engine, actor)
  let earliestEntry = 1
  let collided = false
  for (const obstacle of obstacles) {
    const entry = segmentCircleEntry(start, desired, obstacle, getActorRadius(actor) + obstacle.radius)
    if (entry !== null && entry < earliestEntry) {
      earliestEntry = entry
      collided = true
    }
  }

  let next = desired
  if (collided) {
    const distance = Math.hypot(desired.x - start.x, desired.z - start.z)
    const safeEntry = Math.max(0, earliestEntry - (distance > 0 ? 0.002 / distance : 0))
    next = { x: start.x + (desired.x - start.x) * safeEntry, z: start.z + (desired.z - start.z) * safeEntry }
  }

  for (let pass = 0; pass < obstacles.length + 1; pass += 1) {
    let separated = false
    for (const obstacle of obstacles) {
      const minimumDistance = getActorRadius(actor) + obstacle.radius + 1e-3
      const dx = next.x - obstacle.x
      const dz = next.z - obstacle.z
      const distance = Math.hypot(dx, dz)
      if (distance >= minimumDistance) continue
      const normalX = distance > 1e-6 ? dx / distance : Math.sin(actor.facing)
      const normalZ = distance > 1e-6 ? dz / distance : Math.cos(actor.facing)
      next = {
        x: Math.max(bounds.minX, Math.min(bounds.maxX, obstacle.x + normalX * minimumDistance)),
        z: Math.max(bounds.minZ, Math.min(bounds.maxZ, obstacle.z + normalZ * minimumDistance)),
      }
      separated = true
    }
    if (!separated) break
  }

  actor.x = next.x
  actor.z = next.z
  const movedX = actor.x - start.x
  const movedZ = actor.z - start.z
  const movedDistance = Math.hypot(movedX, movedZ)
  const requestedDistance = Math.hypot(desired.x - start.x, desired.z - start.z)
  return {
    movedDistance,
    movedX,
    movedZ,
    blocked: collided && movedDistance + 0.02 < requestedDistance,
  }
}

export function walkActorPath(engine, actor, speed, delta) {
  actor.repathTimer = Math.max(0, actor.repathTimer - delta)
  if (actor.targetX === null || actor.targetZ === null || actor.pathIndex >= actor.path.length) {
    if (actor.targetX !== null) clearActorPath(actor)
    return false
  }

  let remainingDistance = speed * delta
  let moved = false
  let blocked = false

  while (remainingDistance > 1e-4 && actor.pathIndex < actor.path.length) {
    const waypoint = actor.path[actor.pathIndex]
    const dx = waypoint.x - actor.x
    const dz = waypoint.z - actor.z
    const distance = Math.hypot(dx, dz)
    if (distance < 0.1) {
      actor.pathIndex += 1
      continue
    }

    const stepDistance = Math.min(distance, remainingDistance)
    const result = moveActorToPosition(engine, actor, {
      x: actor.x + (dx / distance) * stepDistance,
      z: actor.z + (dz / distance) * stepDistance,
    })
    if (result.movedDistance > 1e-4) {
      actor.facing = Math.atan2(result.movedX, result.movedZ)
      moved = true
    }
    if (result.blocked || result.movedDistance + 0.02 < stepDistance) {
      blocked = true
      break
    }
    remainingDistance -= stepDistance
    if (stepDistance >= distance - 1e-4) actor.pathIndex += 1
  }

  if (actor.pathIndex >= actor.path.length) {
    clearActorPath(actor)
  } else if (blocked && actor.repathTimer <= 0 && actor.routeGoal) {
    const goal = actor.routeGoal
    setActorPath(engine, actor, goal)
  }
  return moved
}
