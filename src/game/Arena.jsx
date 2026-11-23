import { ARENA_ROCKS } from './collision.js'

const trees = [
  [-11, -7, 1.1], [-9, -8, 0.82], [-6.8, -8, 1.02], [-3.8, -8.5, 0.8],
  [0, -8, 1.1], [3.2, -8.4, 0.92], [6.5, -8.1, 1.02], [9.3, -7.6, 0.78], [11, -6.4, 1.15],
  [-11, 6.7, 0.86], [-8, 7.9, 1.1], [-5.5, 8.3, 0.8], [-2.2, 8.2, 1.04],
  [1.4, 8.3, 0.86], [4.7, 8.1, 1.1], [7.7, 7.8, 0.8], [10.5, 6.5, 1.04],
]

function Tree({ position, scale = 1, variant = 0 }) {
  const canopy = variant % 2 ? '#31594a' : '#3b6651'
  return (
    <group position={[position[0], 0, position[1]]} scale={scale}>
      <mesh position={[0, 0.72, 0]} castShadow>
        <cylinderGeometry args={[0.11, 0.19, 1.45, 7]} />
        <meshStandardMaterial color="#493c31" roughness={1} />
      </mesh>
      <mesh position={[0, 1.62, 0]} castShadow>
        <icosahedronGeometry args={[0.91, 1]} />
        <meshStandardMaterial color={canopy} roughness={0.94} flatShading />
      </mesh>
      <mesh position={[0.28, 1.38, -0.14]} castShadow>
        <icosahedronGeometry args={[0.48, 0]} />
        <meshStandardMaterial color="#527358" roughness={1} flatShading />
      </mesh>
    </group>
  )
}

function Rock({ position, scale = 1 }) {
  return (
    <mesh position={[position[0], scale * 0.34, position[1]]} scale={[scale * 1.25, scale * 0.7, scale]} rotation={[0.15, position[0] * 0.07, 0]} castShadow receiveShadow>
      <dodecahedronGeometry args={[0.62, 0]} />
      <meshStandardMaterial color="#48534c" roughness={0.94} flatShading />
    </mesh>
  )
}

function GrassTuft({ x, z, hue = '#607555' }) {
  return (
    <group position={[x, 0.02, z]}>
      {[0, 1, 2].map((index) => (
        <mesh key={index} position={[(index - 1) * 0.08, 0.2, 0]} rotation={[0, index * 1.1, (index - 1) * 0.14]}>
          <coneGeometry args={[0.1, 0.42 + index * 0.04, 5]} />
          <meshStandardMaterial color={hue} roughness={1} flatShading />
        </mesh>
      ))}
    </group>
  )
}

function RuneStone({ position, color }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.55, 0]} castShadow>
        <cylinderGeometry args={[0.27, 0.38, 1.1, 6]} />
        <meshStandardMaterial color="#42504a" roughness={0.85} />
      </mesh>
      <mesh position={[0, 1.13, 0]}>
        <octahedronGeometry args={[0.24, 0]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.2} />
      </mesh>
      <pointLight position={[0, 1.4, 0]} color={color} intensity={1.8} distance={3.5} />
    </group>
  )
}

function Arena() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.12, 0]} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#18231e" roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[27, 18, 1, 1]} />
        <meshStandardMaterial color="#2c3c32" roughness={0.98} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]} receiveShadow>
        <planeGeometry args={[21, 5.8]} />
        <meshStandardMaterial color="#565b4d" roughness={0.88} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]}>
        <planeGeometry args={[19.5, 0.12]} />
        <meshBasicMaterial color="#d5c48b" transparent opacity={0.2} />
      </mesh>

      {[-8, -6, -4, -2, 0, 2, 4, 6, 8].map((x) => (
        <group key={x} position={[x, 0.028, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.12, 0.17, 24]} />
            <meshBasicMaterial color="#b5a77e" transparent opacity={0.42} />
          </mesh>
        </group>
      ))}

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.026, 0]}>
        <ringGeometry args={[2.62, 2.72, 72]} />
        <meshBasicMaterial color="#a6c8a4" transparent opacity={0.18} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.027, 0]}>
        <ringGeometry args={[4.25, 4.31, 72]} />
        <meshBasicMaterial color="#bcc8a1" transparent opacity={0.12} />
      </mesh>

      {trees.map(([x, z, scale], index) => <Tree key={`${x}:${z}`} position={[x, z]} scale={scale} variant={index} />)}
      {ARENA_ROCKS.map(([x, z, scale]) => <Rock key={`${x}:${z}`} position={[x, z]} scale={scale} />)}
      {[
        [-10, -5, '#51c7b3'], [-7.2, 5.5, '#79d0a9'], [-4.6, -5.8, '#76bb8c'],
        [4.3, 5.7, '#73c9ac'], [7.8, -5.3, '#52cbb9'], [10.1, 4.9, '#68b991'],
        [-6, 3.8, '#8cab70'], [6.1, -3.9, '#8cab70'],
      ].map(([x, z, hue], index) => <GrassTuft key={index} x={x} z={z} hue={hue} />)}

      <RuneStone position={[-9.4, 0, 0]} color="#61cdb9" />
      <RuneStone position={[9.4, 0, 0]} color="#9f82eb" />
      <mesh position={[0, 0.16, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.8, 2.05, 0.3, 10]} />
        <meshStandardMaterial color="#414d43" roughness={0.82} />
      </mesh>
      <mesh position={[0, 0.33, 0]}>
        <cylinderGeometry args={[1.2, 1.3, 0.06, 10]} />
        <meshStandardMaterial color="#69735a" roughness={0.78} />
      </mesh>
    </group>
  )
}

export default Arena
