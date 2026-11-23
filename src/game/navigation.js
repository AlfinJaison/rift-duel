const EPSILON = 1e-7
const ROUTE_MARGIN = 0.08

function distanceSquared(a, b) {
  return (a.x - b.x) ** 2 + (a.z - b.z) ** 2
}

function isInsideBounds(point, bounds) {
  return point.x >= bounds.minX - EPSILON
    && point.x <= bounds.maxX + EPSILON
    && point.z >= bounds.minZ - EPSILON
    && point.z <= bounds.maxZ + EPSILON
}

function clampToBounds(point, bounds) {
  return {
    x: Math.max(bounds.minX, Math.min(bounds.maxX, point.x)),
    z: Math.max(bounds.minZ, Math.min(bounds.maxZ, point.z)),
  }
}

function isClearOfCircles(point, circles, ignoredCircle = -1) {
  return circles.every((circle, index) => index === ignoredCircle
    || distanceSquared(point, circle) >= (circle.radius - 1e-5) ** 2)
}

function closestPointOnSegment(point, start, end) {
  const dx = end.x - start.x
  const dz = end.z - start.z
  const lengthSquared = dx * dx + dz * dz
  if (lengthSquared <= EPSILON) return start
  const amount = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.z - start.z) * dz) / lengthSquared))
  return { x: start.x + dx * amount, z: start.z + dz * amount }
}

function segmentIsClear(start, end, circles, bounds) {
  if (!isInsideBounds(start, bounds) || !isInsideBounds(end, bounds)) return false
  return circles.every((circle) => {
    const nearest = closestPointOnSegment(circle, start, end)
    return distanceSquared(nearest, circle) >= (circle.radius - 1e-5) ** 2
  })
}

function projectToWalkable(point, source, circles, bounds) {
  const origin = clampToBounds(point, bounds)
  if (isClearOfCircles(origin, circles)) return origin

  const candidates = []
  const addCandidate = (candidate) => {
    if (isInsideBounds(candidate, bounds) && isClearOfCircles(candidate, circles)) candidates.push(candidate)
  }
  const sourceAngle = Math.atan2(source.z - origin.z, source.x - origin.x)
  for (const circle of circles) {
    const originAngle = Math.atan2(origin.z - circle.z, origin.x - circle.x)
    for (const angle of [originAngle, sourceAngle]) {
      addCandidate({ x: circle.x + Math.cos(angle) * (circle.radius + 1e-3), z: circle.z + Math.sin(angle) * (circle.radius + 1e-3) })
    }
    for (let index = 0; index < 72; index += 1) {
      const angle = (index / 72) * Math.PI * 2
      addCandidate({ x: circle.x + Math.cos(angle) * (circle.radius + 1e-3), z: circle.z + Math.sin(angle) * (circle.radius + 1e-3) })
    }
  }
  for (let firstIndex = 0; firstIndex < circles.length; firstIndex += 1) {
    const first = circles[firstIndex]
    for (let secondIndex = firstIndex + 1; secondIndex < circles.length; secondIndex += 1) {
      const second = circles[secondIndex]
      const dx = second.x - first.x
      const dz = second.z - first.z
      const distance = Math.hypot(dx, dz)
      if (distance <= EPSILON || distance > first.radius + second.radius || distance < Math.abs(first.radius - second.radius)) continue
      const along = (first.radius ** 2 - second.radius ** 2 + distance ** 2) / (2 * distance)
      const height = Math.sqrt(Math.max(0, first.radius ** 2 - along ** 2))
      const baseX = first.x + (dx / distance) * along
      const baseZ = first.z + (dz / distance) * along
      const offsetX = (-dz / distance) * height
      const offsetZ = (dx / distance) * height
      addCandidate({ x: baseX + offsetX, z: baseZ + offsetZ })
      addCandidate({ x: baseX - offsetX, z: baseZ - offsetZ })
    }
  }

  candidates.sort((first, second) => {
    const distanceDifference = distanceSquared(first, origin) - distanceSquared(second, origin)
    if (Math.abs(distanceDifference) > 1e-5) return distanceDifference
    return distanceSquared(first, source) - distanceSquared(second, source)
  })
  return candidates[0] || null
}

function addTangentNodesFromPoint(point, circle, circleIndex, circles, bounds, addNode) {
  const dx = point.x - circle.x
  const dz = point.z - circle.z
  const distance = Math.hypot(dx, dz)
  if (distance < circle.radius - 1e-5) return

  const centerAngle = Math.atan2(dz, dx)
  const tangentOffset = Math.acos(Math.max(-1, Math.min(1, circle.radius / Math.max(distance, circle.radius))))
  for (const angle of [centerAngle - tangentOffset, centerAngle + tangentOffset]) {
    addNode({ x: circle.x + Math.cos(angle) * circle.radius, z: circle.z + Math.sin(angle) * circle.radius }, circleIndex)
  }
}

function addCommonTangentNodes(first, firstIndex, second, secondIndex, circles, bounds, addNode) {
  const dx = second.x - first.x
  const dz = second.z - first.z
  const centerDistanceSquared = dx * dx + dz * dz
  if (centerDistanceSquared <= EPSILON) return

  for (const orientation of [1, -1]) {
    const radiusDifference = first.radius - orientation * second.radius
    const heightSquared = centerDistanceSquared - radiusDifference * radiusDifference
    if (heightSquared < -EPSILON) continue
    const height = Math.sqrt(Math.max(0, heightSquared))
    for (const side of [1, -1]) {
      const normalX = (dx * radiusDifference - dz * height * side) / centerDistanceSquared
      const normalZ = (dz * radiusDifference + dx * height * side) / centerDistanceSquared
      addNode({ x: first.x + normalX * first.radius, z: first.z + normalZ * first.radius }, firstIndex)
      addNode({ x: second.x + normalX * orientation * second.radius, z: second.z + normalZ * orientation * second.radius }, secondIndex)
    }
  }
}

function addCircleIntersectionNodes(first, firstIndex, second, secondIndex, circles, bounds, addNode) {
  const dx = second.x - first.x
  const dz = second.z - first.z
  const distance = Math.hypot(dx, dz)
  if (distance <= EPSILON || distance > first.radius + second.radius || distance < Math.abs(first.radius - second.radius)) return

  const along = (first.radius ** 2 - second.radius ** 2 + distance ** 2) / (2 * distance)
  const height = Math.sqrt(Math.max(0, first.radius ** 2 - along ** 2))
  const baseX = first.x + (dx / distance) * along
  const baseZ = first.z + (dz / distance) * along
  const offsetX = (-dz / distance) * height
  const offsetZ = (dx / distance) * height
  for (const direction of [-1, 1]) {
    const point = { x: baseX + offsetX * direction, z: baseZ + offsetZ * direction }
    addNode(point, firstIndex)
    addNode(point, secondIndex)
  }
}

function addCircleBoundaryIntersections(circle, circleIndex, bounds, addNode) {
  for (const x of [bounds.minX, bounds.maxX]) {
    const remaining = circle.radius ** 2 - (x - circle.x) ** 2
    if (remaining < -EPSILON) continue
    const offset = Math.sqrt(Math.max(0, remaining))
    addNode({ x, z: circle.z - offset }, circleIndex)
    addNode({ x, z: circle.z + offset }, circleIndex)
  }
  for (const z of [bounds.minZ, bounds.maxZ]) {
    const remaining = circle.radius ** 2 - (z - circle.z) ** 2
    if (remaining < -EPSILON) continue
    const offset = Math.sqrt(Math.max(0, remaining))
    addNode({ x: circle.x - offset, z }, circleIndex)
    addNode({ x: circle.x + offset, z }, circleIndex)
  }
}

function addEdge(graph, from, to, cost, points) {
  graph[from].push({ to, cost, points })
}

function addArcEdges(circle, circleIndex, circleNodeIds, nodes, circles, bounds, graph) {
  const sorted = circleNodeIds
    .map((nodeId) => ({ nodeId, angle: Math.atan2(nodes[nodeId].z - circle.z, nodes[nodeId].x - circle.x) }))
    .sort((a, b) => a.angle - b.angle)
  const unique = sorted.filter((entry, index) => index === 0 || Math.abs(entry.angle - sorted[index - 1].angle) > 1e-5)
  if (unique.length < 2) return

  for (let index = 0; index < unique.length; index += 1) {
    const first = unique[index]
    const second = unique[(index + 1) % unique.length]
    const delta = (second.angle - first.angle + Math.PI * 2) % (Math.PI * 2)
    if (delta < 1e-5) continue

    const steps = Math.max(2, Math.ceil(delta / 0.08))
    const forwardPoints = [nodes[first.nodeId]]
    let clear = true
    for (let step = 1; step < steps; step += 1) {
      const angle = first.angle + (delta * step) / steps
      const point = { x: circle.x + Math.cos(angle) * circle.radius, z: circle.z + Math.sin(angle) * circle.radius }
      if (!isInsideBounds(point, bounds) || !isClearOfCircles(point, circles, circleIndex)) {
        clear = false
        break
      }
      forwardPoints.push(point)
    }
    forwardPoints.push(nodes[second.nodeId])
    if (!clear) continue

    const cost = circle.radius * delta
    addEdge(graph, first.nodeId, second.nodeId, cost, forwardPoints)
    addEdge(graph, second.nodeId, first.nodeId, cost, forwardPoints.slice().reverse())
  }
}

function findPathInGraph(nodes, graph, startIndex, endIndex) {
  const distances = nodes.map(() => Infinity)
  const previous = nodes.map(() => null)
  const visited = nodes.map(() => false)
  distances[startIndex] = 0

  for (let iteration = 0; iteration < nodes.length; iteration += 1) {
    let current = -1
    for (let index = 0; index < nodes.length; index += 1) {
      if (!visited[index] && (current < 0 || distances[index] < distances[current])) current = index
    }
    if (current < 0 || !Number.isFinite(distances[current])) break
    if (current === endIndex) break
    visited[current] = true

    for (const edge of graph[current]) {
      const candidate = distances[current] + edge.cost
      if (candidate >= distances[edge.to]) continue
      distances[edge.to] = candidate
      previous[edge.to] = { from: current, edge }
    }
  }

  if (!Number.isFinite(distances[endIndex])) return null
  const edges = []
  for (let current = endIndex; current !== startIndex;) {
    const step = previous[current]
    if (!step) return null
    edges.push(step.edge)
    current = step.from
  }
  edges.reverse()

  const path = [nodes[startIndex]]
  for (const edge of edges) {
    for (const point of edge.points.slice(1)) {
      const previousPoint = path[path.length - 1]
      if (distanceSquared(previousPoint, point) > 1e-8) path.push(point)
    }
  }
  return path
}

export function findShortestPath(start, destination, obstacles, bounds, agentRadius) {
  const circles = obstacles
    .filter((obstacle) => obstacle.radius > 0)
    .map((obstacle) => ({ ...obstacle, radius: obstacle.radius + agentRadius + ROUTE_MARGIN }))
    .filter((circle) => circle.x + circle.radius >= bounds.minX
      && circle.x - circle.radius <= bounds.maxX
      && circle.z + circle.radius >= bounds.minZ
      && circle.z - circle.radius <= bounds.maxZ)
  const safeStart = projectToWalkable(start, start, circles, bounds)
  const safeDestination = projectToWalkable(destination, start, circles, bounds)
  if (!safeStart || !safeDestination) return null
  if (distanceSquared(safeStart, safeDestination) <= 1e-8) return [safeStart]

  const nodes = []
  const circleNodeIds = circles.map(() => [])
  const addNode = (point, circleIndex = -1) => {
    if (!isInsideBounds(point, bounds) || !isClearOfCircles(point, circles, circleIndex)) return -1
    const nodeId = nodes.length
    nodes.push(point)
    if (circleIndex >= 0) circleNodeIds[circleIndex].push(nodeId)
    return nodeId
  }

  const startIndex = addNode(safeStart)
  const endIndex = addNode(safeDestination)
  for (let circleIndex = 0; circleIndex < circles.length; circleIndex += 1) {
    const circle = circles[circleIndex]
    addTangentNodesFromPoint(safeStart, circle, circleIndex, circles, bounds, addNode)
    addTangentNodesFromPoint(safeDestination, circle, circleIndex, circles, bounds, addNode)
    addCircleBoundaryIntersections(circle, circleIndex, bounds, addNode)
  }
  for (let firstIndex = 0; firstIndex < circles.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < circles.length; secondIndex += 1) {
      addCommonTangentNodes(circles[firstIndex], firstIndex, circles[secondIndex], secondIndex, circles, bounds, addNode)
      addCircleIntersectionNodes(circles[firstIndex], firstIndex, circles[secondIndex], secondIndex, circles, bounds, addNode)
    }
  }

  const corners = [
    { x: bounds.minX, z: bounds.minZ },
    { x: bounds.minX, z: bounds.maxZ },
    { x: bounds.maxX, z: bounds.minZ },
    { x: bounds.maxX, z: bounds.maxZ },
  ]
  for (const corner of corners) addNode(corner)

  const graph = nodes.map(() => [])
  for (let first = 0; first < nodes.length; first += 1) {
    for (let second = first + 1; second < nodes.length; second += 1) {
      if (!segmentIsClear(nodes[first], nodes[second], circles, bounds)) continue
      const cost = Math.sqrt(distanceSquared(nodes[first], nodes[second]))
      addEdge(graph, first, second, cost, [nodes[first], nodes[second]])
      addEdge(graph, second, first, cost, [nodes[second], nodes[first]])
    }
  }

  for (let circleIndex = 0; circleIndex < circles.length; circleIndex += 1) {
    addArcEdges(circles[circleIndex], circleIndex, circleNodeIds[circleIndex], nodes, circles, bounds, graph)
  }

  return findPathInGraph(nodes, graph, startIndex, endIndex)
}
