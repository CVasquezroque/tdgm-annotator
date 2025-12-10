import { useState } from 'react'

interface Props {
  onLogin: (email: string, password: string) => Promise<unknown>
  onRegister: (email: string, password: string, username: string) => Promise<unknown>
  onResetPassword?: (email: string) => Promise<void>
  onClearError?: () => void
  error?: string | null
}

export function LoginCard({ onLogin, onRegister, onResetPassword, onClearError, error }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const switchMode = (newMode: 'login' | 'register') => {
    setMode(newMode)
    setEmail('')
    setPassword('')
    setUsername('')
    setLocalError(null)
    setSuccessMsg(null)
    onClearError?.()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setLocalError(null)
    setSuccessMsg(null)
    try {
      if (mode === 'login') {
        await onLogin(email.trim(), password)
      } else {
        await onRegister(email.trim(), password, username.trim())
        setSuccessMsg('Usuario creado y sesión iniciada.')
      }
    } catch {
      // El error ya viene de useAuth via prop `error`
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setLocalError('Ingresa tu correo electrónico primero.')
      return
    }
    if (!onResetPassword) return
    setLoading(true)
    setLocalError(null)
    setSuccessMsg(null)
    try {
      await onResetPassword(email.trim())
      setSuccessMsg('Se envió un correo para restablecer tu contraseña.')
    } catch {
      // El error ya viene de useAuth via prop `error`
    } finally {
      setLoading(false)
    }
  }

  const displayError = localError || error

  return (
    <div className="login-card">
      <div className="login-header">
        <img src="/logo.png" alt="DIANA" className="login-logo" />
      </div>
      <p className="login-subtitle">
        Plataforma de anotación para evaluación del desarrollo motor grueso en niños
      </p>
      <div className="login-toggle">
        <button className={mode === 'login' ? 'active' : ''} onClick={() => switchMode('login')} type="button">
          Iniciar sesión
        </button>
        <button className={mode === 'register' ? 'active' : ''} onClick={() => switchMode('register')} type="button">
          Crear usuario
        </button>
      </div>
      <form onSubmit={handleSubmit} className="login-form">
        <label>
          Correo electrónico
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        {mode === 'register' && (
          <label>
            Nombre de usuario
            <input value={username} onChange={(e) => setUsername(e.target.value)} required />
          </label>
        )}
        <label>
          Contraseña
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {mode === 'login' && onResetPassword && (
          <button type="button" className="link-btn" onClick={handleForgotPassword} disabled={loading}>
            ¿Olvidaste tu contraseña?
          </button>
        )}
        {displayError && <div className="form-error">{displayError}</div>}
        {successMsg && <div className="form-status">{successMsg}</div>}
        <button type="submit" disabled={loading}>
          {loading ? 'Procesando...' : mode === 'login' ? 'Entrar' : 'Registrar e ingresar'}
        </button>
      </form>
    </div>
  )
}

