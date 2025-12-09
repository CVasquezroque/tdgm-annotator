// Simple auth server with SQLite, bcrypt and HTTP-only JWT cookie (CommonJS)
const express = require('express')
const cors = require('cors')
const cookieParser = require('cookie-parser')
const sqlite3 = require('sqlite3').verbose()
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const path = require('path')

const PORT = process.env.AUTH_PORT || 4000
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'
const DB_PATH = path.join(__dirname, 'auth.db')

const db = new sqlite3.Database(DB_PATH)
db.serialize(() => {
  db.run(
    'CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password_hash TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)',
  )
})

const app = express()
app.use(express.json())
app.use(cookieParser())
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  }),
)

function setAuthCookie(res, payload) {
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '2h' })
  res.cookie('auth_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: 1000 * 60 * 60 * 2,
  })
}

function authMiddleware(req, res, next) {
  const token = req.cookies?.auth_token
  if (!token) return res.status(401).json({ error: 'unauthenticated' })
  try {
    req.user = jwt.verify(token, JWT_SECRET)
    next()
  } catch {
    return res.status(401).json({ error: 'unauthenticated' })
  }
}

app.post('/auth/register', (req, res) => {
  const { username, password } = req.body || {}
  if (!username || !password) return res.status(400).json({ error: 'username and password required' })
  const hash = bcrypt.hashSync(password, 10)
  const stmt = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)')
  stmt.run(username, hash, function (err) {
    if (err) {
      return res.status(409).json({ error: 'username already exists' })
    }
    setAuthCookie(res, { id: this.lastID, username })
    return res.json({ id: this.lastID, username })
  })
})

app.post('/auth/login', (req, res) => {
  const { username, password } = req.body || {}
  if (!username || !password) return res.status(400).json({ error: 'username and password required' })
  db.get('SELECT * FROM users WHERE username = ?', username, (err, row) => {
    if (err) return res.status(500).json({ error: 'db error' })
    if (!row) return res.status(401).json({ error: 'invalid credentials' })
    const ok = bcrypt.compareSync(password, row.password_hash)
    if (!ok) return res.status(401).json({ error: 'invalid credentials' })
    setAuthCookie(res, { id: row.id, username: row.username })
    return res.json({ id: row.id, username: row.username })
  })
})

app.post('/auth/logout', (_req, res) => {
  res.clearCookie('auth_token')
  res.json({ ok: true })
})

app.get('/auth/me', authMiddleware, (req, res) => {
  res.json({ id: req.user.id, username: req.user.username })
})

app.get('/', (_req, res) => {
  res.json({ ok: true, service: 'auth', login: '/auth/login', register: '/auth/register', me: '/auth/me' })
})

app.listen(PORT, () => {
  console.log(`Auth server running on http://localhost:${PORT}`)
})

