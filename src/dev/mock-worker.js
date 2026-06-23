#!/usr/bin/env node
// ESM mock server for local dev: listens on 127.0.0.1:8787 and emulates /signup
import http from 'http'
import crypto from 'node:crypto'

const PORT = 8787

const usersByEmail = new Map()
const usersByUsername = new Map()

function sha256Hex(str) {
  return crypto.createHash('sha256').update(str).digest('hex')
}

const server = http.createServer(async (req, res) => {
  if (req.url === '/signup' && req.method === 'POST') {
    let body = ''
    for await (const chunk of req) body += chunk
    try {
      const { username, email, password } = JSON.parse(body || '{}')
      if (!username || !email || !password) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Missing fields' }))
        return
      }

      if (usersByEmail.has(email) || usersByUsername.has(username)) {
        res.writeHead(409, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'User already exists' }))
        return
      }

      const id = crypto.randomUUID()
      const createdAt = new Date().toISOString()
      const password_hash = sha256Hex(password)

      const user = { id, username, email, password_hash, createdAt }
      usersByEmail.set(email, user)
      usersByUsername.set(username, user)

      res.writeHead(201, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ id, username, email, createdAt }))
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Invalid JSON', details: String(err) }))
    }
    return
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' })
  res.end('Not found')
})

server.listen(PORT, '127.0.0.1', () => console.log(`Mock worker listening at http://127.0.0.1:${PORT}`))
