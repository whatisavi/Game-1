import React from 'react'
import Game from './components/Game'
import AudioPlayer from './components/AudioPlayer'

export default function App() {
  return (
    <div className="app">
      <header>
        <h1>Connect Four</h1>
      </header>
      <main>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <Game />
          <aside style={{ width: 260 }}>
            <AudioPlayer src="/background music. - quiet please. (128k).mp3" initialVolume={0.15} />
          </aside>
        </div>
      </main>
    </div>
  )
}
