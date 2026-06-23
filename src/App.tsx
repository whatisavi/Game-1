import React from 'react'
import Game from './components/Game'
import Signup from './components/Signup'

export default function App() {
  return (
    <div className="app">
      <header>
        <h1>Connect Four</h1>
      </header>
      <main>
        <div className="main-layout">
          <Game />
          <aside className="app-sidebar" style={{ width: 320 }}>
            <Signup />
          </aside>
        </div>
      </main>
    </div>
  )
}
