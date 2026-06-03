import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import type { ActionId, AnnotationSession, Segment } from '../types'
import { ACTION_BY_ID } from '../constants/actions'
import { useThumbnailGenerator } from '../hooks/useThumbnailGenerator'
import { saveReviewedSessionSegments, saveReviewSessionNotes } from '../services/annotationSessions'
import { formatTime } from '../utils/time'
import { codedFilenameFromFile } from '../utils/video'
import { ActionTimeline } from './ActionTimeline'
import { AnnotationForm } from './AnnotationForm'
import { PlaybackControls } from './PlaybackControls'
import { SegmentList } from './SegmentList'
import { SegmentLoopPreview } from './SegmentLoopPreview'
import { Timeline } from './Timeline'
import { VideoPlayer } from './VideoPlayer'

export type ReviewViewerMode = 'view' | 'review'

interface Props {
  mode: ReviewViewerMode
  session: AnnotationSession
  segments: Segment[]
  onClose: () => void
  onSaved?: (segments: Segment[]) => void
}

function isPermissionDenied(error: unknown) {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      ((error as { code: unknown }).code === 'permission-denied' ||
        (error as { code: unknown }).code === 'PERMISSION_DENIED'),
  )
}

export function ReviewSessionViewer({ mode, session, segments, onClose, onSaved }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const objectUrlRef = useRef<string | null>(null)
  const [videoSrc, setVideoSrc] = useState<string | null>(null)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [fileError, setFileError] = useState<string | null>(null)
  const [poseSummaryEnabled, setPoseSummaryEnabled] = useState(false)
  const [isPoseProcessing, setIsPoseProcessing] = useState(false)
  const [workingSegments, setWorkingSegments] = useState<Segment[]>(() =>
    segments.map((segment) => ({ ...segment, annotatorId: segment.annotatorId ?? session.annotator_code })),
  )
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(segments[0]?.id ?? null)
  const [editingSegment, setEditingSegment] = useState<Segment | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const { previewUrl, previewTime, requestPreview } = useThumbnailGenerator(videoSrc, !isPlaying && !isPoseProcessing)

  const expectedFilename = session.video_filename || session.video_code
  const timelineDuration = useMemo(
    () => duration || Math.max(0, ...workingSegments.map((segment) => segment.endSec)),
    [duration, workingSegments],
  )
  const selectedSegment = useMemo(
    () => workingSegments.find((segment) => segment.id === selectedSegmentId) ?? null,
    [selectedSegmentId, workingSegments],
  )
  const reviewEditable = mode === 'review' && session.status === 'submitted'
  const canEdit = reviewEditable && Boolean(videoSrc)
  const canEditNotes = mode === 'view' || reviewEditable

  useEffect(
    () => () => {
      const video = videoRef.current
      if (video) {
        video.pause()
        video.removeAttribute('src')
        video.load()
      }
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    },
    [],
  )

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleVideoSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    const selectedFilename = codedFilenameFromFile(file)
    if (selectedFilename !== expectedFilename && selectedFilename !== session.video_code) {
      setFileError(`El archivo seleccionado no coincide. Carga: ${expectedFilename}`)
      return
    }

    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    const nextSrc = URL.createObjectURL(file)
    objectUrlRef.current = nextSrc
    setVideoSrc(nextSrc)
    setDuration(0)
    setCurrentTime(0)
    setIsPlaying(false)
    setFileError(null)
    setSaveMessage(null)
  }

  const handleSeek = (time: number) => {
    const next = Math.min(Math.max(0, time), timelineDuration || time)
    if (videoRef.current) videoRef.current.currentTime = next
    setCurrentTime(next)
  }

  const selectSegment = (segment: Segment) => {
    setSelectedSegmentId(segment.id)
    handleSeek(segment.startSec)
  }

  const togglePlay = () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) void video.play()
    else video.pause()
  }

  const jump = (delta: number) => handleSeek(currentTime + delta)

  const nextRepetitionFor = (action: ActionId, excludeSegmentId: string) => {
    const count = workingSegments.filter(
      (segment) => segment.action === action && segment.id !== excludeSegmentId,
    ).length
    return String(count + 1)
  }

  const handleEditedSegment = (segment: Segment) => {
    setWorkingSegments((current) =>
      current
        .map((item) => (item.id === segment.id ? { ...segment, annotatorId: session.annotator_code } : item))
        .sort((a, b) => a.startSec - b.startSec),
    )
    setSelectedSegmentId(segment.id)
    setEditingSegment(null)
    setDirty(true)
    setSaveMessage(null)
    setSaveError(null)
  }

  const handleSelectedNoteChange = (notes: string) => {
    if (!selectedSegment || !canEditNotes) return
    setWorkingSegments((current) =>
      current.map((segment) => (segment.id === selectedSegment.id ? { ...segment, notes } : segment)),
    )
    setDirty(true)
    setSaveMessage(null)
    setSaveError(null)
  }

  const saveChanges = async () => {
    if (!dirty || (mode === 'review' && !reviewEditable)) return
    setSaving(true)
    setSaveError(null)
    setSaveMessage(null)
    try {
      if (mode === 'review') await saveReviewedSessionSegments(session, workingSegments)
      else await saveReviewSessionNotes(session, workingSegments)
      setDirty(false)
      setSaveMessage(mode === 'review' ? 'Cambios de revision guardados.' : 'Notas guardadas.')
      onSaved?.(workingSegments)
    } catch (error) {
      console.warn('No se pudieron guardar los cambios de revision.', error)
      setSaveError(
        isPermissionDenied(error)
          ? 'Firestore rechazo el guardado. Verifica que las reglas actualizadas esten publicadas para el proyecto.'
          : 'No se pudieron guardar los cambios. Revisa tu conexion.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="review-viewer-backdrop" onClick={onClose}>
      <div
        className="review-viewer-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-viewer-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="review-viewer-header">
          <div>
            <span className="section-kicker">{mode === 'review' ? 'Editar revision' : 'Ver y editar notas'}</span>
            <h3 id="review-viewer-title">{expectedFilename}</h3>
          </div>
          <div className="review-viewer-header-actions">
            <label className="preference-check">
              <input
                type="checkbox"
                checked={poseSummaryEnabled}
                onChange={(event) => setPoseSummaryEnabled(event.target.checked)}
              />
              Pose en resumen
            </label>
            <button type="button" onClick={() => void saveChanges()} disabled={!dirty || saving}>
              {saving ? 'Guardando...' : mode === 'review' ? 'Guardar cambios' : 'Guardar notas'}
            </button>
            <button type="button" className="secondary" onClick={onClose}>
              Cerrar
            </button>
          </div>
        </div>

        <div className="review-video-request">
          <div>
            <strong>Video requerido</strong>
            <span>{expectedFilename}</span>
          </div>
          <label className="file-picker review-file-picker">
            <img className="icon" src="/icon-upload.png" alt="" />
            <span>Cargar video para revisar</span>
            <input type="file" accept="video/*" onChange={handleVideoSelected} />
          </label>
        </div>
        {fileError && <div className="form-error">{fileError}</div>}
        {saveError && <div className="form-error">{saveError}</div>}
        {saveMessage && <div className="form-status">{saveMessage}</div>}
        {mode === 'review' && !videoSrc && (
          <div className="review-viewer-note">Carga el video requerido para habilitar la edicion de segmentos.</div>
        )}

        <div className="review-viewer-main">
          <section className="review-viewer-player">
            <VideoPlayer
              src={videoSrc}
              videoRef={videoRef}
              isPlaying={isPlaying}
              playbackRate={playbackRate}
              isMuted={isMuted}
              onTimeUpdate={setCurrentTime}
              onDuration={setDuration}
              onPlayStateChange={setIsPlaying}
            />
            <PlaybackControls
              isPlaying={isPlaying}
              currentTime={currentTime}
              duration={timelineDuration}
              playbackRate={playbackRate}
              isMuted={isMuted}
              onTogglePlay={togglePlay}
              onToggleMute={() => setIsMuted((current) => !current)}
              onChangeSpeed={setPlaybackRate}
              onJumpBackward={() => jump(-2)}
              onJumpForward={() => jump(2)}
            />
            <Timeline
              duration={timelineDuration}
              currentTime={currentTime}
              onSeek={handleSeek}
              onRequestPreview={requestPreview}
              previewUrl={previewUrl}
              previewTime={previewTime ?? undefined}
              previewEnabled={Boolean(videoSrc && !isPlaying && !isPoseProcessing)}
            >
              <ActionTimeline segments={workingSegments} duration={timelineDuration} onSelect={selectSegment} />
            </Timeline>

            {videoSrc && selectedSegment && !editingSegment && (
              <div className="review-segment-summary">
                <div className="preview-header">
                  <span className="preview-label">Resumen del segmento seleccionado</span>
                  <span className="video-id">
                    {ACTION_BY_ID[selectedSegment.action]?.label ?? selectedSegment.action} ·{' '}
                    {formatTime(selectedSegment.startSec)} - {formatTime(selectedSegment.endSec)}
                  </span>
                </div>
                <SegmentLoopPreview
                  videoSrc={videoSrc}
                  startSec={selectedSegment.startSec}
                  endSec={selectedSegment.endSec}
                  enablePose={poseSummaryEnabled}
                  onPoseProcessingChange={setIsPoseProcessing}
                />
              </div>
            )}
          </section>

          <section className="review-viewer-segments">
            {selectedSegment && !editingSegment && (
              <div className="review-note-editor">
                <div className="review-note-heading">
                  <div>
                    <span className="section-kicker">Nota del segmento</span>
                    <strong>{ACTION_BY_ID[selectedSegment.action]?.label ?? selectedSegment.action}</strong>
                  </div>
                  <span>
                    {formatTime(selectedSegment.startSec)} - {formatTime(selectedSegment.endSec)}
                  </span>
                </div>
                <textarea
                  value={selectedSegment.notes ?? ''}
                  onChange={(event) => handleSelectedNoteChange(event.target.value)}
                  rows={4}
                  placeholder="Sin nota registrada"
                  disabled={!canEditNotes}
                />
                <small>No incluyas nombres, DNI, colegios ni identificadores personales del menor.</small>
              </div>
            )}
            {editingSegment && canEdit ? (
              <>
                <div className="panel-header">
                  <h3>Editar segmento</h3>
                </div>
                <AnnotationForm
                  key={editingSegment.id}
                  draft={{ ...editingSegment, annotatorId: session.annotator_code }}
                  annotatorLocked={session.annotator_code}
                  videoSrc={videoSrc}
                  showAutomaticPose={poseSummaryEnabled}
                  onPoseProcessingChange={setIsPoseProcessing}
                  onActionChange={(action) => nextRepetitionFor(action, editingSegment.id)}
                  onCancel={() => setEditingSegment(null)}
                  onSubmit={handleEditedSegment}
                />
              </>
            ) : (
              <>
                <div className="panel-header">
                  <h3>Segmentos anotados ({workingSegments.length})</h3>
                </div>
                <div className="segment-table-wrapper">
                  <SegmentList
                    segments={workingSegments}
                    onEdit={(segment) => setEditingSegment(segment)}
                    onDelete={() => {}}
                    onSeek={handleSeek}
                    onSelect={selectSegment}
                    readOnly={!canEdit}
                    allowDelete={false}
                  />
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
