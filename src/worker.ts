import { createAdminToken, getAdminToken, verifyAdminToken } from './lib/adminAuth'

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
          isAdmin INTEGER NOT NULL DEFAULT 0,
          score INTEGER DEFAULT 0,
          gold INTEGER DEFAULT 0,
          win INTEGER DEFAULT 0,
          win_1v1v1 INTEGER DEFAULT 0,
          wins_stealing INTEGER DEFAULT 0,
          wins_anti_connect_four INTEGER DEFAULT 0,
          games_classic INTEGER DEFAULT 0,
          games_triple INTEGER DEFAULT 0,
          games_stealing INTEGER DEFAULT 0,
          games_anti_connect_four INTEGER DEFAULT 0
        )
      `).run()
      return
    }
    throw error
  }
}

async function ensureScoreColumn(env: any) {
  await ensureUsersTable(env)
  try {
    await env.DB.prepare('SELECT score FROM users LIMIT 1').first()
  } catch (error: any) {
    const message = String(error?.message || error)
    if (message.includes('no such column: score') || message.includes('has no column named score')) {
      await env.DB.prepare('ALTER TABLE users ADD COLUMN score INTEGER DEFAULT 0').run()
    } else {
      throw error
    }
  }
}

async function ensureGoldColumn(env: any) {
  await ensureUsersTable(env)
  try {
    await env.DB.prepare('SELECT gold FROM users LIMIT 1').first()
  } catch (error: any) {
    const message = String(error?.message || error)
    if (message.includes('no such column: gold') || message.includes('has no column named gold')) {
      await env.DB.prepare('ALTER TABLE users ADD COLUMN gold INTEGER DEFAULT 0').run()
    } else {
      throw error
    }
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

async function ensureModeWinColumn(env: any, column: 'wins_stealing' | 'wins_anti_connect_four') {
  await ensureUsersTable(env)
  try {
    await env.DB.prepare(`SELECT ${column} FROM users LIMIT 1`).first()
  } catch (error: any) {
    const message = String(error?.message || error)
    if (message.includes(`no such column: ${column}`) || message.includes(`has no column named ${column}`)) {
      await env.DB.prepare(`ALTER TABLE users ADD COLUMN ${column} INTEGER DEFAULT 0`).run()
    } else {
      throw error
    }
  }
}

type WinMode = 'classic' | 'triple' | 'stealing' | 'anti-connect'

function getWinColumn(mode: WinMode): 'win' | 'win_1v1v1' | 'wins_stealing' | 'wins_anti_connect_four' {
  if (mode === 'triple') return 'win_1v1v1'
  if (mode === 'stealing') return 'wins_stealing'
  if (mode === 'anti-connect') return 'wins_anti_connect_four'
  return 'win'
}

function getGamesColumn(mode: WinMode): 'games_classic' | 'games_triple' | 'games_stealing' | 'games_anti_connect_four' {
  if (mode === 'triple') return 'games_triple'
  if (mode === 'stealing') return 'games_stealing'
  if (mode === 'anti-connect') return 'games_anti_connect_four'
  return 'games_classic'
}

async function ensureGamesColumn(env: any, column: ReturnType<typeof getGamesColumn>) {
  await ensureUsersTable(env)
  try {
    await env.DB.prepare(`SELECT ${column} FROM users LIMIT 1`).first()
  } catch (error: any) {
    const message = String(error?.message || error)
    if (message.includes(`no such column: ${column}`) || message.includes(`has no column named ${column}`)) {
      await env.DB.prepare(`ALTER TABLE users ADD COLUMN ${column} INTEGER DEFAULT 0`).run()
    } else {
      throw error
    }
  }
}

async function ensureWinModeColumn(env: any, mode: WinMode) {
  const column = getWinColumn(mode)
  if (column === 'win') await ensureWinColumn(env)
  else if (column === 'win_1v1v1') await ensureTripleWinColumn(env)
  else await ensureModeWinColumn(env, column)
  await ensureGamesColumn(env, getGamesColumn(mode))
}

async function recordGameResult(env: any, userId: string | null, username: string | undefined, mode: WinMode, result: 'win' | 'loss' | 'draw') {
  await ensureUsersTable(env)
  const column = getWinColumn(mode)
  const gamesColumn = getGamesColumn(mode)
  await ensureWinModeColumn(env, mode)

  const target = String(userId || '').trim()
  const loginIdentifier = String(username || '').trim()
  const where = target ? 'id = ?' : 'username = ? OR email = ?'
  const values = target ? [target] : [loginIdentifier, loginIdentifier]

  if (!target && !loginIdentifier) return 0

  const gameResult = await env.DB.prepare(`UPDATE users SET ${gamesColumn} = ${gamesColumn} + 1${result === 'win' ? `, ${column} = ${column} + 1` : ''} WHERE ${where}`).bind(...values).run()
  return Number(gameResult?.meta?.changes ?? 0)
}

async function insertUser(env: any, username: string, email: string, passwordHash: string) {
  await ensureUsersTable(env)
  await ensurePasswordColumn(env)
  await ensureWinColumn(env)
  await ensureTripleWinColumn(env)
  await ensureModeWinColumn(env, 'wins_stealing')
  await ensureModeWinColumn(env, 'wins_anti_connect_four')
  await ensureGamesColumn(env, 'games_classic')
  await ensureGamesColumn(env, 'games_triple')
  await ensureGamesColumn(env, 'games_stealing')
  await ensureGamesColumn(env, 'games_anti_connect_four')

  try {
    const result = await env.DB.prepare(
      `INSERT INTO users (username, email, password, win, win_1v1v1, wins_stealing, wins_anti_connect_four, games_classic, games_triple, games_stealing, games_anti_connect_four)
       VALUES (?, ?, ?, 0, 0, 0, 0, 0, 0, 0, 0)`
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
        `INSERT INTO users (username, email, password, win, win_1v1v1, wins_stealing, wins_anti_connect_four, games_classic, games_triple, games_stealing, games_anti_connect_four)
         VALUES (?, ?, ?, 0, 0, 0, 0, 0, 0, 0, 0)`
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
    const isAdminUsersRoute = (url.pathname === '/admin/users' || url.pathname === '/api/admin/users') && request.method === 'GET'
    const isAdminUpdateRoute =
      ((url.pathname === '/admin/users/update' || url.pathname === '/api/admin/users/update') && request.method === 'POST') ||
      (url.pathname.match(/^\/(api\/)?admin\/users\/\d+$/) && (request.method === 'PUT' || request.method === 'PATCH' || request.method === 'POST'))
    const isAdminDeleteRoute =
      ((url.pathname === '/admin/users/delete' || url.pathname === '/api/admin/users/delete') && (request.method === 'POST' || request.method === 'DELETE')) ||
      (url.pathname.match(/^\/(api\/)?admin\/users\/\d+(\/(score|gold|score-gold))?$/) && request.method === 'DELETE')
    const isAdminApiRoute = isAdminUsersRoute || isAdminUpdateRoute || isAdminDeleteRoute

    if (isAdminApiRoute) {
      try {
        await ensureUsersTable(env)
        if (!(await verifyAdminToken(env.DB, getAdminToken(request)))) {
          return new Response(JSON.stringify({ error: 'Admin sign-in required' }), { status: 401 })
        }
      } catch {
        return new Response(JSON.stringify({ error: 'Could not verify admin access' }), { status: 500 })
      }
    }

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
          'SELECT id, username, email, password, win, isAdmin FROM users WHERE username = ?1 OR email = ?2 LIMIT 1'
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

        const isAdmin = Number(user.isAdmin) === 1
        const adminToken = isAdmin ? await createAdminToken(user.id, user.password) : undefined
        return new Response(JSON.stringify({ id: user.id, username: user.username, email: user.email, wins: user.win ?? 0, isAdmin, adminToken }), { status: 200 })
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
          const mode: WinMode = body?.mode === 'triple' || body?.mode === 'stealing' || body?.mode === 'anti-connect'
            ? body.mode
            : 'classic'

        if (!userId && !username && !email) {
          return new Response(JSON.stringify({ error: 'Missing user identifier' }), { status: 400 })
        }

        const result = body?.result === 'loss' || body?.result === 'draw' ? body.result : 'win'
        const changes = await recordGameResult(env, userId || null, username || email || undefined, mode, result)
        return new Response(JSON.stringify({ success: true, changed: changes > 0, wins: changes }), { status: 200 })
      } catch (err) {
        return new Response(JSON.stringify({ error: 'Invalid request', details: String(err) }), { status: 400 })
      }
    }

    if (isLeaderboardRoute) {
      try {
        await ensureUsersTable(env)
        const requestedMode = url.searchParams.get('mode')
        const mode: WinMode = requestedMode === 'triple' || requestedMode === 'stealing' || requestedMode === 'anti-connect'
          ? requestedMode
          : 'classic'
        const column = getWinColumn(mode)
        const gamesColumn = getGamesColumn(mode)
        await ensureWinModeColumn(env, mode)
        const result = await env.DB.prepare(`SELECT id, username, email, ${column}, ${gamesColumn} FROM users ORDER BY ${column} DESC`).all()
        const rows = Array.isArray(result) ? result : Array.isArray(result?.results) ? result.results : []
        const entries = (Array.isArray(rows) ? rows : []).map((row: any) => ({
          id: String(row.id ?? ''),
          username: String(row.username ?? ''),
          win: Number(row[column] ?? 0),
          games: Number(row[gamesColumn] ?? 0),
        }))
        return new Response(JSON.stringify({ entries }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      } catch (err) {
        return new Response(JSON.stringify({ error: 'Failed to load leaderboard', details: String(err) }), { status: 500, headers: { 'Content-Type': 'application/json' } })
      }
    }

    if (isAdminUsersRoute) {
      try {
        await ensureUsersTable(env)
        await ensurePasswordColumn(env)
        await ensureWinColumn(env)
        await ensureTripleWinColumn(env)
        await ensureModeWinColumn(env, 'wins_stealing')
        await ensureModeWinColumn(env, 'wins_anti_connect_four')
        await ensureGamesColumn(env, 'games_classic')
        await ensureGamesColumn(env, 'games_triple')
        await ensureGamesColumn(env, 'games_stealing')
        await ensureGamesColumn(env, 'games_anti_connect_four')
        await ensureScoreColumn(env)
        await ensureGoldColumn(env)

        const result = await env.DB.prepare('SELECT * FROM users ORDER BY id ASC').all()
        const rows = Array.isArray(result) ? result : Array.isArray(result?.results) ? result.results : []
        return new Response(JSON.stringify({ users: rows }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      } catch (err: any) {
        return new Response(JSON.stringify({ error: 'Failed to load users', details: String(err) }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      }
    }

    if (isAdminUpdateRoute) {
      try {
        await ensureUsersTable(env)
        await ensureScoreColumn(env)
        await ensureGoldColumn(env)

        let body: any = {}
        try {
          body = await request.json()
        } catch {
          return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 })
        }

        const pathParts = url.pathname.split('/').filter(Boolean)
        const lastPart = pathParts[pathParts.length - 1]
        const idFromPath = lastPart !== 'update' && lastPart !== 'users' ? lastPart : null
        const userId = idFromPath || body?.id || body?.userId

        if (!userId) {
          return new Response(JSON.stringify({ error: 'Missing user id' }), { status: 400 })
        }

        const updates: string[] = []
        const values: any[] = []

        if (body.score !== undefined) {
          const numScore = Number(body.score)
          if (isNaN(numScore)) {
            return new Response(JSON.stringify({ error: 'Score must be a number' }), { status: 400 })
          }
          updates.push('score = ?')
          values.push(numScore)
        }

        if (body.gold !== undefined) {
          const numGold = Number(body.gold)
          if (isNaN(numGold)) {
            return new Response(JSON.stringify({ error: 'Gold must be a number' }), { status: 400 })
          }
          updates.push('gold = ?')
          values.push(numGold)
        }

        if (updates.length === 0) {
          return new Response(JSON.stringify({ error: 'Only score and gold column updates are supported' }), { status: 400 })
        }

        values.push(userId)
        await env.DB.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run()
        const updatedUser = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first()

        return new Response(JSON.stringify({ success: true, user: updatedUser }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      } catch (err: any) {
        return new Response(JSON.stringify({ error: 'Failed to update user', details: String(err) }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      }
    }

    if (isAdminDeleteRoute) {
      try {
        await ensureUsersTable(env)
        await ensureScoreColumn(env)
        await ensureGoldColumn(env)

        let body: any = {}
        try {
          body = await request.json()
        } catch {
          body = {}
        }

        const pathParts = url.pathname.split('/').filter(Boolean)
        const lastPart = pathParts[pathParts.length - 1]
        const secondToLast = pathParts[pathParts.length - 2]
        const targetFromPath = lastPart === 'score' || lastPart === 'gold' || lastPart === 'score-gold' ? lastPart : null
        const idFromPath = targetFromPath && secondToLast ? secondToLast : (lastPart !== 'delete' ? lastPart : null)
        const userId = idFromPath || body?.id || body?.userId

        if (!userId) {
          return new Response(JSON.stringify({ error: 'Missing user id' }), { status: 400 })
        }

        const target = targetFromPath || body?.target || 'both'
        if (target === 'score') {
          await env.DB.prepare('UPDATE users SET score = 0 WHERE id = ?').bind(userId).run()
        } else if (target === 'gold') {
          await env.DB.prepare('UPDATE users SET gold = 0 WHERE id = ?').bind(userId).run()
        } else {
          await env.DB.prepare('UPDATE users SET score = 0, gold = 0 WHERE id = ?').bind(userId).run()
        }

        const updatedUser = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first()
        return new Response(JSON.stringify({ success: true, user: updatedUser }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      } catch (err: any) {
        return new Response(JSON.stringify({ error: 'Failed to reset score/gold', details: String(err) }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      }
    }

    return new Response('Not found', { status: 404 })
  }
}
