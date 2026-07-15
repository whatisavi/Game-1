import crypto from 'node:crypto'
import { describe, expect, it } from 'vitest'
import worker from './worker'

class MockDb {
  users: Array<{ id: string; username: string; email: string; password: string; win?: number }> = []
  columns = ['id', 'username', 'email']

  prepare(sql: string) {
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
              win: 0,
            })
          }
        })
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

    return {
      bind: () => ({
        run: async () => ({})
      })
    }
  }
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
})
