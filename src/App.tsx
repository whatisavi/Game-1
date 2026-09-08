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
  const [leaderboard, setLeaderboard] = useState<Array<{ id: string; username: string; win: number }>>([])
  const [tripleLeaderboard, setTripleLeaderboard] = useState<Array<{ id: string; username: string; win: number }>>([])
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false)
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null)
  const [leaderboardOpen, setLeaderboardOpen] = useState(false)
  const [tripleLeaderboardOpen, setTripleLeaderboardOpen] = useState(false)

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

  async function fetchLeaderboard(mode: 'classic' | 'triple') {
    setLeaderboardError(null)
    setLoadingLeaderboard(true)

    try {
      const response = await fetch(`/api/game/leaderboard?mode=${mode}`)
      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        throw new Error(errorData?.error || 'Could not load leaderboard')
      }

      const data = await response.json()
      const rawEntries = Array.isArray(data)
        ? data
        : Array.isArray(data.entries)
          ? data.entries
          : Array.isArray(data.results)
            ? data.results
            : Array.isArray(data.rows)
              ? data.rows
              : Array.isArray(data.data)
                ? data.data
                : []

      const entries = rawEntries.map((entry: any) => ({
        id: String(entry?.id ?? entry?.ID ?? ''),
        username: String(entry?.username ?? entry?.USERNAME ?? ''),
        win: Number(entry?.win ?? entry?.WIN ?? 0),
      }))
      if (mode === 'triple') setTripleLeaderboard(entries)
      else setLeaderboard(entries)
    } catch (err: any) {
      setLeaderboardError(String(err?.message || err))
    } finally {
      setLoadingLeaderboard(false)
    }
  }

  function handleToggleLeaderboard(mode: 'classic' | 'triple') {
    if (mode === 'triple') {
      const nextOpen = !tripleLeaderboardOpen
      setTripleLeaderboardOpen(nextOpen)
      if (nextOpen && tripleLeaderboard.length === 0) void fetchLeaderboard('triple')
      return
    }
    const nextOpen = !leaderboardOpen
    setLeaderboardOpen(nextOpen)
    if (nextOpen && leaderboard.length === 0) void fetchLeaderboard('classic')
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
              <button className="primary-cta leaderboard-toggle-button" onClick={() => handleToggleLeaderboard('classic')}>
                {leaderboardOpen ? 'Hide leaderboard' : 'Show leaderboard'}
              </button>
              <button className="secondary-btn leaderboard-toggle-button" onClick={() => handleToggleLeaderboard('triple')}>
                {tripleLeaderboardOpen ? 'Hide 1v1v1 leaderboard' : 'Show 1v1v1 leaderboard'}
              </button>
              {leaderboardOpen && (
                <section className="leaderboard-box">
                  <div className="leaderboard-box-header">
                    <span>Leaderboard</span>
                    <small>Top wins</small>
                  </div>
                  {loadingLeaderboard ? (
                    <p>Loading...</p>
                  ) : leaderboardError ? (
                    <p className="error">{leaderboardError}</p>
                  ) : leaderboard.length === 0 ? (
                    <p>No entries yet.</p>
                  ) : (
                    <ol className="sidebar-leaderboard-list">
                      {leaderboard.map((entry) => (
                        <li key={entry.id}>
                          <span>{entry.username}</span>
                          <strong>{entry.win}</strong>
                        </li>
                      ))}
                    </ol>
                  )}
                </section>
              )}
              {tripleLeaderboardOpen && (
                <section className="leaderboard-box triple-leaderboard-box">
                  <div className="leaderboard-box-header">
                    <span>1v1v1 Leaderboard</span>
                    <small>Top wins</small>
                  </div>
                  {loadingLeaderboard ? (
                    <p>Loading...</p>
                  ) : leaderboardError ? (
                    <p className="error">{leaderboardError}</p>
                  ) : tripleLeaderboard.length === 0 ? (
                    <p>No entries yet.</p>
                  ) : (
                    <ol className="sidebar-leaderboard-list">
                      {tripleLeaderboard.map((entry) => (
                        <li key={entry.id}>
                          <span>{entry.username}</span>
                          <strong>{entry.win}</strong>
                        </li>
                      ))}
                    </ol>
                  )}
                </section>
              )}
            </aside>
          </div>
        )}
      </main>
    </div>
  )
}
