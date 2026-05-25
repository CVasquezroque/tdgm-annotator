import { useEffect, useMemo, useState } from 'react'
import type { AnnotationSession, Segment, UserProfile } from '../types'
import {
  getReviewEvents,
  listReviewableSessions,
  loadSessionBundle,
  setSessionReviewStatus,
  timestampToIso,
} from '../services/annotationSessions'
import { SessionStatusBadge } from './SessionStatusBadge'

interface Props {
  profile: UserProfile
  onOpenSession: (session: AnnotationSession, segments: Segment[]) => void
}

function formatDate(value: unknown) {
  const iso = timestampToIso(value)
  if (!iso) return 'Sin fecha'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'Sin fecha'
  return new Intl.DateTimeFormat('es-PE', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function reviewTitle(session: AnnotationSession) {
  if (session.status === 'submitted') return 'Lista para revisar'
  if (session.status === 'returned') return 'Devuelta para correccion'
  if (session.status === 'reviewed') return 'Revision completada'
  if (session.status === 'locked') return 'Bloqueada'
  return 'Borrador'
}

export function ReviewerSessionsPanel({ profile, onOpenSession }: Props) {
  const [sessions, setSessions] = useState<AnnotationSession[]>([])
  const [filter, setFilter] = useState('')
  const [comment, setComment] = useState('')
  const [selectedEvents, setSelectedEvents] = useState<{ sessionId: string; events: string[] } | null>(null)
  const [loading, setLoading] = useState(false)

  const refresh = async () => {
    setLoading(true)
    try {
      setSessions(await listReviewableSessions())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  const visible = useMemo(() => {
    const normalized = filter.trim().toLowerCase()
    if (!normalized) return sessions
    return sessions.filter((session) =>
      [session.annotator_code, session.status].some((value) =>
        String(value).toLowerCase().includes(normalized),
      ),
    )
  }, [filter, sessions])

  const openSession = async (sessionId: string) => {
    const bundle = await loadSessionBundle(sessionId)
    if (bundle) onOpenSession(bundle.session, bundle.segments)
  }

  const act = async (session: AnnotationSession, status: 'reviewed' | 'returned' | 'locked') => {
    await setSessionReviewStatus(session, status, profile, comment.trim() || null)
    setComment('')
    await refresh()
  }

  const showEvents = async (sessionId: string) => {
    const events = await getReviewEvents(sessionId)
    setSelectedEvents({
      sessionId,
      events: events.map((event) => `${event.event_type}: ${event.comment ?? 'sin comentario'}`),
    })
  }

  return (
    <div className="compact-panel review-panel">
      <div className="panel-header review-heading">
        <div>
          <span className="section-kicker">Revision</span>
          <h3>Anotaciones recibidas</h3>
          <p>Abre una anotacion, marca el resultado y registra comentarios si corresponde.</p>
        </div>
        <button className="ghost" onClick={() => void refresh()} disabled={loading}>
          {loading ? 'Actualizando...' : 'Actualizar'}
        </button>
      </div>
      <div className="review-controls">
        <label>
          Buscar
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Anotador o estado" />
        </label>
        <label>
          Comentario para la accion
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} placeholder="Opcional" />
        </label>
      </div>
      <div className="session-list">
        {visible.length === 0 && <p className="placeholder-text">No hay anotaciones para revisar con ese filtro.</p>}
        {visible.map((session) => (
          <div className="session-review-row review-card" key={session.session_id}>
            <button className="session-row review-card-main" onClick={() => void openSession(session.session_id)}>
              <span className="review-card-copy">
                <strong>{reviewTitle(session)}</strong>
                <small>{session.video_filename || 'Archivo codificado'}</small>
                <span className="review-meta">
                  <span>{session.annotator_code || 'codigo pendiente'}</span>
                  <span>Actualizada {formatDate(session.updated_at)}</span>
                  <span>{session.segment_count} segmentos</span>
                </span>
              </span>
              <SessionStatusBadge status={session.status} />
            </button>
            <div className="review-actions">
              <button className="secondary" onClick={() => void act(session, 'reviewed')} disabled={session.status === 'locked'}>
                Revisar
              </button>
              <button className="secondary" onClick={() => void act(session, 'returned')} disabled={session.status === 'locked'}>
                Devolver
              </button>
              <button className="secondary" onClick={() => void act(session, 'locked')}>
                Bloquear
              </button>
              <button className="ghost" onClick={() => void showEvents(session.session_id)}>
                Eventos
              </button>
            </div>
            {selectedEvents?.sessionId === session.session_id && (
              <div className="review-events">
                {selectedEvents.events.length === 0 && <div>No hay eventos registrados.</div>}
                {selectedEvents.events.map((event) => (
                  <div key={event}>{event}</div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
