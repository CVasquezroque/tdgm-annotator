import { useMemo, useRef, useState } from 'react'
import './App.css'
import { VideoLoader } from './components/VideoLoader'
import { VideoPlayer } from './components/VideoPlayer'
import { PlaybackControls } from './components/PlaybackControls'
import { Timeline } from './components/Timeline'
import { SegmentTrack } from './components/SegmentTrack'
import { SegmentList } from './components/SegmentList'
import { AnnotationForm } from './components/AnnotationForm'
import type { AnnotationDraft } from './components/AnnotationForm'
import { ShortcutsHelp } from './components/ShortcutsHelp'
import type { Segment, VideoMeta } from './types'
import { TGMD_ACTIONS } from './constants/actions'
import { exportAnnotationsToCsv } from './utils/csvExport'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useThumbnailGenerator } from './hooks/useThumbnailGenerator'
import { formatTime } from './utils/time'

function App() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [videoSrc, setVideoSrc] = useState<string | null>(null)
  const [videoMeta, setVideoMeta] = useState<VideoMeta | null>(null)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [segments, setSegments] = useState<Segment[]>([])
  const [pendingStart, setPendingStart] = useState<number | null>(null)
  const [pendingEnd, setPendingEnd] = useState<number | null>(null)
  const [draft, setDraft] = useState<AnnotationDraft | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  const { previewUrl, previewTime, requestPreview } = useThumbnailGenerator(videoSrc)

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
      action: TGMD_ACTIONS[0].id,
      startSec: pendingStart,
      endSec: currentTime,
    })
  }

  const handleSubmitSegment = (segment: Segment) => {
    setSegments((prev) => {
      const filtered = prev.filter((p) => p.id !== segment.id)
      return [...filtered, segment].sort((a, b) => a.startSec - b.startSec)
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

  const handleActionShortcut = (actionId: string) => {
    if (draft) {
      setDraft((d) => (d ? { ...d, action: actionId as typeof d.action } : d))
      setStatus(`Acción preseleccionada: ${actionId}`)
    }
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
    onChooseAction: handleActionShortcut,
    actions: TGMD_ACTIONS,
  })

  const currentVideoId = useMemo(() => videoMeta?.fileName ?? 'video', [videoMeta])

  const canExport = videoMeta && segments.length > 0

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
        <section className="player-section">
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
            <SegmentTrack segments={segments} duration={duration} onSelect={(s) => handleSeek(s.startSec)} />
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
                draft={draft}
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
