import { useState } from 'react'

interface Props {
  onLogin: (username: string, password: string) => Promise<void>
  onRegister: (username: string, password: string) => Promise<void>
  error?: string | null
}

export function LoginCard({ onLogin, onRegister, error }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setStatus(null)
    try {
      if (mode === 'login') {
        await onLogin(username.trim(), password)
      } else {
        await onRegister(username.trim(), password)
        setStatus('Usuario creado y sesión iniciada.')
      }
    } catch (err) {
      setStatus((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-card">
      <h3>Ingreso requerido</h3>
      <p>Identifícate para autocompletar el campo de anotador y proteger el acceso.</p>
      <div className="login-toggle">
        <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')} type="button">
          Iniciar sesión
        </button>
        <button className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')} type="button">
          Crear usuario
        </button>
      </div>
      <form onSubmit={handleSubmit} className="login-form">
        <label>
          Usuario
          <input value={username} onChange={(e) => setUsername(e.target.value)} required />
        </label>
        <label>
          Contraseña
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <div className="form-error">{error}</div>}
        {status && <div className="form-status">{status}</div>}
        <button type="submit" disabled={loading}>
          {loading ? 'Procesando...' : mode === 'login' ? 'Entrar' : 'Registrar e ingresar'}
        </button>
      </form>
    </div>
  )
}

