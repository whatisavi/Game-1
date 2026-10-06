import React, { useEffect, useState } from 'react'
import Game from './components/Game'
import Signup from './components/Signup'
import Admin from './components/Admin'
import { GameMode } from './lib/game'

type View = 'home' | 'auth' | 'game' | 'leaderboards' | 'profile' | 'admin-login' | 'admin'

type User = {
  id?: string
  username: string
  email: string
  wins?: number
  isAdmin?: boolean
  adminToken?: string
}

type LeaderboardEntry = { id: string; username: string; win: number; games?: number }

function getUserWins(user: User, entries: LeaderboardEntry[]): number {
  const entry = entries.find((candidate) => candidate.id === user.id || candidate.username === user.username)
  return entry?.win ?? 0
}

function getProfileWins(user: User, boards: LeaderboardEntry[][]): number {
  return boards.reduce((total, entries) => total + getUserWins(user, entries), 0)
}

function getUserGames(user: User, entries: LeaderboardEntry[]): number {
  const entry = entries.find((candidate) => candidate.id === user.id || candidate.username === user.username)
  return entry?.games ?? 0
}

function getProfileWinRate(user: User, boards: LeaderboardEntry[][]): number | null {
  const wins = getProfileWins(user, boards)
  const games = boards.reduce((total, entries) => total + getUserGames(user, entries), 0)
  return games > 0 ? Math.round((wins / games) * 100) : null
}

function getFavoriteMode(user: User, boards: LeaderboardEntry[][]): string {
  const labels = ['Classic', 'Triple', 'Stealing', "Don't Connect Four"]
  const wins = boards.map((entries) => getUserWins(user, entries))
  const highest = Math.max(...wins)
  return highest > 0 ? labels[wins.indexOf(highest)] : 'None yet'
}

export default function App() {
  const [view, setView] = useState<View>('home')
  const [user, setUser] = useState<User | null>(null)
  const [leaderboard, setLeaderboard] = useState<Array<{ id: string; username: string; win: number }>>([])
  const [tripleLeaderboard, setTripleLeaderboard] = useState<Array<{ id: string; username: string; win: number }>>([])
  const [stealingLeaderboard, setStealingLeaderboard] = useState<Array<{ id: string; username: string; win: number }>>([])
  const [antiConnectLeaderboard, setAntiConnectLeaderboard] = useState<Array<{ id: string; username: string; win: number }>>([])
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false)
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null)
  const [selectedMode, setSelectedMode] = useState<GameMode>('classic')
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('app_theme')
    return saved === 'light' ? 'light' : 'dark'
  })

  useEffect(() => {
    localStorage.setItem('app_theme', theme)
    if (theme === 'light') {
      document.documentElement.classList.add('light-theme')
      document.body.classList.add('light-theme')
    } else {
      document.documentElement.classList.remove('light-theme')
      document.body.classList.remove('light-theme')
    }
  }, [theme])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (window.location.pathname === '/admin' || window.location.search.includes('admin') || window.location.hash === '#admin') {
        setView('admin-login')
      }
    }
    const savedUser = localStorage.getItem('auth_user')
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser) as User
        setUser(parsedUser)
      } catch {
        localStorage.removeItem('auth_user')
      }
    }
  }, [])

  function handleAuthSuccess(nextUser: User) {
    setUser(nextUser)
    setView('home')
  }

  function handleAdminAuthSuccess(nextUser: User) {
    setUser(nextUser)
    setView('admin')
  }

  function openMode(nextMode: GameMode) {
    setSelectedMode(nextMode)
    if (user) setView('game')
    else setView('auth')
  }

  function openLeaderboards() {
    setView('leaderboards')
    if (leaderboard.length === 0) void fetchLeaderboard('classic')
    if (tripleLeaderboard.length === 0) void fetchLeaderboard('triple')
    if (stealingLeaderboard.length === 0) void fetchLeaderboard('stealing')
    if (antiConnectLeaderboard.length === 0) void fetchLeaderboard('anti-connect')
  }

  function openProfile() {
    setView('profile')
    if (leaderboard.length === 0) void fetchLeaderboard('classic')
    if (tripleLeaderboard.length === 0) void fetchLeaderboard('triple')
    if (stealingLeaderboard.length === 0) void fetchLeaderboard('stealing')
    if (antiConnectLeaderboard.length === 0) void fetchLeaderboard('anti-connect')
  }

  function handleSignOut() {
    setUser(null)
    localStorage.removeItem('auth_user')
    setView('home')
  }

  async function fetchLeaderboard(mode: GameMode) {
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
        games: Number(entry?.games ?? entry?.GAMES ?? 0),
      }))
      if (mode === 'triple') setTripleLeaderboard(entries)
      else if (mode === 'stealing') setStealingLeaderboard(entries)
      else if (mode === 'anti-connect') setAntiConnectLeaderboard(entries)
      else setLeaderboard(entries)
    } catch (err: any) {
      setLeaderboardError(String(err?.message || err))
    } finally {
      setLoadingLeaderboard(false)
    }
  }

  return (
    <div className={`app ${theme === 'light' ? 'light-theme' : ''} ${view === 'admin' ? 'view-admin' : ''}`}>
      {view !== 'game' && view !== 'admin-login' && view !== 'admin' && (
        <header className="app-header">
          <div>
            <p className="eyebrow">Classic strategy game</p>
            <h1>Connect Four</h1>
            <p className="hero-copy">Drop your pieces, block your opponent, and connect four in a row.</p>
          </div>
          <div className="header-actions">
            <div
              className={`theme-toggle ${theme}`}
              id="theme-toggle"
              data-testid="theme-toggle"
              role="group"
              aria-label="Color theme toggle"
              onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
            >
              <button
                type="button"
                className={`theme-toggle-option ${theme === 'dark' ? 'active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation()
                  setTheme('dark')
                }}
                aria-pressed={theme === 'dark'}
                aria-label="Dark mode"
                title="Dark mode"
              >
                <span className="theme-toggle-icon" aria-hidden="true">🌙</span>
                <span className="theme-toggle-label">Dark</span>
              </button>
              <button
                type="button"
                className={`theme-toggle-option ${theme === 'light' ? 'active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation()
                  setTheme('light')
                }}
                aria-pressed={theme === 'light'}
                aria-label="Light mode"
                title="Light mode"
              >
                <span className="theme-toggle-icon" aria-hidden="true">☀️</span>
                <span className="theme-toggle-label">Light</span>
              </button>
            </div>
            <button className="ghost-btn admin-nav-btn" onClick={() => setView('admin-login')} title="Open User Admin Console">
              Admin
            </button>
            {user ? (
              <button className="signed-in-chip" onClick={openProfile}>
                <span className="signed-in-dot" />
                <span>{user.username}</span>
              </button>
            ) : (
              <button className="ghost-btn" onClick={() => setView('auth')}>Sign In</button>
            )}
          </div>
        </header>
      )}

      <main>
        {view === 'home' && (
          <section className="mode-home">
            <div className="mode-home-copy">
              <span className="mode-home-kicker">Choose your arena</span>
              <h2>Four ways to<br /><em>connect.</em></h2>
              <p>Every drop changes the board. Pick a rule set and make your move.</p>
              <div className="mode-home-markers" aria-hidden="true">
                <span className="marker red" />
                <span className="marker yellow" />
                <span className="marker teal" />
              </div>
            </div>
            <div className="mode-menu" aria-label="Game modes">
              <button className="mode-menu-button classic-mode" onClick={() => openMode('classic')}>
                <span className="mode-icon">+</span>
                <span><strong>Classic</strong><small>One line. Four pieces. Win.</small></span>
                <span className="mode-arrow" aria-hidden="true">↗</span>
              </button>
              <button className="mode-menu-button triple-mode-button" onClick={() => openMode('triple')}>
                <span className="mode-icon">3</span>
                <span><strong>Triple</strong><small>Three players. One crowded board.</small></span>
                <span className="mode-arrow" aria-hidden="true">↗</span>
              </button>
              <button className="mode-menu-button stealing-mode" onClick={() => openMode('stealing')}>
                <span className="mode-icon">✦</span>
                <span><strong>Stealing</strong><small>Take a piece. Turn the tide.</small></span>
                <span className="mode-arrow" aria-hidden="true">↗</span>
              </button>
              <button className="mode-menu-button anti-connect-mode" onClick={() => openMode('anti-connect')}>
                <span className="mode-icon">×</span>
                <span><strong>Don't Connect Four</strong><small>Connect first and lose.</small></span>
                <span className="mode-arrow" aria-hidden="true">↗</span>
              </button>
              <button className="mode-menu-button leaderboard-mode-button" onClick={openLeaderboards}>
                <span className="mode-icon">↗</span>
                <span><strong>Leaderboards</strong><small>See who is climbing the ranks.</small></span>
                <span className="mode-arrow" aria-hidden="true">↗</span>
              </button>
            </div>
            <div className="mode-home-footer">
              <span className="status-dot" />
              <span>Solo play · Sign in to save your wins</span>
              <span className="footer-dot-sep">·</span>
              <button className="footer-link-btn" onClick={() => setView('admin-login')} title="Open Player Administration Console">
                Admin Console
              </button>
            </div>
          </section>
        )}

        {view === 'auth' && (
          <section className="auth-view">
            <div className="auth-intro">
              <h2>Sign in</h2>
              <p>Use your account to continue to the game.</p>
              <button className="text-link-btn" onClick={() => setView('home')}>Back to modes</button>
            </div>
            <Signup onAuthenticated={handleAuthSuccess} />
          </section>
        )}

        {view === 'admin-login' && (
          <section className="auth-view">
            <div className="auth-intro">
              <span className="mode-home-kicker">Restricted area</span>
              <h2>Admin sign in</h2>
              <p>Sign in with an administrator account to continue.</p>
              <button className="text-link-btn" onClick={() => setView('home')}>Back to game</button>
            </div>
            <Signup adminOnly onAuthenticated={handleAdminAuthSuccess} />
          </section>
        )}

        {view === 'leaderboards' && (
          <section className="leaderboards-page">
            <div className="leaderboards-page-scroll">
              <div className="leaderboards-page-header">
                <div>
                  <span className="mode-home-kicker">The score table</span>
                  <h2>Leaderboards</h2>
                  <p>Compare wins across every way to play.</p>
                </div>
                <button className="text-link-btn" onClick={() => setView('home')}>Back to modes</button>
              </div>
              <div className="leaderboards-grid">
                <section className="leaderboard-panel">
                  <div className="leaderboard-panel-header"><span>Classic</span><small>Top wins</small></div>
                  {loadingLeaderboard ? <p>Loading...</p> : leaderboardError ? <p className="error">{leaderboardError}</p> : leaderboard.length === 0 ? <p>No entries yet.</p> : (
                    <ol className="leaderboard-page-list">{leaderboard.map((entry) => <li key={entry.id}><span>{entry.username}</span><strong>{entry.win}</strong></li>)}</ol>
                  )}
                </section>
                <section className="leaderboard-panel">
                  <div className="leaderboard-panel-header"><span>Triple</span><small>Top wins</small></div>
                  {loadingLeaderboard ? <p>Loading...</p> : leaderboardError ? <p className="error">{leaderboardError}</p> : tripleLeaderboard.length === 0 ? <p>No entries yet.</p> : (
                    <ol className="leaderboard-page-list">{tripleLeaderboard.map((entry) => <li key={entry.id}><span>{entry.username}</span><strong>{entry.win}</strong></li>)}</ol>
                  )}
                </section>
                <section className="leaderboard-panel leaderboard-empty-panel">
                  <div className="leaderboard-panel-header"><span>Stealing</span><small>Top wins</small></div>
                  {stealingLeaderboard.length === 0 ? <p>No entries yet.</p> : <ol className="leaderboard-page-list">{stealingLeaderboard.map((entry) => <li key={entry.id}><span>{entry.username}</span><strong>{entry.win}</strong></li>)}</ol>}
                </section>
                <section className="leaderboard-panel leaderboard-empty-panel">
                  <div className="leaderboard-panel-header"><span>Don't Connect Four</span><small>Top wins</small></div>
                  {antiConnectLeaderboard.length === 0 ? <p>No entries yet.</p> : <ol className="leaderboard-page-list">{antiConnectLeaderboard.map((entry) => <li key={entry.id}><span>{entry.username}</span><strong>{entry.win}</strong></li>)}</ol>}
                </section>
              </div>
            </div>
          </section>
        )}

        {view === 'profile' && user && (
          <section className="profile-page">
            <div className="profile-page-header">
              <button className="text-link-btn" onClick={() => setView('home')}>Back to modes</button>
              <span className="mode-home-kicker">Player profile</span>
            </div>
            <div className="profile-identity">
              <div className="profile-avatar" aria-label={`${user.username} profile picture`}>
                {user.username.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h2>{user.username}</h2>
                <p>{user.email}</p>
                <span className="profile-status"><span className="signed-in-dot" /> Signed in</span>
              </div>
            </div>
            <div className="profile-stat-grid">
              <div className="profile-stat-card profile-stat-featured"><small>Total wins</small><strong>{getProfileWins(user, [leaderboard, tripleLeaderboard, stealingLeaderboard, antiConnectLeaderboard])}</strong><span>Across all modes</span></div>
              <div className="profile-stat-card"><small>Win rate</small><strong>{getProfileWinRate(user, [leaderboard, tripleLeaderboard, stealingLeaderboard, antiConnectLeaderboard]) ?? '--'}{getProfileWinRate(user, [leaderboard, tripleLeaderboard, stealingLeaderboard, antiConnectLeaderboard]) === null ? '' : '%'}</strong><span>Across all recorded games</span></div>
              <div className="profile-stat-card"><small>Favorite mode</small><strong>{getFavoriteMode(user, [leaderboard, tripleLeaderboard, stealingLeaderboard, antiConnectLeaderboard])}</strong><span>Based on recorded wins</span></div>
            </div>
            <div className="profile-modes-header"><h3>Wins by gamemode</h3><span>Recorded wins</span></div>
            <div className="profile-mode-grid">
              {([
                ['Classic', leaderboard],
                ['Triple', tripleLeaderboard],
                ['Stealing', stealingLeaderboard],
                ["Don't Connect Four", antiConnectLeaderboard],
              ] as Array<[string, LeaderboardEntry[]]>).map(([label, entries]) => (
                <div className="profile-mode-stat" key={label}><span>{label}</span><strong>{getUserWins(user, entries)}</strong><small>{getUserGames(user, entries)} games · {getUserGames(user, entries) > 0 ? Math.round((getUserWins(user, entries) / getUserGames(user, entries)) * 100) : 0}% win rate</small></div>
              ))}
            </div>
          </section>
        )}

        {view === 'game' && (
          <div className="main-layout">
            <Game user={user ?? undefined} initialMode={selectedMode} onBackHome={() => setView('home')} />
            <aside className="app-sidebar">
              <div className="player-card" role="button" tabIndex={0} onClick={openProfile} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') openProfile() }}>
                <div className="avatar-badge">{user?.username?.slice(0, 2).toUpperCase() || 'PL'}</div>
                <h3>{user?.username || 'Player'}</h3>
                <p>{user?.email || 'Signed in and ready to play'}</p>
                <button className="sidebar-signout" onClick={(event) => { event.stopPropagation(); handleSignOut() }}>Sign Out</button>
              </div>
            </aside>
          </div>
        )}

        {view === 'admin' && (
          <Admin onBackHome={() => setView('home')} onUnauthorized={() => setView('admin-login')} />
        )}
      </main>
    </div>
  )
}
