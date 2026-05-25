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

export function ReviewerSessionsPanel({ profile, onOpenSession }: Props) {
  const [sessions, setSessions] = useState<AnnotationSession[]>([])
  const [filter, setFilter] = useState('')
  const [comment, setComment] = useState('')
  const [selectedEvents, setSelectedEvents] = useState<string[]>([])
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
      [session.video_code, session.annotator_code, session.status].some((value) =>
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
    setSelectedEvents(events.map((event) => `${event.event_type}: ${event.comment ?? 'sin comentario'}`))
  }

  return (
    <div className="compact-panel">
      <div className="panel-header">
        <h3>Revision</h3>
        <button className="ghost" onClick={() => void refresh()} disabled={loading}>
          Actualizar
        </button>
      </div>
      <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filtrar por video, anotador o estado" />
      <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} placeholder="Comentario de revision" />
      <div className="session-list">
        {visible.map((session) => (
          <div className="session-review-row" key={session.session_id}>
            <button className="session-row" onClick={() => void openSession(session.session_id)}>
              <span>
                <strong>{session.video_code}</strong>
                <small>
                  {session.annotator_code} - {timestampToIso(session.updated_at) ?? 'sin fecha'}
                </small>
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
          </div>
        ))}
      </div>
      {selectedEvents.length > 0 && (
        <div className="review-events">
          {selectedEvents.map((event) => (
            <div key={event}>{event}</div>
          ))}
        </div>
      )}
    </div>
  )
}
