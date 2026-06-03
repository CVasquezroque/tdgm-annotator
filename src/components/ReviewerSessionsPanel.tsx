import { useEffect, useMemo, useState } from 'react'
import type { AnnotationSession, UserProfile } from '../types'
import {
  deleteAnnotationSession,
  getReviewEvents,
  listReviewableSessions,
  loadSessionBundle,
  setSessionReviewStatus,
  timestampToIso,
  type SessionBundle,
} from '../services/annotationSessions'
import { DangerZoneConfirmDialog } from './DangerZoneConfirmDialog'
import { ReviewSessionViewer, type ReviewViewerMode } from './ReviewSessionViewer'
import { SessionStatusBadge } from './SessionStatusBadge'

interface Props {
  profile: UserProfile
}

const PAGE_SIZES = [5, 10, 20, 50]

function isPermissionDenied(error: unknown) {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      ((error as { code: unknown }).code === 'permission-denied' ||
        (error as { code: unknown }).code === 'PERMISSION_DENIED'),
  )
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

export function ReviewerSessionsPanel({ profile }: Props) {
  const [sessions, setSessions] = useState<AnnotationSession[]>([])
  const [filter, setFilter] = useState('')
  const [comment, setComment] = useState('')
  const [selectedEvents, setSelectedEvents] = useState<{ sessionId: string; events: string[] } | null>(null)
  const [viewerState, setViewerState] = useState<{ mode: ReviewViewerMode; bundle: SessionBundle } | null>(null)
  const [viewerError, setViewerError] = useState<string | null>(null)
  const [viewLoadingId, setViewLoadingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [pageSize, setPageSize] = useState(5)
  const [page, setPage] = useState(1)
  const [deleteTarget, setDeleteTarget] = useState<AnnotationSession | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const canDeleteSessions = profile.role === 'admin'

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
      [session.annotator_code, session.video_filename, session.video_code, session.status].some((value) =>
        String(value).toLowerCase().includes(normalized),
      ),
    )
  }, [filter, sessions])

  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize))
  const safePage = Math.min(page, pageCount)
  const pageStart = (safePage - 1) * pageSize
  const pagedVisible = visible.slice(pageStart, pageStart + pageSize)

  useEffect(() => {
    if (page > pageCount) setPage(pageCount)
  }, [page, pageCount])

  const openViewer = async (sessionId: string, mode: ReviewViewerMode) => {
    setViewLoadingId(sessionId)
    setViewerError(null)
    try {
      const bundle = await loadSessionBundle(sessionId)
      if (bundle) setViewerState({ mode, bundle })
      else setViewerError('No se encontro la anotacion seleccionada.')
    } catch (error) {
      console.warn('No se pudo abrir la anotacion para revision.', error)
      setViewerError('No se pudo abrir la anotacion para revision.')
    } finally {
      setViewLoadingId(null)
    }
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

  const deleteSession = async () => {
    if (!deleteTarget || !canDeleteSessions) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteAnnotationSession(deleteTarget.session_id)
      setViewerState((current) =>
        current?.bundle.session.session_id === deleteTarget.session_id ? null : current,
      )
      setSelectedEvents((current) => (current?.sessionId === deleteTarget.session_id ? null : current))
      setDeleteTarget(null)
      await refresh()
    } catch (error) {
      console.warn('No se pudo eliminar la anotacion.', error)
      setDeleteError(
        isPermissionDenied(error)
          ? 'Firestore rechazo la eliminacion. Verifica que las reglas actualizadas esten publicadas para el proyecto.'
          : 'No se pudo eliminar la anotacion. Revisa tu conexion.',
      )
    } finally {
      setDeleting(false)
    }
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
          <input
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value)
              setPage(1)
            }}
            placeholder="Anotador, video o estado"
          />
        </label>
        <label>
          Comentario para la accion
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} placeholder="Opcional" />
        </label>
      </div>
      {viewerError && <div className="form-error">{viewerError}</div>}
      <div className="session-list">
        {visible.length === 0 && <p className="placeholder-text">No hay anotaciones para revisar con ese filtro.</p>}
        {pagedVisible.map((session) => (
          <div className="session-review-row review-card" key={session.session_id}>
            <div className="session-row review-card-main review-card-summary">
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
            </div>
            <div className="review-actions">
              <button
                className="secondary"
                onClick={() => void openViewer(session.session_id, 'view')}
                disabled={viewLoadingId === session.session_id}
              >
                {viewLoadingId === session.session_id ? 'Abriendo...' : 'Ver'}
              </button>
              <button
                className="secondary"
                onClick={() => void openViewer(session.session_id, 'review')}
                disabled={session.status !== 'submitted' || viewLoadingId === session.session_id}
              >
                Revisar
              </button>
              <button className="secondary" onClick={() => void act(session, 'reviewed')} disabled={session.status !== 'submitted'}>
                Aprobar
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
              {canDeleteSessions && (
                <button
                  className="danger-outline"
                  onClick={() => {
                    setDeleteError(null)
                    setDeleteTarget(session)
                  }}
                >
                  Eliminar
                </button>
              )}
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
      {visible.length > 0 && (
        <div className="review-pagination">
          <label className="review-page-size">
            Mostrar
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value))
                setPage(1)
              }}
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <span className="review-page-summary">
            Mostrando {pageStart + 1}-{Math.min(pageStart + pageSize, visible.length)} de {visible.length}
          </span>
          <div className="review-page-buttons" aria-label="Paginas de revision">
            <button className="ghost" type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={safePage === 1}>
              Anterior
            </button>
            {Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => (
              <button
                className={safePage === pageNumber ? 'active' : 'ghost'}
                type="button"
                key={pageNumber}
                onClick={() => setPage(pageNumber)}
                aria-current={safePage === pageNumber ? 'page' : undefined}
              >
                {pageNumber}
              </button>
            ))}
            <button
              className="ghost"
              type="button"
              onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
              disabled={safePage === pageCount}
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
      {viewerState && (
        <ReviewSessionViewer
          key={`${viewerState.mode}:${viewerState.bundle.session.session_id}`}
          mode={viewerState.mode}
          session={viewerState.bundle.session}
          segments={viewerState.bundle.segments}
          onSaved={(nextSegments) => {
            setViewerState((current) =>
              current
                ? {
                    ...current,
                    bundle: { ...current.bundle, segments: nextSegments },
                  }
                : current,
            )
            void refresh()
          }}
          onClose={() => setViewerState(null)}
        />
      )}
      {deleteTarget && (
        <DangerZoneConfirmDialog
          key={deleteTarget.session_id}
          title="Eliminar anotacion"
          targetLabel={`${deleteTarget.video_filename || deleteTarget.video_code} · ${
            deleteTarget.annotator_code || 'codigo pendiente'
          }`}
          warning="Se eliminaran la sesion, todos sus segmentos, los registros usados por exportacion y sus eventos de revision. Esta accion no se puede deshacer."
          busy={deleting}
          error={deleteError}
          onCancel={() => {
            setDeleteTarget(null)
            setDeleteError(null)
          }}
          onConfirm={() => void deleteSession()}
        />
      )}
    </div>
  )
}
