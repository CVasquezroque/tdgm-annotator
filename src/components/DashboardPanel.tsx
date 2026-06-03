import { useCallback, useEffect, useMemo, useState } from 'react'
import { TGMD_ACTIONS } from '../constants/actions'
import {
  listSessionsForDashboard,
  listUnifiedSegmentsForExport,
} from '../services/annotationSessions'
import type { AnnotationSegment, AnnotationSession, AnnotationSessionStatus } from '../types'
import { formatTime } from '../utils/time'

interface Props {
  uid: string
  canReadAll: boolean
}

const STATUS_DEFINITIONS: Array<{
  id: AnnotationSessionStatus
  label: string
  color: string
}> = [
  { id: 'draft', label: 'Borrador', color: '#d97706' },
  { id: 'submitted', label: 'Enviado', color: '#2563eb' },
  { id: 'reviewed', label: 'Revisado', color: '#16835b' },
  { id: 'returned', label: 'Devuelto', color: '#c2410c' },
  { id: 'locked', label: 'Bloqueado', color: '#475569' },
]

const decimalFormatter = new Intl.NumberFormat('es-PE', {
  maximumFractionDigits: 1,
})

const SENT_SESSION_STATUSES = new Set<AnnotationSessionStatus>([
  'submitted',
  'reviewed',
  'returned',
  'locked',
])

function segmentDuration(segment: AnnotationSegment) {
  return Math.max(0, segment.end_sec - segment.start_sec)
}

function videoName(value: { video_filename?: string; video_code: string }) {
  return value.video_filename || value.video_code || 'Video sin codigo'
}

function annotatorKey(value: { annotator_code: string; annotator_uid: string }) {
  return value.annotator_code.trim() || value.annotator_uid
}

function annotatorName(value: { annotator_code: string }) {
  return value.annotator_code.trim() || 'Sin codigo'
}

export function DashboardPanel({ uid, canReadAll }: Props) {
  const [sessions, setSessions] = useState<AnnotationSession[]>([])
  const [segments, setSegments] = useState<AnnotationSegment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [nextSessions, nextSegments] = await Promise.all([
        listSessionsForDashboard({ uid, canReadAll }),
        listUnifiedSegmentsForExport({ uid, canReadAll }),
      ])
      setSessions(nextSessions)
      setSegments(nextSegments)
    } catch (refreshError) {
      console.warn('No se pudo cargar el dashboard.', refreshError)
      setError('No se pudo cargar el resumen. Revisa tu conexion o permisos.')
    } finally {
      setLoading(false)
    }
  }, [canReadAll, uid])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const summary = useMemo(() => {
    const sessionStatusById = new Map(sessions.map((session) => [session.session_id, session.status]))
    const sentSegments = segments.filter((segment) =>
      SENT_SESSION_STATUSES.has(sessionStatusById.get(segment.session_id) ?? 'draft'),
    )
    const totalAnnotatedSeconds = sentSegments.reduce((total, segment) => total + segmentDuration(segment), 0)
    const videoSet = new Set<string>()
    const annotatorSet = new Set<string>()

    sessions.forEach((session) => {
      videoSet.add(videoName(session))
      annotatorSet.add(annotatorKey(session))
    })
    segments.forEach((segment) => {
      videoSet.add(videoName(segment))
      annotatorSet.add(annotatorKey(segment))
    })

    const statusStats = STATUS_DEFINITIONS.map((status) => ({
      ...status,
      count: sessions.filter((session) => session.status === status.id).length,
    }))
    const maxStatusCount = Math.max(1, ...statusStats.map((status) => status.count))

    const actionStats = TGMD_ACTIONS.map((action) => {
      const matching = sentSegments.filter((segment) => segment.action === action.id)
      return {
        ...action,
        count: matching.length,
        duration: matching.reduce((total, segment) => total + segmentDuration(segment), 0),
      }
    })
      .filter((action) => action.count > 0)
      .sort((a, b) => b.count - a.count)
    const maxActionCount = Math.max(1, ...actionStats.map((action) => action.count))

    const annotatorRows = new Map<
      string,
      {
        id: string
        annotator: string
        sentVideos: Set<string>
        draftVideos: Set<string>
        sessionCount: number
        segmentCount: number
        annotatedSeconds: number
      }
    >()
    const videoRows = new Map<
      string,
      {
        id: string
        annotator: string
        video: string
        sessionCount: number
        segmentCount: number
        annotatedSeconds: number
      }
    >()

    sessions.forEach((session) => {
      const key = annotatorKey(session)
      const annotator = annotatorName(session)
      const video = videoName(session)
      const annotatorRow = annotatorRows.get(key) ?? {
        id: key,
        annotator,
        sentVideos: new Set<string>(),
        draftVideos: new Set<string>(),
        sessionCount: 0,
        segmentCount: 0,
        annotatedSeconds: 0,
      }
      if (SENT_SESSION_STATUSES.has(session.status)) {
        annotatorRow.sentVideos.add(video)
      } else {
        annotatorRow.draftVideos.add(video)
      }
      annotatorRow.sessionCount += 1
      annotatorRows.set(key, annotatorRow)

      const combinedKey = `${key}::${video}`
      const videoRow = videoRows.get(combinedKey) ?? {
        id: combinedKey,
        annotator,
        video,
        sessionCount: 0,
        segmentCount: 0,
        annotatedSeconds: 0,
      }
      videoRow.sessionCount += 1
      videoRows.set(combinedKey, videoRow)
    })

    sentSegments.forEach((segment) => {
      const key = annotatorKey(segment)
      const annotator = annotatorName(segment)
      const video = videoName(segment)
      const duration = segmentDuration(segment)
      const annotatorRow = annotatorRows.get(key) ?? {
        id: key,
        annotator,
        sentVideos: new Set<string>(),
        draftVideos: new Set<string>(),
        sessionCount: 0,
        segmentCount: 0,
        annotatedSeconds: 0,
      }
      annotatorRow.sentVideos.add(video)
      annotatorRow.segmentCount += 1
      annotatorRow.annotatedSeconds += duration
      annotatorRows.set(key, annotatorRow)

      const combinedKey = `${key}::${video}`
      const videoRow = videoRows.get(combinedKey) ?? {
        id: combinedKey,
        annotator,
        video,
        sessionCount: 0,
        segmentCount: 0,
        annotatedSeconds: 0,
      }
      videoRow.segmentCount += 1
      videoRow.annotatedSeconds += duration
      videoRows.set(combinedKey, videoRow)
    })

    return {
      totalAnnotatedSeconds,
      sentSegmentCount: sentSegments.length,
      averageSegmentSeconds: sentSegments.length > 0 ? totalAnnotatedSeconds / sentSegments.length : 0,
      videoCount: videoSet.size,
      annotatorCount: annotatorSet.size,
      statusStats,
      maxStatusCount,
      actionStats,
      maxActionCount,
      annotatorRows: [...annotatorRows.values()].sort((a, b) => a.annotator.localeCompare(b.annotator)),
      videoRows: [...videoRows.values()].sort((a, b) => {
        const byAnnotator = a.annotator.localeCompare(b.annotator)
        return byAnnotator !== 0 ? byAnnotator : a.video.localeCompare(b.video)
      }),
    }
  }, [segments, sessions])

  return (
    <div className="compact-panel dashboard-panel">
      <div className="panel-header dashboard-heading">
        <div>
          <span className="section-kicker">Dashboard</span>
          <h3>Resumen de anotaciones</h3>
          <p>{canReadAll ? 'Vista global del proyecto' : 'Resumen de tus videos y segmentos'}</p>
        </div>
        <button className="ghost" type="button" onClick={() => void refresh()} disabled={loading}>
          {loading ? 'Actualizando...' : 'Actualizar'}
        </button>
      </div>

      {error && <div className="form-error">{error}</div>}

      <div className="dashboard-metrics">
        <div className="dashboard-metric">
          <span>Sesiones</span>
          <strong>{sessions.length}</strong>
        </div>
        <div className="dashboard-metric">
          <span>Videos</span>
          <strong>{summary.videoCount}</strong>
        </div>
        <div className="dashboard-metric">
          <span>Segmentos</span>
          <strong>{summary.sentSegmentCount}</strong>
        </div>
        <div className="dashboard-metric">
          <span>Tiempo anotado</span>
          <strong>{formatTime(summary.totalAnnotatedSeconds)}</strong>
        </div>
        <div className="dashboard-metric">
          <span>Duracion promedio</span>
          <strong>{decimalFormatter.format(summary.averageSegmentSeconds)} s</strong>
        </div>
        {canReadAll && (
          <div className="dashboard-metric">
            <span>Anotadores</span>
            <strong>{summary.annotatorCount}</strong>
          </div>
        )}
      </div>

      <div className="dashboard-grid">
        <section className="dashboard-section">
          <div className="dashboard-section-heading">
            <h4>Sesiones por estado</h4>
            <span>{sessions.length} sesiones</span>
          </div>
          <div className="dashboard-bars">
            {summary.statusStats.map((status) => (
              <div className="dashboard-bar-row" key={status.id}>
                <span>{status.label}</span>
                <div className="dashboard-bar-track">
                  <span
                    className="dashboard-bar-fill"
                    style={{ width: `${(status.count / summary.maxStatusCount) * 100}%`, backgroundColor: status.color }}
                  />
                </div>
                <strong>{status.count}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="dashboard-section">
          <div className="dashboard-section-heading">
            <h4>Segmentos por accion</h4>
            <span>{summary.sentSegmentCount} segmentos enviados</span>
          </div>
          {summary.actionStats.length === 0 ? (
            <p className="placeholder-text">No hay segmentos para graficar.</p>
          ) : (
            <div className="dashboard-bars">
              {summary.actionStats.map((action) => (
                <div className="dashboard-bar-row" key={action.id}>
                  <span>{action.label}</span>
                  <div className="dashboard-bar-track">
                    <span
                      className="dashboard-bar-fill"
                      style={{
                        width: `${(action.count / summary.maxActionCount) * 100}%`,
                        backgroundColor: action.color,
                      }}
                    />
                  </div>
                  <strong>{action.count}</strong>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="dashboard-section">
        <div className="dashboard-section-heading">
          <h4>Actividad por anotador</h4>
          <span>Segmentos y tiempo solo de videos enviados</span>
        </div>
        <div className="dashboard-table-wrapper">
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Anotador</th>
                <th>Videos enviados</th>
                <th>Videos en borrador</th>
                <th>Sesiones</th>
                <th>Segmentos</th>
                <th>Tiempo anotado</th>
              </tr>
            </thead>
            <tbody>
              {summary.annotatorRows.map((row) => (
                <tr key={row.id}>
                  <td>{row.annotator}</td>
                  <td>{row.sentVideos.size}</td>
                  <td>{row.draftVideos.size}</td>
                  <td>{row.sessionCount}</td>
                  <td>{row.segmentCount}</td>
                  <td>{formatTime(row.annotatedSeconds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {summary.annotatorRows.length === 0 && <p className="placeholder-text">No hay actividad registrada.</p>}
        </div>
      </section>

      <section className="dashboard-section">
        <div className="dashboard-section-heading">
          <h4>Detalle por video y anotador</h4>
          <span>Segmentos y tiempo solo de videos enviados</span>
        </div>
        <div className="dashboard-table-wrapper">
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Video</th>
                <th>Anotador</th>
                <th>Sesiones</th>
                <th>Segmentos</th>
                <th>Tiempo anotado</th>
              </tr>
            </thead>
            <tbody>
              {summary.videoRows.map((row) => (
                <tr key={row.id}>
                  <td>{row.video}</td>
                  <td>{row.annotator}</td>
                  <td>{row.sessionCount}</td>
                  <td>{row.segmentCount}</td>
                  <td>{formatTime(row.annotatedSeconds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {summary.videoRows.length === 0 && <p className="placeholder-text">No hay videos registrados.</p>}
        </div>
      </section>
    </div>
  )
}
