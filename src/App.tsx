import React from 'react'
import Game from './components/Game'

export default function App() {
  return (
    <div className="app">
      <header>
        <h1>Connect Four</h1>
      </header>
      <main>
        <Game />
      </main>
    </div>
  )
}
