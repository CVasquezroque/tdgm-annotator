import { useMemo, useRef, useState } from 'react'
import './App.css'
import { VideoLoader } from './components/VideoLoader'
import { VideoPlayer } from './components/VideoPlayer'
import { PlaybackControls } from './components/PlaybackControls'
import { Timeline } from './components/Timeline'
import { ActionTimeline } from './components/ActionTimeline'
import { SegmentList } from './components/SegmentList'
import { AnnotationForm } from './components/AnnotationForm'
import type { AnnotationDraft } from './components/AnnotationForm'
import { ShortcutsHelp } from './components/ShortcutsHelp'
import { LoginCard } from './components/LoginCard'
import type { Segment, VideoMeta } from './types'
import { TGMD_ACTIONS } from './constants/actions'
import { exportAnnotationsToCsv } from './utils/csvExport'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useThumbnailGenerator } from './hooks/useThumbnailGenerator'
import { formatTime } from './utils/time'
import { useAuth } from './hooks/useAuth'

function App() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [videoSrc, setVideoSrc] = useState<string | null>(null)
  const [videoMeta, setVideoMeta] = useState<VideoMeta | null>(null)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [isExpanded, setIsExpanded] = useState(false)
  const [selectedAction, setSelectedAction] = useState(TGMD_ACTIONS[0].id)
  const [segments, setSegments] = useState<Segment[]>([])
  const [pendingStart, setPendingStart] = useState<number | null>(null)
  const [pendingEnd, setPendingEnd] = useState<number | null>(null)
  const [draft, setDraft] = useState<AnnotationDraft | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const { user, login, register, loading: authLoading, error: authError } = useAuth()

  const { previewUrl, previewTime, requestPreview } = useThumbnailGenerator(videoSrc)

  const nextRepetitionFor = (actionId: string) => {
    const count = segments.filter((s) => s.action === actionId).length
    return String(count + 1)
  }

  const resetAnnotationState = () => {
    setPendingStart(null)
    setPendingEnd(null)
    setDraft(null)
  }

  const handleVideoSelected = (file: File) => {
    const src = URL.createObjectURL(file)
    setVideoSrc(src)
    setVideoMeta({ fileName: file.name, filePath: file.name, duration: 0 })
    setDuration(0)
    setSegments([])
    resetAnnotationState()
    setStatus(null)
    setIsPlaying(false)
    setCurrentTime(0)
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.currentTime = 0
    }
  }

  const togglePlay = () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      void video.play()
      setIsPlaying(true)
      setIsExpanded(true)
    } else {
      video.pause()
      setIsPlaying(false)
    }
  }

  const handleSeek = (time: number) => {
    if (!videoRef.current) return
    videoRef.current.currentTime = time
    setCurrentTime(time)
  }

  const markStart = () => {
    setPendingStart(currentTime)
    setPendingEnd(null)
    setStatus(`Inicio marcado en ${formatTime(currentTime)}`)
    setDraft(null)
  }

  const markEnd = () => {
    if (pendingStart === null) {
      setStatus('Primero marca el inicio.')
      return
    }
    if (currentTime <= pendingStart) {
      setStatus('El fin debe ser mayor que el inicio.')
      return
    }
    setPendingEnd(currentTime)
    setStatus(`Fin marcado en ${formatTime(currentTime)}. Completa el formulario.`)
    setDraft({
      action: selectedAction,
      startSec: pendingStart,
      endSec: currentTime,
      annotatorId: user?.username,
      repetitionId: nextRepetitionFor(selectedAction),
    })
  }

  const handleSubmitSegment = (segment: Segment) => {
    const repetition =
      segment.repetitionId && segment.repetitionId.trim().length > 0
        ? segment.repetitionId
        : nextRepetitionFor(segment.action)
    const withAnnotator = user?.username ? { ...segment, annotatorId: user.username, repetitionId: repetition } : { ...segment, repetitionId: repetition }
    setSegments((prev) => {
      const filtered = prev.filter((p) => p.id !== segment.id)
      return [...filtered, withAnnotator].sort((a, b) => a.startSec - b.startSec)
    })
    resetAnnotationState()
    setStatus('Segmento guardado.')
  }

  const handleEditSegment = (segment: Segment) => {
    setDraft({ ...segment })
    setPendingStart(segment.startSec)
    setPendingEnd(segment.endSec)
  }

  const handleDeleteSegment = (id: string) => {
    setSegments((prev) => prev.filter((s) => s.id !== id))
    setStatus('Segmento eliminado.')
  }

  const jump = (delta: number) => {
    if (!videoRef.current) return
    const next = Math.min(Math.max(0, currentTime + delta), duration || currentTime)
    videoRef.current.currentTime = next
    setCurrentTime(next)
  }

  useKeyboardShortcuts({
    onTogglePlay: togglePlay,
    onMarkStart: markStart,
    onMarkEnd: markEnd,
    onJumpBackward: () => jump(-2),
    onJumpForward: () => jump(2),
    onChooseAction: undefined,
    actions: [],
  })

  const currentVideoId = useMemo(() => videoMeta?.fileName ?? 'video', [videoMeta])

  const canExport = videoMeta && segments.length > 0

  if (authLoading) {
    return (
      <div className="auth-shell">
        <div className="login-card">
          <p>Cargando sesión...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="auth-shell">
        <LoginCard onLogin={login} onRegister={register} error={authError} />
      </div>
    )
  }

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>TGMD-3 Video Annotator</h1>
          <p>Herramienta local para segmentación manual de TGMD-3.</p>
        </div>
        <div className="header-actions">
          <VideoLoader onVideoSelected={handleVideoSelected} />
          {videoMeta && (
            <div className="video-meta">
              <div>
                <strong>Archivo:</strong> {videoMeta.fileName}
              </div>
              <div>
                <strong>Duración:</strong> {formatTime(duration)}
              </div>
            </div>
          )}
          <button
            disabled={!canExport}
            onClick={() => videoMeta && exportAnnotationsToCsv(segments, { ...videoMeta, duration })}
          >
            <img className="icon" src="/icon-download.png" alt="" />
            Exportar CSV
          </button>
        </div>
      </header>

      <ShortcutsHelp />

      <main className="layout">
        {isExpanded && <div className="overlay-backdrop" onClick={() => setIsExpanded(false)} />}
        <section className={`player-section ${isExpanded ? 'expanded' : ''}`}>
          <VideoPlayer
            src={videoSrc}
            videoRef={videoRef}
            isPlaying={isPlaying}
            playbackRate={playbackRate}
            onDuration={(d) => {
              setDuration(d)
              setVideoMeta((m) => (m ? { ...m, duration: d } : m))
            }}
            onTimeUpdate={(t) => setCurrentTime(t)}
            onEnded={() => setIsPlaying(false)}
            onPlayStateChange={(playing) => setIsPlaying(playing)}
          />
          <PlaybackControls
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            playbackRate={playbackRate}
            onTogglePlay={togglePlay}
            onChangeSpeed={(r) => setPlaybackRate(r)}
            onJumpBackward={() => jump(-2)}
            onJumpForward={() => jump(2)}
          />
          <div className="marker-row">
            <button onClick={markStart}>
              <img className="icon" src="/icon-flag.png" alt="" />
              Marcar inicio
            </button>
            <button onClick={markEnd}>
              <img className="icon" src="/icon-flag.png" alt="" />
              Marcar fin
            </button>
            <div className="pending">
              {pendingStart !== null && <span>Inicio: {formatTime(pendingStart)}</span>}
              {pendingEnd !== null && <span>Fin: {formatTime(pendingEnd)}</span>}
            </div>
            {status && <span className="status">{status}</span>}
            <div className="action-selector">
              <img className="icon icon-tag" src="/icon-tag.png" alt="" />
              <label>
                Acción a anotar
                <select
                  value={selectedAction}
                  onChange={(e) => {
                    const val = e.target.value as typeof selectedAction
                    setSelectedAction(val)
                    setDraft((d) =>
                      d
                        ? { ...d, action: val, repetitionId: nextRepetitionFor(val) }
                        : d,
                    )
                  }}
                >
                  {TGMD_ACTIONS.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          <div className="timeline-header">
            <img className="icon" src="/icon-timeline.png" alt="" />
            <span>Línea de tiempo y segmentos</span>
          </div>
          <Timeline
            duration={duration}
            currentTime={currentTime}
            onSeek={handleSeek}
            onRequestPreview={requestPreview}
            previewUrl={previewUrl}
            previewTime={previewTime ?? undefined}
          >
            <ActionTimeline segments={segments} duration={duration} onSelect={(s) => handleSeek(s.startSec)} />
          </Timeline>
        </section>

        <section className="side-panel">
          <div className="panel-card">
            <div className="panel-header">
              <h3>Segmentos ({segments.length})</h3>
            </div>
            <div className="segment-table-wrapper">
              <SegmentList
                segments={segments}
                onEdit={handleEditSegment}
                onDelete={handleDeleteSegment}
                onSeek={handleSeek}
              />
            </div>
          </div>

          <div className="panel-card">
            <div className="panel-header">
              <h3>Formulario de anotación</h3>
              <span className="video-id">Video ID: {currentVideoId}</span>
            </div>
            {draft ? (
              <AnnotationForm
                key={draft.id ?? `${draft.startSec}-${draft.endSec}`}
                draft={{ ...draft, annotatorId: user.username }}
                annotatorLocked={user.username}
                onCancel={resetAnnotationState}
                onSubmit={handleSubmitSegment}
              />
            ) : (
              <p className="placeholder-text">
                Marca un inicio y un fin (o edita un segmento) para rellenar los datos de TGMD-3.
              </p>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
