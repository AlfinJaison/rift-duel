import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, Quaternion, Vector3 } from 'three'

function CombatEffect({ effect }) {
  const group = useRef(null)
  const ring = useRef(null)
  const beam = useRef(null)
  const from = useMemo(() => new Vector3(effect.from[0], 0.12, effect.from[1]), [effect.from])
  const to = useMemo(() => new Vector3(effect.to[0], 0.12, effect.to[1]), [effect.to])
  const direction = useMemo(() => to.clone().sub(from), [from, to])
  const length = direction.length()
  const midpoint = useMemo(() => from.clone().add(to).multiplyScalar(0.5), [from, to])
  const beamDirection = useMemo(() => direction.lengthSq() > 0.0001 ? direction.clone().normalize() : new Vector3(1, 0, 0), [direction])
  const beamRotation = useMemo(() => new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), beamDirection), [beamDirection])
  const color = new Color(effect.color)
  const elapsed = useRef(0)

  useFrame((_, delta) => {
    elapsed.current += delta
    const progress = Math.min(1, elapsed.current / effect.duration)
    const pulse = Math.sin(progress * Math.PI)
    if (ring.current) {
      ring.current.scale.setScalar(0.7 + progress * 1.7)
      ring.current.material.opacity = (1 - progress) * 0.85
    }
    if (beam.current) {
      beam.current.scale.y = length * Math.max(0.2, pulse)
      beam.current.material.opacity = (1 - progress) * 0.78
    }
    if (group.current) group.current.position.y = 0.045 + pulse * 0.12
  })

  return (
    <group ref={group} position={[to.x, 0.05, to.z]}>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.55, effect.type === 'r' ? 0.76 : 0.48, 48]} />
        <meshBasicMaterial color={color} transparent depthWrite={false} />
      </mesh>
      {(effect.type === 'q' || effect.type === 'e' || effect.type === 'r') && (
        <mesh
          ref={beam}
          position={[midpoint.x - to.x, Math.max(0.18, length * 0.15), midpoint.z - to.z]}
          quaternion={beamRotation}
        >
          <cylinderGeometry args={[effect.type === 'r' ? 0.22 : 0.12, effect.type === 'r' ? 0.35 : 0.22, 1, 10]} />
          <meshBasicMaterial color={color} transparent depthWrite={false} />
        </mesh>
      )}
      <pointLight position={[0, 0.75, 0]} color={color} intensity={5} distance={4} decay={2} />
    </group>
  )
}

export default CombatEffect
