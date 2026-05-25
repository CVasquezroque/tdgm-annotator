import type { AnnotationSession, Segment, VideoMeta } from '../types'
import {
  buildAnnotationsCsv,
  buildUnifiedSegmentsCsv,
  exportAnnotationsToCsv,
  exportAnnotationsToJson,
  exportTextFile,
} from '../services/exports'
import {
  listReviewableSessions,
  listUnifiedSegmentsForExport,
  loadSessionBundle,
  timestampToIso,
} from '../services/annotationSessions'
import { APP_VERSION } from '../constants/app'

interface Props {
  uid: string
  videoMeta: VideoMeta | null
  session: AnnotationSession | null
  segments: Segment[]
  canExportAll: boolean
}

function metaFor(session: AnnotationSession) {
  return {
    sessionId: session.session_id,
    videoCode: session.video_code,
    videoFilename: session.video_filename,
    annotatorUid: session.annotator_uid,
    annotatorCode: session.annotator_code,
    status: session.status,
    createdAt: timestampToIso(session.created_at) ?? '',
    updatedAt: timestampToIso(session.updated_at) ?? '',
    submittedAt: timestampToIso(session.submitted_at),
    reviewedAt: timestampToIso(session.reviewed_at),
    lockedAt: timestampToIso(session.locked_at),
    appVersion: session.app_version || APP_VERSION,
    project: 'DIANA' as const,
  }
}

export function ExportPanel({ uid, videoMeta, session, segments, canExportAll }: Props) {
  const canExportCurrent = Boolean(videoMeta && session && segments.length > 0)

  const exportCurrent = (format: 'csv' | 'json') => {
    if (!videoMeta || !session) return
    const input = { videoMeta, session: metaFor(session), segments }
    if (format === 'csv') exportAnnotationsToCsv(input)
    else exportAnnotationsToJson(input)
  }

  const exportConsolidated = async (status?: AnnotationSession['status']) => {
    const sessions = await listReviewableSessions()
    const rows: string[] = []
    for (const item of sessions.filter((candidate) => !status || candidate.status === status)) {
      const bundle = await loadSessionBundle(item.session_id)
      if (!bundle) continue
      const csv = buildAnnotationsCsv({
        videoMeta: { source: 'local', duration: 0, codedFilename: bundle.session.video_filename },
        session: metaFor(bundle.session),
        segments: bundle.segments,
      })
      const [, ...body] = csv.split('\n')
      rows.push(...body.filter(Boolean))
    }
    const header =
      'project,schema_version,session_id,video_code,video_filename,action,start_sec,end_sec,repetition_id,annotator_code,status,created_at,updated_at,submitted_at,reviewed_at,locked_at,notes,app_version'
    exportTextFile([header, ...rows].join('\n'), `DIANA_${status ?? 'all'}_sessions.csv`)
  }

  const exportFirestoreSegments = async () => {
    const firestoreSegments = await listUnifiedSegmentsForExport({ uid, canReadAll: canExportAll })
    const csv = buildUnifiedSegmentsCsv(firestoreSegments)
    const scope = canExportAll ? 'all' : 'my'
    exportTextFile(csv, `DIANA_segments_${scope}.csv`)
  }

  return (
    <div className="compact-panel export-panel">
      <div className="panel-header">
        <h3>Exportar</h3>
      </div>
      <div className="export-actions">
        <button disabled={!canExportCurrent} onClick={() => exportCurrent('json')}>
          Exportar JSON
        </button>
        <button disabled={!canExportCurrent} onClick={() => exportCurrent('csv')}>
          Exportar CSV
        </button>
        {canExportAll && (
          <>
            <button className="secondary" onClick={() => void exportFirestoreSegments()}>
              Todos los segmentos
            </button>
            <button className="secondary" onClick={() => void exportConsolidated()}>
              Consolidado
            </button>
            <button className="secondary" onClick={() => void exportConsolidated('reviewed')}>
              Revisados
            </button>
            <button className="secondary" onClick={() => void exportConsolidated('locked')}>
              Bloqueados
            </button>
          </>
        )}
        {!canExportAll && (
          <button className="secondary" onClick={() => void exportFirestoreSegments()}>
            Mis segmentos
          </button>
        )}
      </div>
    </div>
  )
}
