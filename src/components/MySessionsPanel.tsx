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

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setSessions(await listMySessions(uid))
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
          Actualizar
        </button>
      </div>
      <div className="session-list">
        {sessions.length === 0 && <p className="placeholder-text">No hay anotaciones guardadas aun.</p>}
        {sessions.map((session) => (
          <button className="session-row" key={session.session_id} onClick={() => void openSession(session.session_id)}>
            <span>
              <strong>Anotacion local</strong>
              <small>{timestampToIso(session.updated_at) ?? 'sin fecha'}</small>
            </span>
            <SessionStatusBadge status={session.status} />
          </button>
        ))}
      </div>
    </div>
  )
}
