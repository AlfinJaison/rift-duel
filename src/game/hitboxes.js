function getLocalHitboxPolygon(hitbox) {
  if (hitbox.type === 'rectangle') {
    const halfWidth = hitbox.width / 2
    return [
      [-halfWidth, 0],
      [halfWidth, 0],
      [halfWidth, hitbox.length],
      [-halfWidth, hitbox.length],
    ]
  }

  if (hitbox.type === 'equilateralTriangle') {
    const halfSide = hitbox.side / 2
    const height = hitbox.side * Math.sqrt(3) / 2
    return [[0, 0], [-halfSide, height], [halfSide, height]]
  }

  return []
}

export function createHitboxPolygon(origin, facing, hitbox) {
  const forwardX = Math.sin(facing)
  const forwardZ = Math.cos(facing)
  const lateralX = Math.cos(facing)
  const lateralZ = -Math.sin(facing)

  return getLocalHitboxPolygon(hitbox).map(([lateral, forward]) => [
    origin.x + lateral * lateralX + forward * forwardX,
    origin.z + lateral * lateralZ + forward * forwardZ,
  ])
}

function pointOnSegment(point, start, end) {
  const cross = (point.z - start[1]) * (end[0] - start[0]) - (point.x - start[0]) * (end[1] - start[1])
  if (Math.abs(cross) > 1e-7) return false

  const dot = (point.x - start[0]) * (end[0] - start[0]) + (point.z - start[1]) * (end[1] - start[1])
  if (dot < 0) return false

  const lengthSquared = (end[0] - start[0]) ** 2 + (end[1] - start[1]) ** 2
  return dot <= lengthSquared
}

export function isPointInPolygon(point, polygon) {
  if (polygon.length < 3) return false

  let inside = false
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const start = polygon[previous]
    const end = polygon[index]
    if (pointOnSegment(point, start, end)) return true

    const crossesPointZ = (start[1] > point.z) !== (end[1] > point.z)
    if (crossesPointZ) {
      const crossingX = ((end[0] - start[0]) * (point.z - start[1])) / (end[1] - start[1]) + start[0]
      if (point.x < crossingX) inside = !inside
    }
  }

  return inside
}

export function isTargetInsideHitbox(origin, target, facing, hitbox) {
  return isPointInPolygon(target, createHitboxPolygon(origin, facing, hitbox))
}

function isCircleTouchingPolygon(circle, radius, polygon) {
  if (isPointInPolygon(circle, polygon)) return true
  const radiusSquared = radius * radius

  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index]
    const end = polygon[(index + 1) % polygon.length]
    const dx = end[0] - start[0]
    const dz = end[1] - start[1]
    const lengthSquared = dx * dx + dz * dz
    const amount = lengthSquared > 0
      ? Math.max(0, Math.min(1, ((circle.x - start[0]) * dx + (circle.z - start[1]) * dz) / lengthSquared))
      : 0
    const closestX = start[0] + dx * amount
    const closestZ = start[1] + dz * amount
    if ((circle.x - closestX) ** 2 + (circle.z - closestZ) ** 2 <= radiusSquared) return true
  }
  return false
}

export function isColliderTouchingHitbox(origin, target, facing, hitbox, colliderRadius) {
  const polygon = createHitboxPolygon(origin, facing, hitbox)
  return isCircleTouchingPolygon(target, colliderRadius, polygon)
}

export function getHitboxForwardExtent(hitbox) {
  if (hitbox.type === 'rectangle') return hitbox.length
  if (hitbox.type === 'equilateralTriangle') return hitbox.side * Math.sqrt(3) / 2
  return 0
}
