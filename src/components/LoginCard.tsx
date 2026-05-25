import { useState, type FormEvent } from 'react'
import type { RegistrationProfileInput } from '../services/userProfiles'

interface Props {
  onLogin: (email: string, password: string) => Promise<unknown>
  onRegister: (email: string, password: string, profile: RegistrationProfileInput) => Promise<unknown>
  onResetPassword?: (email: string) => Promise<void>
  onClearError?: () => void
  error?: string | null
}

export function LoginCard({ onLogin, onRegister, onResetPassword, onClearError, error }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [institution, setInstitution] = useState('')
  const [loading, setLoading] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const switchMode = (newMode: 'login' | 'register') => {
    setMode(newMode)
    setEmail('')
    setPassword('')
    setFullName('')
    setInstitution('')
    setLocalError(null)
    setSuccessMsg(null)
    onClearError?.()
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setLocalError(null)
    setSuccessMsg(null)
    try {
      if (mode === 'login') {
        await onLogin(email.trim(), password)
      } else {
        if (!fullName.trim() || !institution.trim()) {
          setLocalError('Completa nombre completo e institucion.')
          return
        }
        await onRegister(email.trim(), password, {
          fullName: fullName.trim(),
          institution: institution.trim(),
        })
        setSuccessMsg('Cuenta creada. Verifica tu correo y espera la aprobacion del equipo supervisor.')
      }
    } catch {
      // El error ya viene de useAuth via prop `error`.
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setLocalError('Ingresa tu correo electronico primero.')
      return
    }
    if (!onResetPassword) return
    setLoading(true)
    setLocalError(null)
    setSuccessMsg(null)
    try {
      await onResetPassword(email.trim())
      setSuccessMsg('Se envio un correo para restablecer tu contrasena.')
    } catch {
      // El error ya viene de useAuth via prop `error`.
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
        Plataforma institucional para anotacion TGMD-3. El acceso requiere verificacion y aprobacion.
      </p>
      <div className="login-toggle">
        <button className={mode === 'login' ? 'active' : ''} onClick={() => switchMode('login')} type="button">
          Iniciar sesion
        </button>
        <button className={mode === 'register' ? 'active' : ''} onClick={() => switchMode('register')} type="button">
          Solicitar acceso
        </button>
      </div>
      <form onSubmit={handleSubmit} className="login-form">
        <label>
          Correo electronico
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        {mode === 'register' && (
          <>
            <label>
              Nombre completo
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </label>
            <label>
              Institucion
              <input value={institution} onChange={(e) => setInstitution(e.target.value)} required />
            </label>
          </>
        )}
        <label>
          Contrasena
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {mode === 'login' && onResetPassword && (
          <button type="button" className="link-btn" onClick={handleForgotPassword} disabled={loading}>
            Olvidaste tu contrasena?
          </button>
        )}
        {displayError && <div className="form-error">{displayError}</div>}
        {successMsg && <div className="form-status">{successMsg}</div>}
        <button type="submit" disabled={loading}>
          {loading ? 'Procesando...' : mode === 'login' ? 'Entrar' : 'Crear solicitud'}
        </button>
      </form>
    </div>
  )
}
