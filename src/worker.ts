// Cloudflare Worker entry for handling API requests (signup)
// This file expects a D1 binding named `DB` (see wrangler.toml).
export default {
  async fetch(request: Request, env: any) {
    const url = new URL(request.url)
    if (url.pathname === '/signup' && request.method === 'POST') {
      try {
        const body = await request.json()
        const { username, email, password } = body || {}
        if (!username || !email || !password) {
          return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400 })
        }

        // create users table if not exists
        await env.DB.prepare(
          `CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE,
            email TEXT UNIQUE,
            password_hash TEXT,
            created_at TEXT
          )`
        ).run()

        // hash password using Web Crypto (SHA-256)
        const pwBuffer = new TextEncoder().encode(password)
        const hashBuffer = await crypto.subtle.digest('SHA-256', pwBuffer)
        const hashArray = Array.from(new Uint8Array(hashBuffer))
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

        const id = crypto.randomUUID()
        const createdAt = new Date().toISOString()

        const stmt = env.DB.prepare(
          `INSERT INTO users (id, username, email, password_hash, created_at)
           VALUES (?, ?, ?, ?, ?)`
        )
        try {
          await stmt.bind(id, username, email, hashHex, createdAt).run()
        } catch (e) {
          // Unique constraint failure
          return new Response(JSON.stringify({ error: 'User already exists' }), { status: 409 })
        }

        return new Response(JSON.stringify({ id, username, email, createdAt }), { status: 201 })
      } catch (err) {
        return new Response(JSON.stringify({ error: 'Invalid request', details: String(err) }), { status: 400 })
      }
    }

    return new Response('Not found', { status: 404 })
  }
}
