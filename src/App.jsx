import { useCallback, useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { AdaptiveDpr, Preload } from '@react-three/drei'
import GameScene from './game/GameScene.jsx'

const CHAMPIONS = {
  yone: { name: 'Yone', title: 'The Unforgotten', color: '#dc5362', accent: '#f29c67' },
  mordekaiser: { name: 'Mordekaiser', title: 'The Iron Revenant', color: '#9f72ed', accent: '#49c9aa' },
}

const SKILLS = [
  { key: 'q', name: 'Q', label: 'Steel', tint: '#83d4cf' },
  { key: 'w', name: 'W', label: 'Guard', tint: '#75a9ef' },
  { key: 'e', name: 'E', label: 'Dash', tint: '#db8bff' },
  { key: 'r', name: 'R', label: 'Ultimate', tint: '#f0bc70' },
]

function HealthBar({ name, title, value, side, color }) {
  const percent = Math.max(0, Math.min(100, value))
  return (
    <div className={`health-card ${side}`}>
      <div className="health-copy">
        <div>
          <span className="eyebrow">{title}</span>
          <strong>{name}</strong>
        </div>
        <span className="health-number">{Math.ceil(percent)} <i>/ 100</i></span>
      </div>
      <div className="health-track">
        <div className="health-fill" style={{ width: `${percent}%`, '--health-color': color }} />
      </div>
    </div>
  )
}

function App() {
  const [player, setPlayer] = useState('yone')
  const [round, setRound] = useState(0)
  const [hud, setHud] = useState({
    health: { yone: 100, mordekaiser: 100 },
    cooldowns: { q: 0, w: 0, e: 0, r: 0 },
    winner: null,
  })
  const playerInfo = CHAMPIONS[player]
  const enemy = player === 'yone' ? 'mordekaiser' : 'yone'
  const enemyInfo = CHAMPIONS[enemy]
  const handleHud = useCallback((snapshot) => setHud(snapshot), [])
  const startNewRound = useCallback(() => {
    setHud({
      health: { yone: 100, mordekaiser: 100 },
      cooldowns: { q: 0, w: 0, e: 0, r: 0 },
      winner: null,
    })
    setRound((value) => value + 1)
  }, [])

  const controls = useMemo(() => (
    <>
      <div className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark"><span /><span /><span /></div>
          <div>
            <div className="brand-name">RIFT <b>DUEL</b></div>
            <div className="brand-caption">CHAMPION COMBAT PROTOTYPE</div>
          </div>
        </div>
        <div className="round-chip"><span className="live-dot" /> 1V1 PRACTICE</div>
        <div className="champion-picker" aria-label="Choose your champion">
          {Object.entries(CHAMPIONS).map(([id, champ]) => (
            <button
              key={id}
              className={`pick-button ${player === id ? 'selected' : ''}`}
              style={{ '--pick-color': champ.color }}
              onClick={() => {
                if (player !== id) {
                  setPlayer(id)
                  startNewRound()
                }
              }}
            >
              {champ.name}
            </button>
          ))}
        </div>
      </div>

      <div className="matchup">
        <HealthBar
          name={playerInfo.name}
          title="YOU | PLAYER"
          value={hud.health[player]}
          side="player-health"
          color={playerInfo.color}
        />
        <div className="versus">VS</div>
        <HealthBar
          name={enemyInfo.name}
          title="BOT | OPPONENT"
          value={hud.health[enemy]}
          side="enemy-health"
          color={enemyInfo.color}
        />
      </div>

      <div className="bottom-hud">
        <div className="skill-bar">
          {SKILLS.map((skill) => {
            const cooldown = hud.cooldowns[skill.key] || 0
            return (
              <div className={`skill ${cooldown > 0 ? 'cooling' : ''}`} key={skill.key} style={{ '--skill-tint': skill.tint }}>
                <div className="skill-icon"><span>{skill.key.toUpperCase()}</span>{cooldown > 0 && <b>{cooldown.toFixed(1)}</b>}</div>
                <div className="skill-label">{skill.label}</div>
              </div>
            )
          })}
        </div>
      </div>

      {hud.winner && (
        <div className="result-backdrop">
          <div className="result-card">
            <div className="result-kicker">DUEL COMPLETE</div>
            <h1>{hud.winner === player ? 'VICTORY' : 'DEFEAT'}</h1>
            <p>{hud.winner === player ? `${playerInfo.name} wins the duel.` : `${enemyInfo.name} wins this round.`}</p>
            <button className="restart-button" onClick={startNewRound}>FIGHT AGAIN <span>&gt;</span></button>
          </div>
        </div>
      )}
    </>
  ), [enemy, enemyInfo, hud, player, playerInfo, startNewRound])

  return (
    <main className="game-shell">
      <Canvas
        shadows
        dpr={[1, 1.6]}
        camera={{ position: [0, 12, 10.5], fov: 42, near: 0.1, far: 100 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <color attach="background" args={['#101817']} />
        <fog attach="fog" args={['#101817', 19, 39]} />
        <AdaptiveDpr pixelated />
        <GameScene player={player} round={round} onHud={handleHud} />
        <Preload all />
      </Canvas>
      <div className="screen-vignette" />
      {controls}
      <div className="arena-name"><span>ARENA 01</span><i /> THE RIFT GLADE</div>
      <div className="corner-note">LOCAL BUILD <span>|</span> PROTOTYPE 0.1</div>
    </main>
  )
}

export default App
