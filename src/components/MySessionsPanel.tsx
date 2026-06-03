import { useCallback, useEffect, useState } from 'react'
import type { AnnotationSession } from '../types'
import { listMySessions, loadSessionBundle, timestampToIso } from '../services/annotationSessions'
import { SessionStatusBadge } from './SessionStatusBadge'
import type { Segment } from '../types'

interface Props {
  uid: string
  onOpenSession: (session: AnnotationSession, segments: Segment[]) => void
}

export function MySessionsPanel({ uid, onOpenSession }: Props) {
  const [sessions, setSessions] = useState<AnnotationSession[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setSessions(await listMySessions(uid))
    } catch (refreshError) {
      console.warn('No se pudieron cargar las anotaciones guardadas.', refreshError)
      setError('No se pudieron cargar las anotaciones. Revisa tu conexion o permisos.')
    } finally {
      setLoading(false)
    }
  }, [uid])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const openSession = async (sessionId: string) => {
    const bundle = await loadSessionBundle(sessionId)
    if (bundle) onOpenSession(bundle.session, bundle.segments)
  }

  return (
    <div className="compact-panel">
      <div className="panel-header">
        <h3>Mis anotaciones</h3>
        <button className="ghost" onClick={() => void refresh()} disabled={loading}>
          {loading ? 'Actualizando...' : 'Actualizar'}
        </button>
      </div>
      <div className="session-list">
        {error && <p className="form-error">{error}</p>}
        {!error && !loading && sessions.length === 0 && (
          <p className="placeholder-text">No hay anotaciones guardadas aun.</p>
        )}
        {sessions.map((session) => (
          <button className="session-row" key={session.session_id} onClick={() => void openSession(session.session_id)}>
            <span>
              <strong>{session.video_filename || session.video_code || 'Archivo codificado'}</strong>
              <small>Anotacion local · {timestampToIso(session.updated_at) ?? 'sin fecha'}</small>
            </span>
            <SessionStatusBadge status={session.status} />
          </button>
        ))}
      </div>
    </div>
  )
}
