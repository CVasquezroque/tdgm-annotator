import type { Segment, VideoMeta } from '../types'

function escapeCsvField(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return ''
  const str = String(value)
  if (str.includes('"') || str.includes(',') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function inferVideoId(fileName: string): string {
  const withoutExt = fileName.includes('.') ? fileName.split('.').slice(0, -1).join('.') : fileName
  return withoutExt || 'video'
}

export function exportAnnotationsToCsv(segments: Segment[], videoMeta: VideoMeta) {
  const header = [
    'video_id',
    'file_path',
    'action',
    'start_sec',
    'end_sec',
    'repetition_id',
    'annotator_id',
    'notes',
  ]

  const videoId = inferVideoId(videoMeta.fileName)
  const rows = segments.map((s) => [
    videoId,
    videoMeta.filePath,
    s.action,
    s.startSec,
    s.endSec,
    s.repetitionId ?? '',
    s.annotatorId ?? '',
    s.notes ?? '',
  ])

  const csv = [header, ...rows]
    .map((row) => row.map((cell) => escapeCsvField(cell)).join(','))
    .join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${videoId}_annotations.csv`
  link.click()
  URL.revokeObjectURL(url)
}

