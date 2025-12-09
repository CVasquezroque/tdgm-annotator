import { useEffect, useState } from 'react'

export interface User {
  id: number
  username: string
}

const API_BASE = import.meta.env.VITE_AUTH_URL || 'http://localhost:4000'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void fetch(`${API_BASE}/auth/me`, { credentials: 'include' })
      .then(async (r) => {
        if (!r.ok) throw new Error('unauthenticated')
        return r.json()
      })
      .then((data) => setUser(data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  const login = async (username: string, password: string) => {
    setError(null)
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password }),
    })
    if (!res.ok) {
      const msg = (await res.json().catch(() => ({}))).error ?? 'Error de login'
      setError(msg)
      throw new Error(msg)
    }
    const data = await res.json()
    setUser(data)
    return data
  }

  const register = async (username: string, password: string) => {
    setError(null)
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password }),
    })
    if (!res.ok) {
      const msg = (await res.json().catch(() => ({}))).error ?? 'Error de registro'
      setError(msg)
      throw new Error(msg)
    }
    const data = await res.json()
    setUser(data)
    return data
  }

  const logout = async () => {
    await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' })
    setUser(null)
  }

  return { user, loading, error, login, register, logout }
}

