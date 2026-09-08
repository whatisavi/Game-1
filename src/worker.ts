// Cloudflare Worker entry for handling API requests (signup)
// This file expects a D1 binding named `DB` (see wrangler.toml).

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(password))
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function ensureUsersTable(env: any) {
  try {
    await env.DB.prepare('SELECT 1 FROM users LIMIT 1').first()
  } catch (error: any) {
    const message = String(error?.message || error)
    if (message.includes('no such table: users') || message.includes('has no table named users') || message.includes('no such table')) {
      await env.DB.prepare(`
        CREATE TABLE users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL UNIQUE,
          email TEXT NOT NULL UNIQUE,
          password TEXT,
          win INTEGER DEFAULT 0,
          win_1v1v1 INTEGER DEFAULT 0
        )
      `).run()
      return
    }
    throw error
  }
}

async function ensurePasswordColumn(env: any) {
  await ensureUsersTable(env)
  try {
    await env.DB.prepare('SELECT password FROM users LIMIT 1').first()
  } catch (error: any) {
    const message = String(error?.message || error)
    if (message.includes('no such column: password') || message.includes('has no column named password')) {
      await env.DB.prepare('ALTER TABLE users ADD COLUMN password TEXT').run()
    } else {
      throw error
    }
  }
}

async function ensureWinColumn(env: any) {
  await ensureUsersTable(env)
  try {
    await env.DB.prepare('SELECT win FROM users LIMIT 1').first()
  } catch (error: any) {
    const message = String(error?.message || error)
    if (message.includes('no such column: win') || message.includes('has no column named win')) {
      await env.DB.prepare('ALTER TABLE users ADD COLUMN win INTEGER DEFAULT 0').run()
    } else {
      throw error
    }
  }
}

async function ensureTripleWinColumn(env: any) {
  await ensureUsersTable(env)
  try {
    await env.DB.prepare('SELECT win_1v1v1 FROM users LIMIT 1').first()
  } catch (error: any) {
    const message = String(error?.message || error)
    if (message.includes('no such column: win_1v1v1') || message.includes('has no column named win_1v1v1')) {
      await env.DB.prepare('ALTER TABLE users ADD COLUMN win_1v1v1 INTEGER DEFAULT 0').run()
    } else {
      throw error
    }
  }
}

async function incrementUserWin(env: any, userId: string | null, username?: string, mode: 'classic' | 'triple' = 'classic') {
  await ensureUsersTable(env)
  const column = mode === 'triple' ? 'win_1v1v1' : 'win'
  if (mode === 'triple') await ensureTripleWinColumn(env)
  else await ensureWinColumn(env)

  const target = String(userId || '').trim()
  const loginIdentifier = String(username || '').trim()

  if (target) {
    const result = await env.DB.prepare(`UPDATE users SET ${column} = ${column} + 1 WHERE id = ?`).bind(target).run()
    return Number(result?.meta?.changes ?? 0)
  }

  if (loginIdentifier) {
    const result = await env.DB.prepare(`UPDATE users SET ${column} = ${column} + 1 WHERE username = ? OR email = ?`).bind(loginIdentifier, loginIdentifier).run()
    return Number(result?.meta?.changes ?? 0)
  }

  return 0
}

async function insertUser(env: any, username: string, email: string, passwordHash: string) {
  await ensureUsersTable(env)
  await ensurePasswordColumn(env)
  await ensureWinColumn(env)
  await ensureTripleWinColumn(env)

  try {
    const result = await env.DB.prepare(
      `INSERT INTO users (username, email, password, win, win_1v1v1)
       VALUES (?, ?, ?, 0, 0)`
    ).bind(username, email, passwordHash).run()

    return Number(result?.meta?.last_row_id ?? result?.last_row_id ?? 0)
  } catch (error: any) {
    const message = String(error?.message || error)
    if (message.includes('no such column: password') || message.includes('has no column named password')) {
      await env.DB.prepare('ALTER TABLE users ADD COLUMN password TEXT').run()
      try {
        await env.DB.prepare('ALTER TABLE users ADD COLUMN win INTEGER DEFAULT 0').run()
      } catch {
        // Ignore if the column already exists.
      }
      const result = await env.DB.prepare(
        `INSERT INTO users (username, email, password, win, win_1v1v1)
         VALUES (?, ?, ?, 0, 0)`
      ).bind(username, email, passwordHash).run()
      return Number(result?.meta?.last_row_id ?? result?.last_row_id ?? 0)
    }

    if (message.includes('UNIQUE') || message.includes('already exists') || message.includes('constraint failed')) {
      throw new Error('User already exists')
    }

    throw error
  }
}

export default {
  async fetch(request: Request, env: any) {
    const url = new URL(request.url)
    const isSignupRoute = (url.pathname === '/signup' || url.pathname === '/api/signup') && request.method === 'POST'
    const isSigninRoute = (url.pathname === '/signin' || url.pathname === '/api/signin') && request.method === 'POST'
    const isWinRoute = (url.pathname === '/game/win' || url.pathname === '/api/game/win') && request.method === 'POST'
    const isLeaderboardRoute = (url.pathname === '/game/leaderboard' || url.pathname === '/api/game/leaderboard') && request.method === 'GET'

    if (isSignupRoute) {
      try {
        await ensureUsersTable(env)
        let body: any = {}
        try {
          body = await request.json()
        } catch {
          return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 })
        }

        const { username, email, password } = body || {}
        const cleanUsername = String(username || '').trim()
        const cleanEmail = String(email || '').trim().toLowerCase()

        if (!cleanUsername || !cleanEmail || !password) {
          return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400 })
        }

        const passwordHash = await hashPassword(String(password))

        try {
          const id = await insertUser(env, cleanUsername, cleanEmail, passwordHash)
          return new Response(JSON.stringify({ id, username: cleanUsername, email: cleanEmail }), { status: 201 })
        } catch (e: any) {
          if (e?.message === 'User already exists') {
            return new Response(JSON.stringify({ error: 'User already exists' }), { status: 409 })
          }
          throw e
        }

      } catch (err) {
        return new Response(JSON.stringify({ error: 'Invalid request', details: String(err) }), { status: 400 })
      }
    }

    if (isSigninRoute) {
      try {
        await ensureUsersTable(env)
        let body: any = {}
        try {
          body = await request.json()
        } catch {
          return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 })
        }

        const { username, email, password } = body || {}
        const loginIdentifier = String(username || email || '').trim()

        if (!loginIdentifier || !password) {
          return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400 })
        }

        await ensurePasswordColumn(env)
        await ensureWinColumn(env)

        const user = await env.DB.prepare(
          'SELECT id, username, email, password, win FROM users WHERE username = ?1 OR email = ?2 LIMIT 1'
        )
          .bind(loginIdentifier, loginIdentifier)
          .first()

        if (!user) {
          return new Response(JSON.stringify({ error: 'Invalid username/email or password' }), { status: 401 })
        }

        const submittedPasswordHash = await hashPassword(String(password))
        if (submittedPasswordHash !== user.password) {
          return new Response(JSON.stringify({ error: 'Invalid username/email or password' }), { status: 401 })
        }

        return new Response(JSON.stringify({ id: user.id, username: user.username, email: user.email, wins: user.win ?? 0 }), { status: 200 })
      } catch (err) {
        return new Response(JSON.stringify({ error: 'Invalid request', details: String(err) }), { status: 400 })
      }
    }

    if (isWinRoute) {
      try {
        await ensureUsersTable(env)
        let body: any = {}
        try {
          body = await request.json()
        } catch {
          return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 })
        }

        const userId = String(body?.userId || '').trim()
        const username = String(body?.username || '').trim()
        const email = String(body?.email || '').trim()
          const mode = body?.mode === 'triple' ? 'triple' : 'classic'

        if (!userId && !username && !email) {
          return new Response(JSON.stringify({ error: 'Missing user identifier' }), { status: 400 })
        }

        const changes = await incrementUserWin(env, userId || null, username || email || undefined, mode)
        return new Response(JSON.stringify({ success: true, changed: changes > 0, wins: changes }), { status: 200 })
      } catch (err) {
        return new Response(JSON.stringify({ error: 'Invalid request', details: String(err) }), { status: 400 })
      }
    }

    if (isLeaderboardRoute) {
      try {
        await ensureUsersTable(env)
        const mode = url.searchParams.get('mode') === 'triple' ? 'triple' : 'classic'
        const column = mode === 'triple' ? 'win_1v1v1' : 'win'
        if (mode === 'triple') await ensureTripleWinColumn(env)
        else await ensureWinColumn(env)
        const result = await env.DB.prepare(`SELECT id, username, email, ${column} FROM users ORDER BY ${column} DESC`).all()
        const rows = Array.isArray(result) ? result : Array.isArray(result?.results) ? result.results : []
        const entries = (Array.isArray(rows) ? rows : []).map((row: any) => ({
          id: String(row.id ?? ''),
          username: String(row.username ?? ''),
          win: Number(row[column] ?? 0),
        }))
        return new Response(JSON.stringify({ entries }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      } catch (err) {
        return new Response(JSON.stringify({ error: 'Failed to load leaderboard', details: String(err) }), { status: 500, headers: { 'Content-Type': 'application/json' } })
      }
    }

    return new Response('Not found', { status: 404 })
  }
}
