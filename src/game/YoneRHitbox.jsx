import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { DoubleSide } from 'three'

const EDGE_POSITIONS = new Float32Array([
  -1.5, 0, 0, 1.5, 0, 0,
  1.5, 0, 0, 1.5, 6, 0,
  1.5, 6, 0, -1.5, 6, 0,
  -1.5, 6, 0, -1.5, 0, 0,
])

function YoneRHitbox({ engine }) {
  const root = useRef(null)
  const fillMaterial = useRef(null)

  useFrame((state) => {
    const actor = engine.current?.actors.yone
    const node = root.current
    if (!actor || !node) return

    const active = actor.activeSkill?.key === 'r'
    node.visible = active
    if (!active) return

    node.position.set(actor.x, 0.07, actor.z)
    node.rotation.y = actor.facing
    if (fillMaterial.current) {
      fillMaterial.current.opacity = 0.1 + (Math.sin(state.clock.elapsedTime * 8) + 1) * 0.025
    }
  })

  return (
    <group ref={root} visible={false}>
      <group rotation={[Math.PI / 2, 0, 0]}>
        <mesh position={[0, 3, 0]}>
          <planeGeometry args={[3, 6]} />
          <meshBasicMaterial
            ref={fillMaterial}
            color="#ff9b55"
            transparent
            opacity={0.12}
            depthWrite={false}
            depthTest={false}
            side={DoubleSide}
            toneMapped={false}
          />
        </mesh>
        <lineSegments position={[0, 0, -0.02]}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[EDGE_POSITIONS, 3]} />
          </bufferGeometry>
          <lineBasicMaterial color="#ff704d" transparent opacity={0.95} depthWrite={false} depthTest={false} toneMapped={false} />
        </lineSegments>
      </group>
    </group>
  )
}

export default YoneRHitbox
