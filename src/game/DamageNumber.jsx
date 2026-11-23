import { useRef } from 'react'
import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'

const LIFETIME = 0.5

function DamageNumber({ damage, position }) {
  const group = useRef(null)
  const label = useRef(null)
  const elapsed = useRef(0)

  useFrame((_, delta) => {
    elapsed.current = Math.min(LIFETIME, elapsed.current + Math.min(delta, 0.04))
    const progress = elapsed.current / LIFETIME
    if (group.current) group.current.position.y = 0.7 + progress * 0.85
    if (label.current) {
      label.current.style.opacity = String(1 - progress)
      label.current.style.transform = `translateY(${-progress * 10}px) scale(${0.9 + progress * 0.15})`
    }
  })

  return (
    <group ref={group} position={[position[0], 0, position[1]]}>
      <Html center zIndexRange={[100, 0]} style={{ pointerEvents: 'none' }}>
        <div ref={label} className="damage-number">{damage}</div>
      </Html>
    </group>
  )
}

export default DamageNumber
