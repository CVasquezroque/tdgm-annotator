import { APP_VERSION, EXPORT_SCHEMA_VERSION, PROJECT_NAME } from '../constants/app'
import type { AnnotationSessionExportMeta, Segment, VideoMeta } from '../types'

interface ExportInput {
  segments: Segment[]
  videoMeta: VideoMeta
  session: AnnotationSessionExportMeta
}

function escapeCsvField(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return ''
  const str = String(value)
  if (str.includes('"') || str.includes(',') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function safeFilePart(value: string) {
  return value.replace(/[^A-Z0-9_-]/gi, '_').slice(0, 80) || 'video'
}

function downloadBlob(blob: Blob, downloadName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = downloadName
  link.click()
  URL.revokeObjectURL(url)
}

export function buildSessionExport(input: ExportInput) {
  const { segments, videoMeta, session } = input

  return {
    schema_version: EXPORT_SCHEMA_VERSION,
    project: PROJECT_NAME,
    video: {
      video_code: session.videoCode,
      video_filename: session.videoFilename,
      duration_sec: videoMeta.duration,
      source: videoMeta.source,
    },
    annotation_session: {
      session_id: session.sessionId,
      annotator_uid: session.annotatorUid,
      annotator_code: session.annotatorCode,
      status: session.status ?? 'draft',
      created_at: session.createdAt,
      updated_at: session.updatedAt,
      submitted_at: session.submittedAt ?? null,
      reviewed_at: session.reviewedAt ?? null,
      locked_at: session.lockedAt ?? null,
      app_version: session.appVersion,
    },
    segments: segments.map((segment) => ({
      id: segment.id,
      action: segment.action,
      start_sec: segment.startSec,
      end_sec: segment.endSec,
      repetition_id: segment.repetitionId ?? '',
      notes: segment.notes ?? '',
    })),
  }
}

export function buildAnnotationsCsv(input: ExportInput) {
  const header = [
    'project',
    'schema_version',
    'session_id',
    'video_code',
    'video_filename',
    'action',
    'start_sec',
    'end_sec',
    'repetition_id',
    'annotator_code',
    'status',
    'created_at',
    'updated_at',
    'submitted_at',
    'reviewed_at',
    'locked_at',
    'notes',
    'app_version',
  ]

  const rows = input.segments.map((segment) => [
    PROJECT_NAME,
    EXPORT_SCHEMA_VERSION,
    input.session.sessionId,
    input.session.videoCode,
    input.session.videoFilename,
    segment.action,
    segment.startSec,
    segment.endSec,
    segment.repetitionId ?? '',
    input.session.annotatorCode,
    input.session.status ?? 'draft',
    input.session.createdAt,
    input.session.updatedAt,
    input.session.submittedAt ?? '',
    input.session.reviewedAt ?? '',
    input.session.lockedAt ?? '',
    segment.notes ?? '',
    APP_VERSION,
  ])

  return [header, ...rows].map((row) => row.map((cell) => escapeCsvField(cell)).join(',')).join('\n')
}

export function exportAnnotationsToJson(input: ExportInput) {
  const payload = buildSessionExport(input)
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8;' })
  downloadBlob(blob, `${safeFilePart(input.session.videoFilename)}_${safeFilePart(input.session.sessionId)}.json`)
}

export function exportAnnotationsToCsv(input: ExportInput) {
  const csv = buildAnnotationsCsv(input)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  downloadBlob(blob, `${safeFilePart(input.session.videoFilename)}_${safeFilePart(input.session.sessionId)}.csv`)
}

export function exportTextFile(content: string, downloadName: string, type = 'text/csv;charset=utf-8;') {
  downloadBlob(new Blob([content], { type }), downloadName)
}
