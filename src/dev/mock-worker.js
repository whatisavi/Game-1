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

  if ((req.url === '/admin/users' || req.url === '/api/admin/users') && req.method === 'GET') {
    const list = Array.from(usersByUsername.values()).map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      password: u.password_hash || 'hash_demo_123',
      score: u.score ?? 0,
      gold: u.gold ?? 0,
      win: u.win ?? 0,
      win_1v1v1: u.win_1v1v1 ?? 0,
      wins_stealing: u.wins_stealing ?? 0,
      wins_anti_connect_four: u.wins_anti_connect_four ?? 0,
      games_classic: u.games_classic ?? 0,
      games_triple: u.games_triple ?? 0,
      games_stealing: u.games_stealing ?? 0,
      games_anti_connect_four: u.games_anti_connect_four ?? 0,
    }))
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ users: list }))
    return
  }

  if ((req.url === '/admin/users/update' || req.url === '/api/admin/users/update') && req.method === 'POST') {
    let body = ''
    for await (const chunk of req) body += chunk
    try {
      const { id, score, gold } = JSON.parse(body || '{}')
      const user = Array.from(usersByUsername.values()).find((u) => u.id === id)
      if (user) {
        if (score !== undefined) user.score = Number(score)
        if (gold !== undefined) user.gold = Number(gold)
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: true, user }))
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Failed to update', details: String(err) }))
    }
    return
  }

  if ((req.url === '/admin/users/delete' || req.url === '/api/admin/users/delete') && req.method === 'POST') {
    let body = ''
    for await (const chunk of req) body += chunk
    try {
      const { id, target } = JSON.parse(body || '{}')
      const user = Array.from(usersByUsername.values()).find((u) => u.id === id)
      if (user) {
        if (target === 'score') user.score = 0
        else if (target === 'gold') user.gold = 0
        else { user.score = 0; user.gold = 0 }
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: true, user }))
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Failed to reset', details: String(err) }))
    }
    return
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' })
  res.end('Not found')
})

server.listen(PORT, '127.0.0.1', () => console.log(`Mock worker listening at http://127.0.0.1:${PORT}`))
