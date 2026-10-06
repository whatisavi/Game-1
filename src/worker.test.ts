import crypto from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { createAdminToken } from './lib/adminAuth'
import worker from './worker'

class MockDb {
  users: Array<{ id: string; username: string; email: string; password: string; isAdmin?: number; score?: number; gold?: number; win?: number; win_1v1v1?: number; wins_stealing?: number; wins_anti_connect_four?: number; games_classic?: number; games_triple?: number; games_stealing?: number; games_anti_connect_four?: number }> = []
  columns = ['id', 'username', 'email', 'password', 'isAdmin', 'score', 'gold', 'win_1v1v1', 'wins_stealing', 'wins_anti_connect_four', 'games_classic', 'games_triple', 'games_stealing', 'games_anti_connect_four']
  queries: string[] = []

  prepare(sql: string) {
    this.queries.push(sql)
    if (sql.includes('CREATE TABLE')) {
      return {
        run: async () => ({})
      }
    }

    if (sql.includes('PRAGMA table_info')) {
      return {
        all: async () => this.columns.map((name) => ({ name }))
      }
    }

    if (sql.includes('INSERT INTO users')) {
      return {
        bind: (...values: string[]) => ({
          run: async () => {
            this.users.push({
              id: values[0],
              username: values[1],
              email: values[2],
              password: values[3],
              isAdmin: 0,
              score: 0,
              gold: 0,
              win: 0,
              win_1v1v1: 0,
              wins_stealing: 0,
              wins_anti_connect_four: 0,
              games_classic: 0,
              games_triple: 0,
              games_stealing: 0,
              games_anti_connect_four: 0,
            })
          }
        })
      }
    }

    if (sql.includes('SELECT 1 FROM users')) {
      return {
        first: async () => this.users[0] || null
      }
    }

    if (sql.includes('SELECT password FROM users')) {
      return {
        first: async () => this.users[0] || null
      }
    }


    if (sql.includes('SELECT win FROM users')) {
      return {
        first: async () => this.users[0] || null
      }
    }

    if (sql.includes('SELECT win_1v1v1 FROM users')) {
      return {
        first: async () => this.users[0] || null
      }
    }

    if (sql.includes('SELECT wins_stealing FROM users') || sql.includes('SELECT wins_anti_connect_four FROM users')) {
      return {
        first: async () => this.users[0] || null
      }
    }

    if (sql.includes('SELECT games_')) {
      return {
        first: async () => this.users[0] || null
      }
    }

    if (sql.includes('UPDATE users SET games_')) {
      return {
        bind: (...values: string[]) => ({
          run: async () => {
            const [firstValue, secondValue] = values
            const user = this.users.find((entry) => entry.id === firstValue || entry.username === firstValue || entry.email === firstValue)
            const gamesField = sql.includes('games_triple') ? 'games_triple' : sql.includes('games_stealing') ? 'games_stealing' : sql.includes('games_anti_connect_four') ? 'games_anti_connect_four' : 'games_classic'
            const winField = sql.includes('win_1v1v1') ? 'win_1v1v1' : sql.includes('wins_stealing') ? 'wins_stealing' : sql.includes('wins_anti_connect_four') ? 'wins_anti_connect_four' : 'win'
            if (user) {
              user[gamesField] = (user[gamesField] ?? 0) + 1
              if (sql.includes(`${winField} = ${winField} + 1`)) user[winField] = (user[winField] ?? 0) + 1
            }
            if (!user && secondValue) {
              const fallbackUser = this.users.find((entry) => entry.username === secondValue || entry.email === secondValue)
              if (fallbackUser) {
                fallbackUser[gamesField] = (fallbackUser[gamesField] ?? 0) + 1
                if (sql.includes(`${winField} = ${winField} + 1`)) fallbackUser[winField] = (fallbackUser[winField] ?? 0) + 1
              }
            }
            return { meta: { changes: user ? 1 : 0 } }
          }
        })
      }
    }

    if (sql.includes('UPDATE users SET win_1v1v1')) {
      return {
        bind: (...values: string[]) => ({
          run: async () => {
            const [firstValue, secondValue] = values
            const user = this.users.find((entry) => entry.id === firstValue || entry.username === firstValue || entry.email === firstValue)
            if (user) user.win_1v1v1 = (user.win_1v1v1 ?? 0) + 1
            if (!user && secondValue) {
              const fallbackUser = this.users.find((entry) => entry.username === secondValue || entry.email === secondValue)
              if (fallbackUser) fallbackUser.win_1v1v1 = (fallbackUser.win_1v1v1 ?? 0) + 1
            }
            return { meta: { changes: user ? 1 : 0 } }
          }
        })
      }
    }

    if (sql.includes('UPDATE users SET win')) {
      return {
        bind: (...values: string[]) => ({
          run: async () => {
            const [firstValue, secondValue] = values
            const user = this.users.find((entry) => entry.id === firstValue || entry.username === firstValue || entry.email === firstValue)
            if (user) {
              user.win = (user.win ?? 0) + 1
            }
            if (!user && secondValue) {
              const fallbackUser = this.users.find((entry) => entry.username === secondValue || entry.email === secondValue)
              if (fallbackUser) {
                fallbackUser.win = (fallbackUser.win ?? 0) + 1
              }
            }
            return { meta: { changes: user ? 1 : 0 } }
          }
        })
      }
    }

    if (sql.includes('SELECT id, username, email, password')) {
      return {
        bind: (...values: string[]) => ({
          first: async () => {
            const [loginIdentifier] = values
            return this.users.find((user) => user.username === loginIdentifier || user.email === loginIdentifier) || null
          }
        })
      }
    }

    if (sql.includes('SELECT password, isAdmin FROM users WHERE id')) {
      return {
        bind: (...values: string[]) => ({
          first: async () => this.users.find((user) => String(user.id) === String(values[0])) || null
        })
      }
    }


    if (sql.includes('SELECT id, username, email, win') || sql.includes('SELECT id, username, email, wins_stealing') || sql.includes('SELECT id, username, email, wins_anti_connect_four') || sql.includes('SELECT * FROM Users ORDER BY "win" DESC')) {
      return {
        all: async () => [...this.users]
          .sort((a, b) => {
            const field = sql.includes('win_1v1v1') ? 'win_1v1v1' : sql.includes('wins_stealing') ? 'wins_stealing' : sql.includes('wins_anti_connect_four') ? 'wins_anti_connect_four' : 'win'
            return (b[field] ?? 0) - (a[field] ?? 0)
          })
          .map((entry) => {
            const field = sql.includes('win_1v1v1') ? 'win_1v1v1' : sql.includes('wins_stealing') ? 'wins_stealing' : sql.includes('wins_anti_connect_four') ? 'wins_anti_connect_four' : 'win'
            const gamesField = sql.includes('games_triple') ? 'games_triple' : sql.includes('games_stealing') ? 'games_stealing' : sql.includes('games_anti_connect_four') ? 'games_anti_connect_four' : 'games_classic'
            return { id: entry.id, username: entry.username, [field]: entry[field] ?? 0, [gamesField]: entry[gamesField] ?? 0 }
          })
      }
    }

    if (sql.includes('SELECT score FROM users') || sql.includes('SELECT gold FROM users')) {
      return {
        first: async () => this.users[0] || null
      }
    }

    if (sql.includes('SELECT * FROM users WHERE id = ?')) {
      return {
        bind: (...values: any[]) => ({
          first: async () => this.users.find((u) => String(u.id) === String(values[0])) || null
        })
      }
    }

    if (sql.includes('SELECT * FROM users')) {
      return {
        all: async () => [...this.users]
      }
    }

    if (sql.includes('UPDATE users SET') && (sql.includes('score') || sql.includes('gold'))) {
      return {
        bind: (...values: any[]) => ({
          run: async () => {
            const userId = String(values[values.length - 1] ?? '')
            const user = this.users.find((u) => String(u.id) === userId)
            if (user) {
              if (sql.includes('score = ?') && sql.includes('gold = ?')) {
                user.score = Number(values[0])
                user.gold = Number(values[1])
              } else if (sql.includes('score = ?')) {
                user.score = Number(values[0])
              } else if (sql.includes('gold = ?')) {
                user.gold = Number(values[0])
              } else if (sql.includes('score = 0') && sql.includes('gold = 0')) {
                user.score = 0
                user.gold = 0
              } else if (sql.includes('score = 0')) {
                user.score = 0
              } else if (sql.includes('gold = 0')) {
                user.gold = 0
              }
            }
            return { meta: { changes: user ? 1 : 0 } }
          }
        })
      }
    }

    return {
      bind: () => ({
        run: async () => ({})
      })
    }
  }
}

async function adminAuthHeader(db: MockDb): Promise<Record<string, string>> {
  const adminUser = db.users[0]
  adminUser.isAdmin = 1
  return { Authorization: `Bearer ${await createAdminToken(adminUser.id, adminUser.password)}` }
}

describe('worker auth routes', () => {
  it('handles signup requests on /api/signup even when the existing table is missing the password column', async () => {
    const db = new MockDb()
    db.columns = ['id', 'username', 'email']

    const request = new Request('http://localhost/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'bob', email: 'bob@example.com', password: 'secret123' }),
    })

    const response = await worker.fetch(request, { DB: db as any })
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.username).toBe('bob')
    expect(body.email).toBe('bob@example.com')
  })

  it('handles signup requests on /api/signup', async () => {
    const db = new MockDb()
    const request = new Request('http://localhost/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'alice', email: 'alice@example.com', password: 'secret123' }),
    })

    const response = await worker.fetch(request, { DB: db as any })
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.username).toBe('alice')
    expect(body.email).toBe('alice@example.com')
  })

  it('issues an admin token only when isAdmin is true', async () => {
    const db = new MockDb()
    const passwordHash = crypto.createHash('sha256').update('secret123').digest('hex')
    db.users.push({ id: '1', username: 'admin', email: 'admin@example.com', password: passwordHash, isAdmin: 1 })

    const response = await worker.fetch(new Request('http://localhost/api/signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'secret123' }),
    }), { DB: db as any })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.isAdmin).toBe(true)
    expect(typeof body.adminToken).toBe('string')
    expect(db.users).toHaveLength(1)
  })

  it('handles signin requests on /api/signin', async () => {
    const db = new MockDb()
    const request = new Request('http://localhost/api/signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'alice', password: 'secret123' }),
    })

    const passwordHash = crypto.createHash('sha256').update('secret123').digest('hex')
    await db.prepare('INSERT INTO users').bind('1', 'alice', 'alice@example.com', passwordHash).run()
    const response = await worker.fetch(request, { DB: db as any })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.username).toBe('alice')
    expect(body.email).toBe('alice@example.com')
    expect(body.isAdmin).toBe(false)
    expect(body.adminToken).toBeUndefined()
  })

  it('increments a user win count on /api/game/win', async () => {
    const db = new MockDb()
    await db.prepare('INSERT INTO users').bind('1', 'alice', 'alice@example.com', 'hashed').run()

    const request = new Request('http://localhost/api/game/win', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: '1' }),
    })

    const response = await worker.fetch(request, { DB: db as any })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.wins).toBe(1)
    expect(db.users[0].win).toBe(1)
  })

  it('increments only the 1v1v1 win count for triple mode', async () => {
    const db = new MockDb()
    await db.prepare('INSERT INTO users').bind('1', 'alice', 'alice@example.com', 'hashed').run()

    const request = new Request('http://localhost/api/game/win', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: '1', mode: 'triple' }),
    })

    const response = await worker.fetch(request, { DB: db as any })
    expect(response.status).toBe(200)
    expect(db.users[0].win).toBe(0)
    expect(db.users[0].win_1v1v1).toBe(1)
  })

  it('increments only the stealing win count for stealing mode', async () => {
    const db = new MockDb()
    await db.prepare('INSERT INTO users').bind('1', 'alice', 'alice@example.com', 'hashed').run()

    const response = await worker.fetch(new Request('http://localhost/api/game/win', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: '1', mode: 'stealing' }),
    }), { DB: db as any })

    expect(response.status).toBe(200)
    expect(db.users[0].win).toBe(0)
    expect(db.users[0].wins_stealing).toBe(1)
  })

  it('increments only the anti-connect win count for anti-connect mode', async () => {
    const db = new MockDb()
    await db.prepare('INSERT INTO users').bind('1', 'alice', 'alice@example.com', 'hashed').run()

    const response = await worker.fetch(new Request('http://localhost/api/game/win', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: '1', mode: 'anti-connect' }),
    }), { DB: db as any })

    expect(response.status).toBe(200)
    expect(db.users[0].win).toBe(0)
    expect(db.users[0].wins_anti_connect_four).toBe(1)
  })

  it('returns leaderboard entries sorted by wins descending', async () => {
    const db = new MockDb()
    await db.prepare('INSERT INTO users').bind('1', 'alice', 'alice@example.com', 'hashed').run()
    await db.prepare('INSERT INTO users').bind('2', 'bob', 'bob@example.com', 'hashed').run()
    db.users[0].win = 4
    db.users[1].win = 7

    const request = new Request('http://localhost/api/game/leaderboard', {
      method: 'GET',
    })

    const response = await worker.fetch(request, { DB: db as any })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(db.queries.some((sql) => sql.includes('SELECT id, username, email, win, games_classic FROM users ORDER BY win DESC'))).toBe(true)
    expect(Array.isArray(body.entries)).toBe(true)
    expect(body.entries[0].username).toBe('bob')
    expect(body.entries[0].win).toBe(7)
    expect(body.entries[1].username).toBe('alice')
  })

  it('returns a separate 1v1v1 leaderboard sorted by win_1v1v1', async () => {
    const db = new MockDb()
    await db.prepare('INSERT INTO users').bind('1', 'alice', 'alice@example.com', 'hashed').run()
    await db.prepare('INSERT INTO users').bind('2', 'bob', 'bob@example.com', 'hashed').run()
    db.users[0].win = 20
    db.users[0].win_1v1v1 = 2
    db.users[1].win = 1
    db.users[1].win_1v1v1 = 5

    const response = await worker.fetch(new Request('http://localhost/api/game/leaderboard?mode=triple'), { DB: db as any })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.entries[0]).toEqual({ id: '2', username: 'bob', win: 5, games: 0 })
  })

  it('returns separate stealing and anti-connect leaderboards', async () => {
    const db = new MockDb()
    await db.prepare('INSERT INTO users').bind('1', 'alice', 'alice@example.com', 'hashed').run()
    await db.prepare('INSERT INTO users').bind('2', 'bob', 'bob@example.com', 'hashed').run()
    db.users[0].wins_stealing = 3
    db.users[1].wins_stealing = 8
    db.users[0].wins_anti_connect_four = 6
    db.users[1].wins_anti_connect_four = 2

    const stealingResponse = await worker.fetch(new Request('http://localhost/api/game/leaderboard?mode=stealing'), { DB: db as any })
    const antiConnectResponse = await worker.fetch(new Request('http://localhost/api/game/leaderboard?mode=anti-connect'), { DB: db as any })

    expect((await stealingResponse.json()).entries[0]).toEqual({ id: '2', username: 'bob', win: 8, games: 0 })
    expect((await antiConnectResponse.json()).entries[0]).toEqual({ id: '1', username: 'alice', win: 6, games: 0 })
  })

  it('creates the users table and returns an empty leaderboard when the database is new', async () => {
    const db = {
      queries: [] as string[],
      tableExists: false,
      prepare(sql: string) {
        this.queries.push(sql)

        if (sql.includes('CREATE TABLE users')) {
          this.tableExists = true
          return {
            run: async () => ({})
          }
        }

        if (sql.includes('SELECT win FROM users') || sql.includes('SELECT win_1v1v1 FROM users') || sql.includes('SELECT games_') || sql.includes('SELECT password FROM users') || sql.includes('SELECT 1 FROM users')) {
          if (!this.tableExists) {
            return {
              first: async () => {
                throw new Error('no such table: users')
              }
            }
          }
          return {
            first: async () => null
          }
        }

        if (sql.includes('SELECT id, username, email, win, games_classic FROM users ORDER BY win DESC') || sql.includes('SELECT id, username, email, win_1v1v1, games_triple FROM users ORDER BY win_1v1v1 DESC')) {
          return {
            all: async () => ({ results: [] })
          }
        }

        return {
          bind: () => ({
            run: async () => ({})
          })
        }
      }
    }

    const request = new Request('http://localhost/api/game/leaderboard', {
      method: 'GET',
    })

    const response = await worker.fetch(request, { DB: db as any })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(Array.isArray(body.entries)).toBe(true)
    expect(body.entries).toEqual([])
    expect(db.queries.some((sql) => sql.includes('CREATE TABLE users'))).toBe(true)
  })

  it('increments a user win count using username when no id is provided', async () => {
    const db = new MockDb()
    await db.prepare('INSERT INTO users').bind('2', 'bob', 'bob@example.com', 'hashed').run()

    const request = new Request('http://localhost/api/game/win', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'bob' }),
    })

    const response = await worker.fetch(request, { DB: db as any })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.wins).toBe(1)
    expect(db.users[0].win).toBe(1)
  })

  it('fetches all users with all columns on /api/admin/users', async () => {
    const db = new MockDb()
    await db.prepare('INSERT INTO users').bind('1', 'alice', 'alice@example.com', 'hashed').run()

    const unauthorized = await worker.fetch(new Request('http://localhost/api/admin/users', { method: 'GET' }), { DB: db as any })
    expect(unauthorized.status).toBe(401)

    const request = new Request('http://localhost/api/admin/users', { method: 'GET', headers: await adminAuthHeader(db) })
    const response = await worker.fetch(request, { DB: db as any })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(Array.isArray(body.users)).toBe(true)
    expect(body.users).toHaveLength(1)
    expect(body.users[0]).toHaveProperty('id')
    expect(body.users[0]).toHaveProperty('username', 'alice')
    expect(body.users[0]).toHaveProperty('email', 'alice@example.com')
    expect(body.users[0]).toHaveProperty('score')
    expect(body.users[0]).toHaveProperty('gold')
  })

  it('updates score and gold for a user on /api/admin/users/update', async () => {
    const db = new MockDb()
    await db.prepare('INSERT INTO users').bind('1', 'alice', 'alice@example.com', 'hashed').run()

    const request = new Request('http://localhost/api/admin/users/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await adminAuthHeader(db)) },
      body: JSON.stringify({ id: '1', score: 250, gold: 500 }),
    })
    const response = await worker.fetch(request, { DB: db as any })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(db.users[0].score).toBe(250)
    expect(db.users[0].gold).toBe(500)
  })

  it('rejects updates that do not target score or gold', async () => {
    const db = new MockDb()
    await db.prepare('INSERT INTO users').bind('1', 'alice', 'alice@example.com', 'hashed').run()

    const request = new Request('http://localhost/api/admin/users/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await adminAuthHeader(db)) },
      body: JSON.stringify({ id: '1', username: 'hacked' }),
    })
    const response = await worker.fetch(request, { DB: db as any })
    expect(response.status).toBe(400)
    expect(db.users[0].username).toBe('alice')
  })

  it('resets score and gold to 0 on /api/admin/users/delete', async () => {
    const db = new MockDb()
    await db.prepare('INSERT INTO users').bind('1', 'alice', 'alice@example.com', 'hashed').run()
    db.users[0].score = 300
    db.users[0].gold = 700

    const request = new Request('http://localhost/api/admin/users/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await adminAuthHeader(db)) },
      body: JSON.stringify({ id: '1', target: 'both' }),
    })
    const response = await worker.fetch(request, { DB: db as any })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(db.users[0].score).toBe(0)
    expect(db.users[0].gold).toBe(0)
  })
})
