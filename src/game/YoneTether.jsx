import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Vector3 } from 'three'

const UP = new Vector3(0, 1, 0)
const RING_RADIUS = 1.04
const GROUND_HEIGHT = 0.045

function YoneTether({ yoneRef, cloneRef }) {
  const group = useRef(null)
  const glowMaterial = useRef(null)
  const coreMaterial = useRef(null)
  const start = useRef(new Vector3())
  const end = useRef(new Vector3())
  const direction = useRef(new Vector3())

  useFrame((state) => {
    const yone = yoneRef.current
    const clone = cloneRef.current
    const tether = group.current
    if (!yone || !clone || !tether) return

    yone.getWorldPosition(start.current)
    clone.getWorldPosition(end.current)
    start.current.y = GROUND_HEIGHT
    end.current.y = GROUND_HEIGHT
    direction.current.subVectors(end.current, start.current)
    direction.current.y = 0
    const centerDistance = direction.current.length()
    if (centerDistance <= RING_RADIUS * 2) {
      tether.visible = false
      return
    }

    direction.current.normalize()
    start.current.addScaledVector(direction.current, RING_RADIUS)
    end.current.addScaledVector(direction.current, -RING_RADIUS)
    direction.current.subVectors(end.current, start.current)
    const length = direction.current.length()
    if (length < 0.001) {
      tether.visible = false
      return
    }

    tether.visible = true
    tether.position.copy(start.current).add(end.current).multiplyScalar(0.5)
    tether.quaternion.setFromUnitVectors(UP, direction.current.multiplyScalar(1 / length))
    tether.scale.y = length

    const pulse = 0.82 + (Math.sin(state.clock.elapsedTime * 9) + 1) * 0.09
    if (glowMaterial.current) glowMaterial.current.opacity = pulse * 0.24
    if (coreMaterial.current) coreMaterial.current.opacity = pulse
  })

  return (
    <group ref={group} renderOrder={10}>
      <mesh renderOrder={10}>
        <cylinderGeometry args={[0.085, 0.085, 1, 10]} />
        <meshBasicMaterial ref={glowMaterial} color="#ff1e3c" transparent depthWrite={false} depthTest={false} toneMapped={false} />
      </mesh>
      <mesh renderOrder={11}>
        <cylinderGeometry args={[0.027, 0.027, 1, 8]} />
        <meshBasicMaterial ref={coreMaterial} color="#ff5a68" transparent depthWrite={false} depthTest={false} toneMapped={false} />
      </mesh>
    </group>
  )
}

export default YoneTether
