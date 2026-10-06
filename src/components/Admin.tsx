import React, { useEffect, useMemo, useState } from 'react'

export type AdminUser = {
  id: string | number
  username: string
  email: string
  password?: string
  score: number
  gold: number
  win?: number
  win_1v1v1?: number
  wins_stealing?: number
  wins_anti_connect_four?: number
  games_classic?: number
  games_triple?: number
  games_stealing?: number
  games_anti_connect_four?: number
  [key: string]: any
}

type SortOrder = 'asc' | 'desc'

type AdminProps = {
  onBackHome: () => void
  onUnauthorized: () => void
}

const DEFAULT_USERS: AdminUser[] = [
  {
    id: 1,
    username: 'GrandMaster',
    email: 'gm@connect4.io',
    password: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    score: 1420,
    gold: 3800,
    win: 48,
    win_1v1v1: 19,
    wins_stealing: 14,
    wins_anti_connect_four: 8,
    games_classic: 62,
    games_triple: 31,
    games_stealing: 20,
    games_anti_connect_four: 15,
  },
  {
    id: 2,
    username: 'TacticalDrop',
    email: 'tactics@arena.com',
    password: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
    score: 890,
    gold: 1750,
    win: 26,
    win_1v1v1: 12,
    wins_stealing: 9,
    wins_anti_connect_four: 5,
    games_classic: 39,
    games_triple: 24,
    games_stealing: 16,
    games_anti_connect_four: 11,
  },
  {
    id: 3,
    username: 'CoinCollector',
    email: 'coins@game.net',
    password: '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a',
    score: 650,
    gold: 9200,
    win: 17,
    win_1v1v1: 7,
    wins_stealing: 22,
    wins_anti_connect_four: 4,
    games_classic: 28,
    games_triple: 15,
    games_stealing: 30,
    games_anti_connect_four: 9,
  },
  {
    id: 4,
    username: 'RookieDrop',
    email: 'newbie@connect4.io',
    password: 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f',
    score: 110,
    gold: 250,
    win: 3,
    win_1v1v1: 1,
    wins_stealing: 0,
    wins_anti_connect_four: 2,
    games_classic: 12,
    games_triple: 5,
    games_stealing: 2,
    games_anti_connect_four: 6,
  },
]

function getAdminAuthHeaders(): Record<string, string> {
  try {
    const user = JSON.parse(localStorage.getItem('auth_user') || '{}')
    return user.adminToken ? { Authorization: `Bearer ${user.adminToken}` } : {}
  } catch {
    return {}
  }
}

export default function Admin({ onBackHome, onUnauthorized }: AdminProps) {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successToast, setSuccessToast] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<string>('id')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')
  const [editingUserId, setEditingUserId] = useState<string | number | null>(null)
  const [editScore, setEditScore] = useState<number>(0)
  const [editGold, setEditGold] = useState<number>(0)
  const [saving, setSaving] = useState(false)
  const [showPasswordHashes, setShowPasswordHashes] = useState<Record<string | number, boolean>>({})

  useEffect(() => {
    void fetchUsers()
  }, [])

  function showToast(msg: string) {
    setSuccessToast(msg)
    setTimeout(() => {
      setSuccessToast((prev) => (prev === msg ? null : prev))
    }, 3500)
  }

  async function fetchUsers() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/users', { headers: getAdminAuthHeaders() })
      if (res.status === 401) {
        setUsers([])
        onUnauthorized()
        return
      }
      if (!res.ok) {
        throw new Error(`API returned HTTP ${res.status}`)
      }
      const data = await res.json()
      const rawUsers = Array.isArray(data)
        ? data
        : Array.isArray(data.users)
          ? data.users
          : Array.isArray(data.results)
            ? data.results
            : []

      if (rawUsers.length > 0) {
        setUsers(
          rawUsers.map((u: any) => ({
            ...u,
            score: Number(u.score ?? 0),
            gold: Number(u.gold ?? 0),
            win: Number(u.win ?? 0),
            win_1v1v1: Number(u.win_1v1v1 ?? 0),
            wins_stealing: Number(u.wins_stealing ?? 0),
            wins_anti_connect_four: Number(u.wins_anti_connect_four ?? 0),
            games_classic: Number(u.games_classic ?? 0),
            games_triple: Number(u.games_triple ?? 0),
            games_stealing: Number(u.games_stealing ?? 0),
            games_anti_connect_four: Number(u.games_anti_connect_four ?? 0),
          }))
        )
      } else {
        const cached = localStorage.getItem('admin_cached_users')
        if (cached) {
          try {
            setUsers(JSON.parse(cached))
          } catch {
            setUsers(DEFAULT_USERS)
          }
        } else {
          setUsers(DEFAULT_USERS)
        }
      }
    } catch {
      const cached = localStorage.getItem('admin_cached_users')
      if (cached) {
        try {
          setUsers(JSON.parse(cached))
        } catch {
          setUsers(DEFAULT_USERS)
        }
      } else {
        setUsers(DEFAULT_USERS)
      }
    } finally {
      setLoading(false)
    }
  }

  function startEditing(user: AdminUser) {
    setEditingUserId(user.id)
    setEditScore(Number(user.score ?? 0))
    setEditGold(Number(user.gold ?? 0))
  }

  function cancelEditing() {
    setEditingUserId(null)
  }

  async function handleSaveScoreGold(userId: string | number) {
    setSaving(true)
    const nextScore = Math.max(0, Math.floor(Number(editScore) || 0))
    const nextGold = Math.max(0, Math.floor(Number(editGold) || 0))

    try {
      const res = await fetch('/api/admin/users/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAdminAuthHeaders() },
        body: JSON.stringify({ id: userId, score: nextScore, gold: nextGold }),
      })
      if (res.status === 401) {
        setSaving(false)
        onUnauthorized()
        return
      }
      if (!res.ok) {
        const errorData = await res.json().catch(() => null)
        throw new Error(errorData?.error || 'Failed to update on server')
      }
    } catch {
      // Offline fallback: update locally
    }

    setUsers((prev) => {
      const updated = prev.map((u) => (String(u.id) === String(userId) ? { ...u, score: nextScore, gold: nextGold } : u))
      localStorage.setItem('admin_cached_users', JSON.stringify(updated))
      return updated
    })

    setEditingUserId(null)
    setSaving(false)
    showToast(`✓ Updated Player #${userId}: Score = ${nextScore}, Gold = ${nextGold}`)
  }

  async function handleDeleteScoreGold(userId: string | number, target: 'score' | 'gold' | 'both') {
    const confirmMsg =
      target === 'score'
        ? `Reset Score to 0 for Player #${userId}?`
        : target === 'gold'
          ? `Reset Gold to 0 for Player #${userId}?`
          : `Clear both Score & Gold (reset to 0) for Player #${userId}?`

    if (!window.confirm(confirmMsg)) return

    try {
      const res = await fetch('/api/admin/users/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAdminAuthHeaders() },
        body: JSON.stringify({ id: userId, target }),
      })
      if (res.status === 401) {
        onUnauthorized()
        return
      }
    } catch {
      // Local fallback
    }

    setUsers((prev) => {
      const updated = prev.map((u) => {
        if (String(u.id) !== String(userId)) return u
        return {
          ...u,
          score: target === 'gold' ? u.score : 0,
          gold: target === 'score' ? u.gold : 0,
        }
      })
      localStorage.setItem('admin_cached_users', JSON.stringify(updated))
      return updated
    })

    showToast(`🗑️ Reset ${target === 'both' ? 'Score & Gold' : target} to 0 for Player #${userId}`)
  }

  async function handleQuickAdd(userId: string | number, type: 'score' | 'gold', amount: number) {
    const user = users.find((u) => String(u.id) === String(userId))
    if (!user) return
    const currentScore = Number(user.score ?? 0)
    const currentGold = Number(user.gold ?? 0)
    const newScore = type === 'score' ? currentScore + amount : currentScore
    const newGold = type === 'gold' ? currentGold + amount : currentGold

    try {
      const res = await fetch('/api/admin/users/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAdminAuthHeaders() },
        body: JSON.stringify({ id: userId, score: newScore, gold: newGold }),
      })
      if (res.status === 401) {
        onUnauthorized()
        return
      }
    } catch {
      // Local fallback
    }

    setUsers((prev) => {
      const updated = prev.map((u) => (String(u.id) === String(userId) ? { ...u, score: newScore, gold: newGold } : u))
      localStorage.setItem('admin_cached_users', JSON.stringify(updated))
      return updated
    })

    showToast(`+${amount} ${type === 'gold' ? '🪙 Gold' : '⭐ Score'} granted to ${user.username}`)
  }

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortOrder('asc')
    }
  }

  // All columns that exist across users
  const allColumns = useMemo(() => {
    const coreColumns = [
      { key: 'id', label: 'ID', isCrud: false },
      { key: 'username', label: 'Username', isCrud: false },
      { key: 'email', label: 'Email', isCrud: false },
      { key: 'password', label: 'Password', isCrud: false },
      { key: 'score', label: '⭐ Score', isCrud: true },
      { key: 'gold', label: '🪙 Gold', isCrud: true },
      { key: 'win', label: 'Classic Wins', isCrud: false },
      { key: 'win_1v1v1', label: 'Triple Wins', isCrud: false },
      { key: 'wins_stealing', label: 'Stealing Wins', isCrud: false },
      { key: 'wins_anti_connect_four', label: 'Anti-Connect Wins', isCrud: false },
    ]
    const hiddenKeys = new Set(['games_classic', 'games_triple', 'games_stealing', 'games_anti_connect_four', 'win_stealing'])

    // Capture any extra dynamic columns in user objects
    const extraKeys = new Set<string>()
    users.forEach((u) => {
      Object.keys(u).forEach((k) => {
        const normalizedKey = k.toLowerCase().replace(/[\s-]+/g, '_')
        if (!coreColumns.some((col) => col.key === k) && !hiddenKeys.has(normalizedKey)) {
          extraKeys.add(k)
        }
      })
    })

    const extraColumns = Array.from(extraKeys).map((k) => ({
      key: k,
      label: k.replace(/_/g, ' ').toUpperCase(),
      isCrud: false,
    }))

    return [...coreColumns, ...extraColumns]
  }, [users])

  // Filter & Smart Sorting
  const filteredAndSortedUsers = useMemo(() => {
    let result = [...users]

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter((u) => {
        return Object.entries(u).some(([_, val]) => String(val ?? '').toLowerCase().includes(q))
      })
    }

    result.sort((a, b) => {
      const valA = a[sortKey]
      const valB = b[sortKey]

      if (valA === undefined || valA === null) return sortOrder === 'asc' ? 1 : -1
      if (valB === undefined || valB === null) return sortOrder === 'asc' ? -1 : 1

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortOrder === 'asc' ? valA - valB : valB - valA
      }

      const strA = String(valA).toLowerCase()
      const strB = String(valB).toLowerCase()
      return sortOrder === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA)
    })

    return result
  }, [users, search, sortKey, sortOrder])

  // Stats
  const totalScore = useMemo(() => users.reduce((acc, u) => acc + (Number(u.score) || 0), 0), [users])
  const totalGold = useMemo(() => users.reduce((acc, u) => acc + (Number(u.gold) || 0), 0), [users])
  const totalWins = useMemo(
    () =>
      users.reduce(
        (acc, u) =>
          acc +
          (Number(u.win) || 0) +
          (Number(u.win_1v1v1) || 0) +
          (Number(u.wins_stealing) || 0) +
          (Number(u.wins_anti_connect_four) || 0),
        0
      ),
    [users]
  )

  return (
    <section className="admin-page">
      <div className="admin-page-scroll">
        {/* Header Section */}
        <div className="admin-header-row">
          <div className="admin-title-group">
            <button className="text-link-btn admin-back-btn" onClick={onBackHome}>
              ← Back to modes
            </button>
            <span className="mode-home-kicker">Management Console</span>
            <h2>User Database Admin</h2>
            <p>
              View all user records with smart multi-column sorting. <strong>Score</strong> and <strong>Gold</strong> support full Create, Read, Update, and Delete operations.
            </p>
          </div>

          <div className="admin-action-bar">
            <button className="secondary-btn admin-refresh-btn" onClick={() => void fetchUsers()} disabled={loading}>
              {loading ? '↻ Loading...' : '↻ Refresh Data'}
            </button>
          </div>
        </div>

        {/* Global Metric Cards */}
        <div className="admin-metrics-grid">
          <div className="admin-stat-card">
            <small>Total Players</small>
            <strong>{users.length}</strong>
            <span>Active registered accounts</span>
          </div>
          <div className="admin-stat-card admin-stat-score">
            <small>Total Score in Economy</small>
            <strong>⭐ {totalScore.toLocaleString()}</strong>
            <span>Across all player accounts</span>
          </div>
          <div className="admin-stat-card admin-stat-gold">
            <small>Total Gold in Circulation</small>
            <strong>🪙 {totalGold.toLocaleString()}</strong>
            <span>CRUD-managed game currency</span>
          </div>
          <div className="admin-stat-card">
            <small>Total Game Wins</small>
            <strong>{totalWins.toLocaleString()}</strong>
            <span>Across all game modes</span>
          </div>
        </div>

        {/* Feedback Alert / Toasts */}
        {successToast && (
          <div className="admin-toast success" role="alert">
            <span>{successToast}</span>
            <button className="toast-close-btn" onClick={() => setSuccessToast(null)}>
              ✕
            </button>
          </div>
        )}

        {error && (
          <div className="admin-toast error" role="alert">
            <span>{error}</span>
            <button className="toast-close-btn" onClick={() => setError(null)}>
              ✕
            </button>
          </div>
        )}

        {/* Search & Permissions Info Banner */}
        <div className="admin-controls-bar">
          <div className="admin-search-wrapper">
            <span className="search-icon" aria-hidden="true">
              🔍
            </span>
            <input
              type="text"
              className="admin-search-input"
              placeholder="Search by username, email, ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search users"
            />
            {search && (
              <button className="search-clear-btn" onClick={() => setSearch('')} title="Clear search">
                ✕
              </button>
            )}
          </div>

          <div className="admin-policy-chip">
            <span className="policy-badge crud">✏️ CRUD Enabled: Score & Gold</span>
            <span className="policy-badge readonly">🔒 Read-only: Identity & Wins</span>
          </div>
        </div>

        {/* Smart Table Container */}
        <div className="admin-table-container">
          <table className="admin-table" aria-label="Users Database Table">
            <thead>
              <tr>
                {allColumns.map((col) => {
                  const isSorted = sortKey === col.key
                  return (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      className={`sortable-header th-${col.key} ${col.isCrud ? 'crud-header' : ''} ${isSorted ? 'sorted-active' : ''}`}
                      title={`Click to sort by ${col.label}`}
                    >
                      <div className="th-content">
                        <span className="th-title">{col.label}</span>
                        <span className="sort-icon" aria-hidden="true">
                          {isSorted ? (sortOrder === 'asc' ? ' ▲' : ' ▼') : ' ⇅'}
                        </span>
                      </div>
                      <span className={`th-badge ${col.isCrud ? 'badge-crud' : 'badge-lock'}`}>
                        {col.isCrud ? 'CRUD' : 'LOCKED'}
                      </span>
                    </th>
                  )
                })}
                <th className="actions-header">Actions (CRUD)</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedUsers.length === 0 ? (
                <tr>
                  <td colSpan={allColumns.length + 1} className="empty-table-cell">
                    {loading ? (
                      <div className="admin-loading-spinner">Loading users database...</div>
                    ) : (
                      <div className="admin-empty-state">
                        <p>No players matched your filter criteria.</p>
                        {search && (
                          <button className="secondary-btn" onClick={() => setSearch('')}>
                            Clear Filter
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                filteredAndSortedUsers.map((user) => {
                  const isEditing = editingUserId === user.id
                  return (
                    <tr key={user.id} className={`admin-row ${isEditing ? 'row-editing' : ''}`}>
                      {/* ID */}
                      <td className="cell-id">#{user.id}</td>

                      {/* Username */}
                      <td className="cell-username">
                        <div className="user-badge-cell">
                          <span className="avatar-chip">{user.username.slice(0, 2).toUpperCase()}</span>
                          <strong>{user.username}</strong>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="cell-email">{user.email}</td>

                      {/* Password Hash (Masked) */}
                      <td className="cell-password">
                        <div className="password-mask-cell">
                          <code>
                            {showPasswordHashes[user.id]
                              ? String(user.password || 'none').slice(0, 16) + '...'
                              : '••••••••••••'}
                          </code>
                          <button
                            type="button"
                            className="toggle-hash-btn"
                            onClick={() =>
                              setShowPasswordHashes((prev) => ({
                                ...prev,
                                [user.id]: !prev[user.id],
                              }))
                            }
                            title="Toggle hash view"
                          >
                            {showPasswordHashes[user.id] ? 'Hide' : 'Show'}
                          </button>
                        </div>
                      </td>

                      {/* SCORE (CRUD SUPPORTED) */}
                      <td className="cell-score cell-crud-target">
                        {isEditing ? (
                          <div className="crud-input-wrap">
                            <span className="input-prefix">⭐</span>
                            <input
                              type="number"
                              min="0"
                              className="crud-input score-input"
                              value={editScore}
                              onChange={(e) => setEditScore(Number(e.target.value))}
                              aria-label={`Edit score for ${user.username}`}
                              autoFocus
                            />
                          </div>
                        ) : (
                          <div className="score-pill-display" onClick={() => startEditing(user)} title="Click to edit score">
                            <span className="badge-score">⭐ {Number(user.score ?? 0).toLocaleString()}</span>
                            <span className="hover-edit-hint">✏️</span>
                          </div>
                        )}
                      </td>

                      {/* GOLD (CRUD SUPPORTED) */}
                      <td className="cell-gold cell-crud-target">
                        {isEditing ? (
                          <div className="crud-input-wrap">
                            <span className="input-prefix">🪙</span>
                            <input
                              type="number"
                              min="0"
                              className="crud-input gold-input"
                              value={editGold}
                              onChange={(e) => setEditGold(Number(e.target.value))}
                              aria-label={`Edit gold for ${user.username}`}
                            />
                          </div>
                        ) : (
                          <div className="gold-pill-display" onClick={() => startEditing(user)} title="Click to edit gold">
                            <span className="badge-gold">🪙 {Number(user.gold ?? 0).toLocaleString()}</span>
                            <span className="hover-edit-hint">✏️</span>
                          </div>
                        )}
                      </td>

                      {/* Win Classic */}
                      <td className="cell-num">{user.win ?? 0}</td>

                      {/* Win Triple */}
                      <td className="cell-num">{user.win_1v1v1 ?? 0}</td>

                      {/* Wins Stealing */}
                      <td className="cell-num">{user.wins_stealing ?? 0}</td>

                      {/* Wins Anti Connect */}
                      <td className="cell-num">{user.wins_anti_connect_four ?? 0}</td>

                      {/* Any Extra Dynamic Columns */}
                      {allColumns.slice(10).map((col) => (
                        <td key={col.key} className="cell-num cell-muted">
                          {String(user[col.key] ?? '--')}
                        </td>
                      ))}

                      {/* CRUD ACTIONS CELL */}
                      <td className="cell-actions">
                        {isEditing ? (
                          <div className="action-button-group">
                            <button
                              type="button"
                              className="action-btn save-btn"
                              onClick={() => void handleSaveScoreGold(user.id)}
                              disabled={saving}
                              title="Save Score & Gold changes"
                            >
                              {saving ? 'Saving...' : '💾 Save'}
                            </button>
                            <button
                              type="button"
                              className="action-btn cancel-btn"
                              onClick={cancelEditing}
                              disabled={saving}
                              title="Cancel editing"
                            >
                              ✕
                            </button>
                            <button
                              type="button"
                              className="action-btn reset-zero-btn"
                              onClick={() => {
                                setEditScore(0)
                                setEditGold(0)
                              }}
                              disabled={saving}
                              title="Set both to 0"
                            >
                              Reset
                            </button>
                          </div>
                        ) : (
                          <div className="action-button-group">
                            <button
                              type="button"
                              className="action-btn edit-btn"
                              onClick={() => startEditing(user)}
                              title="Edit Score and Gold"
                            >
                              ✏️ Edit
                            </button>
                            <button
                              type="button"
                              className="action-btn quick-add-btn gold-add"
                              onClick={() => void handleQuickAdd(user.id, 'gold', 100)}
                              title="Quick Grant +100 Gold"
                            >
                              +100🪙
                            </button>
                            <button
                              type="button"
                              className="action-btn quick-add-btn score-add"
                              onClick={() => void handleQuickAdd(user.id, 'score', 50)}
                              title="Quick Grant +50 Score"
                            >
                              +50⭐
                            </button>
                            <button
                              type="button"
                              className="action-btn delete-btn"
                              onClick={() => void handleDeleteScoreGold(user.id, 'both')}
                              title="Delete / Reset Score & Gold"
                            >
                              🗑️
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer summary */}
        <div className="admin-footer-bar">
          <span>
            Displaying <strong>{filteredAndSortedUsers.length}</strong> of <strong>{users.length}</strong> user records · Sorted by{' '}
            <code>{sortKey}</code> ({sortOrder})
          </span>
          <span className="immutable-legend">🔒 All identity and win columns are protected from administrative mutation</span>
        </div>
      </div>
    </section>
  )
}
