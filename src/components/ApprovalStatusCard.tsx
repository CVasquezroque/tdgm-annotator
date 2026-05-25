import type { AccessStatus, UserProfile } from '../types'
import type { User } from '../hooks/useAuth'

interface Props {
  user: User
  profile: UserProfile | null
  accessStatus: AccessStatus
  error?: string | null
  onRefreshVerification: () => Promise<unknown>
  onLogout: () => Promise<void>
}

const STATUS_COPY: Record<AccessStatus, { title: string; body: string }> = {
  allowed: {
    title: 'Acceso habilitado',
    body: 'Tu cuenta esta lista para anotar.',
  },
  email_unverified: {
    title: 'Verifica tu correo',
    body: 'Enviamos un correo de verificacion. Abre el enlace y luego actualiza el estado aqui.',
  },
  pending_approval: {
    title: 'Cuenta pendiente de aprobacion',
    body: 'Un supervisor debe activar tu cuenta y asignar tu codigo de anotador antes de usar el espacio de anotacion.',
  },
  suspended: {
    title: 'Cuenta suspendida',
    body: 'Tu acceso esta suspendido. Contacta al equipo supervisor si necesitas revisar tu estado.',
  },
  training_pending: {
    title: 'Capacitacion o acuerdo pendiente',
    body: 'Tu cuenta ya fue aprobada, pero falta registrar la capacitacion y el acuerdo de confidencialidad.',
  },
  profile_missing: {
    title: 'Perfil no disponible',
    body: 'La cuenta esta autenticada, pero el perfil institucional no esta disponible. Vuelve a iniciar sesion o contacta al administrador.',
  },
  profile_creation_denied: {
    title: 'Perfil pendiente no creado',
    body: 'No pudimos crear tu perfil institucional pendiente con los permisos actuales. Contacta al administrador del proyecto.',
  },
  network_error: {
    title: 'No se pudo conectar con Firestore',
    body: 'La sesion existe, pero no pudimos leer o crear el perfil por un problema de red. Intenta nuevamente.',
  },
  unknown_error: {
    title: 'No se pudo preparar tu perfil',
    body: 'Ocurrio un error inesperado al leer o crear el perfil institucional. Contacta al administrador del proyecto.',
  },
}

export function ApprovalStatusCard({
  user,
  profile,
  accessStatus,
  error,
  onRefreshVerification,
  onLogout,
}: Props) {
  const copy = STATUS_COPY[accessStatus]

  return (
    <div className="auth-shell">
      <div className="access-card">
        <div className="login-header">
          <img src="/logo.png" alt="DIANA" className="login-logo" />
        </div>
        <div className="access-status-tag">{profile?.status ?? 'sin perfil'}</div>
        <h2>{copy.title}</h2>
        <p>{copy.body}</p>

        <div className="access-details">
          <div>
            <span>Usuario</span>
            <strong>{profile?.full_name || user.email}</strong>
          </div>
          <div>
            <span>Correo</span>
            <strong>{user.email}</strong>
          </div>
          <div>
            <span>Rol</span>
            <strong>{profile?.role ?? 'pendiente'}</strong>
          </div>
          <div>
            <span>Codigo anotador</span>
            <strong>{profile?.annotator_code || 'pendiente'}</strong>
          </div>
        </div>

        {error && <div className="form-error">{error}</div>}

        <div className="access-actions">
          {accessStatus === 'email_unverified' && (
            <button type="button" onClick={onRefreshVerification}>
              Actualizar verificacion
            </button>
          )}
          <button type="button" className="secondary" onClick={onLogout}>
            Cerrar sesion
          </button>
        </div>
      </div>
    </div>
  )
}
