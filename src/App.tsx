import React, { useEffect, useState } from 'react'
import Game from './components/Game'
import Signup from './components/Signup'

type View = 'home' | 'auth' | 'game'

type User = {
  id?: string
  username: string
  email: string
  wins?: number
}

export default function App() {
  const [view, setView] = useState<View>('home')
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    const savedUser = localStorage.getItem('auth_user')
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser) as User
        setUser(parsedUser)
        setView('game')
      } catch {
        localStorage.removeItem('auth_user')
        setView('home')
      }
    }
  }, [])

  function handleAuthSuccess(nextUser: User) {
    setUser(nextUser)
    setView('game')
  }

  function handleSignOut() {
    setUser(null)
    localStorage.removeItem('auth_user')
    setView('home')
  }

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <p className="eyebrow">Classic strategy game</p>
          <h1>Connect Four</h1>
          <p className="hero-copy">Drop your pieces, block your opponent, and connect four in a row.</p>
        </div>
        <div className="header-actions">
          {user ? (
            <button className="ghost-btn" onClick={handleSignOut}>Sign Out</button>
          ) : (
            <button className="ghost-btn" onClick={() => setView('auth')}>Sign In</button>
          )}
        </div>
      </header>

      <main>
        {view === 'home' && (
          <section className="hero-card">
            <div className="hero-content">
              <div className="hero-badge">Simple sign-in</div>
              <h2>Play Connect Four</h2>
              <p>Sign in and start a game right away.</p>
              <button className="primary-cta" onClick={() => setView('auth')}>Sign in to play</button>
            </div>
            <div className="hero-preview" aria-hidden="true">
              <div className="preview-board">
                {Array.from({ length: 7 }).map((_, index) => (
                  <div key={index} className="preview-column">
                    {Array.from({ length: 6 }).map((__, rowIndex) => (
                      <div key={`${index}-${rowIndex}`} className={`preview-cell ${rowIndex % 2 === 0 ? 'red' : 'yellow'}`} />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {view === 'auth' && (
          <section className="auth-view">
            <div className="auth-intro">
              <h2>Sign in</h2>
              <p>Use your account to continue to the game.</p>
              <button className="text-link-btn" onClick={() => setView('home')}>Back to home</button>
            </div>
            <Signup onAuthenticated={handleAuthSuccess} />
          </section>
        )}

        {view === 'game' && (
          <div className="main-layout">
            <Game user={user} />
            <aside className="app-sidebar" style={{ width: 320 }}>
              <div className="player-card">
                <div className="avatar-badge">{user?.username?.slice(0, 2).toUpperCase() || 'PL'}</div>
                <h3>{user?.username || 'Player'}</h3>
                <p>{user?.email || 'Signed in and ready to play'}</p>
              </div>
            </aside>
          </div>
        )}
      </main>
    </div>
  )
}
