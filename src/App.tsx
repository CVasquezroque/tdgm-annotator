import { useEffect, useMemo, useRef, useState } from 'react'
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
import type { ActionId, Segment, VideoMeta } from './types'
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
  const [isVideoLoading, setIsVideoLoading] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const [selectedAction, setSelectedAction] = useState<ActionId | ''>('')
  const [segments, setSegments] = useState<Segment[]>([])
  const [pendingStart, setPendingStart] = useState<number | null>(null)
  const [pendingEnd, setPendingEnd] = useState<number | null>(null)
  const [draft, setDraft] = useState<AnnotationDraft | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [markError, setMarkError] = useState<string | null>(null)
  const [showFormModal, setShowFormModal] = useState(false)
  const [lastSaved, setLastSaved] = useState<Segment | null>(null)
  const [pendingSeek, setPendingSeek] = useState<number | null>(null)
  const { user, login, register, resetPassword, clearError, loading: authLoading, error: authError } = useAuth()

  const { previewUrl, previewTime, requestPreview } = useThumbnailGenerator(videoSrc)

  const nextRepetitionFor = (actionId: ActionId | '') => {
    if (!actionId) return ''
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
    setIsVideoLoading(true)
    setDuration(0)
    setSegments([])
    resetAnnotationState()
    setStatus(null)
    setIsPlaying(false)
    setCurrentTime(0)
    setShowFormModal(false)
    setLastSaved(null)
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
    setPendingSeek(time)
  }

  const markStart = () => {
    if (!selectedAction) {
      setMarkError('Debes escoger una acción.')
      return
    }
    setMarkError(null)
    setPendingStart(currentTime)
    setPendingEnd(null)
    setStatus(`Inicio marcado en ${formatTime(currentTime)}`)
    setDraft(null)
  }

  const markEnd = () => {
    if (!selectedAction) {
      setMarkError('Debes escoger una acción.')
      return
    }
    setMarkError(null)
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
    setIsExpanded(false)
    setPendingSeek(currentTime)
    setShowFormModal(true)
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
    const msg = `Segmento guardado: ${withAnnotator.action} ${formatTime(withAnnotator.startSec)} - ${formatTime(withAnnotator.endSec)}`
    setStatus(msg)
    setLastSaved(withAnnotator)
    setSelectedAction('')
    setIsExpanded(false)
    setShowFormModal(false)
    // Mantener el video en el punto final del segmento guardado
    setPendingSeek(segment.endSec)
    setCurrentTime(segment.endSec)
  }

  const handleEditSegment = (segment: Segment) => {
    setDraft({ ...segment })
    setPendingStart(segment.startSec)
    setPendingEnd(segment.endSec)
    setSelectedAction(segment.action)
    setIsExpanded(false)
    setPendingSeek(segment.startSec)
    setShowFormModal(true)
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

  const jumpPrecise = (delta: number) => {
    if (!videoRef.current) return
    const next = Math.min(Math.max(0, currentTime + delta), duration || currentTime)
    videoRef.current.currentTime = next
    setCurrentTime(next)
  }

  const selectAction = (val: ActionId | '') => {
    setSelectedAction(val)
    setDraft((d) => {
      if (!val) return null
      return d ? { ...d, action: val, repetitionId: nextRepetitionFor(val) } : d
    })
  }

  useKeyboardShortcuts({
    onTogglePlay: togglePlay,
    onMarkStart: markStart,
    onMarkEnd: markEnd,
    onJumpBackward: () => jump(-2),
    onJumpForward: () => jump(2),
    onJumpBackwardPrecise: () => jumpPrecise(-0.04),
    onJumpForwardPrecise: () => jumpPrecise(0.04),
    onSaveSegment: () => {
      if (draft && draft.endSec > draft.startSec) {
        handleSubmitSegment({
          id: draft.id ?? crypto.randomUUID?.() ?? String(Date.now()),
          action: draft.action,
          startSec: draft.startSec,
          endSec: draft.endSec,
          repetitionId: draft.repetitionId,
          annotatorId: draft.annotatorId,
          notes: draft.notes,
        })
      }
    },
    onChooseAction: (id) => selectAction(id as ActionId),
    actions: TGMD_ACTIONS,
  })

  const currentVideoId = useMemo(() => videoMeta?.fileName ?? 'video', [videoMeta])

  const canExport = videoMeta && segments.length > 0

  useEffect(() => {
    if (!isExpanded) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsExpanded(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isExpanded])

  useEffect(() => {
    if (!showFormModal) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowFormModal(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showFormModal])

  useEffect(() => {
    if (!status) return
    const t = setTimeout(() => setStatus(null), 3500)
    return () => clearTimeout(t)
  }, [status])

  useEffect(() => {
    if (pendingSeek === null) return
    const t = setTimeout(() => setPendingSeek(null), 100)
    return () => clearTimeout(t)
  }, [pendingSeek])

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
        <LoginCard onLogin={login} onRegister={register} onResetPassword={resetPassword} onClearError={clearError} error={authError} />
      </div>
    )
  }

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <img className="brand-logo" src="/logo.png" alt="DIANA logo" />
          <div className="brand-text">
            <h1>DIANA Annotation Tool</h1>
            <p>Plataforma web para segmentación TGMD-3.</p>
          </div>
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
          {!showFormModal && (
            <VideoPlayer
              src={videoSrc}
              videoRef={videoRef}
              isPlaying={isPlaying}
              playbackRate={playbackRate}
              isMuted={isMuted}
              isLoading={isVideoLoading}
              seekTo={pendingSeek ?? undefined}
              onRequestExpand={() => setIsExpanded(true)}
              onDuration={(d) => {
                setDuration(d)
                setVideoMeta((m) => (m ? { ...m, duration: d } : m))
                setIsVideoLoading(false)
              }}
              onTimeUpdate={(t) => setCurrentTime(t)}
              onEnded={() => setIsPlaying(false)}
              onPlayStateChange={(playing) => setIsPlaying(playing)}
            />
          )}
          {showFormModal && <div className="player-shell placeholder">Video en el modal de anotación</div>}
          <PlaybackControls
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            playbackRate={playbackRate}
              isMuted={isMuted}
            onTogglePlay={togglePlay}
              onToggleMute={() => setIsMuted((m) => !m)}
            onChangeSpeed={(r) => setPlaybackRate(r)}
            onJumpBackward={() => jump(-2)}
            onJumpForward={() => jump(2)}
          />
          <div className="marker-row">
            <button
              onClick={markStart}
              disabled={!selectedAction}
              title={!selectedAction ? 'Selecciona una acción primero' : 'Marcar inicio'}
            >
              <img className="icon" src="/icon-flag.png" alt="" />
              Marcar inicio
            </button>
            <button
              onClick={markEnd}
              disabled={!selectedAction}
              title={!selectedAction ? 'Selecciona una acción primero' : 'Marcar fin'}
            >
              <img className="icon" src="/icon-flag.png" alt="" />
              Marcar fin
            </button>
            <div className="pending">
              {pendingStart !== null && <span>Inicio: {formatTime(pendingStart)}</span>}
              {pendingEnd !== null && <span>Fin: {formatTime(pendingEnd)}</span>}
            </div>
            {markError && <span className="status error">{markError}</span>}
            {status && <span className="status">{status}</span>}
            <div className="action-selector">
              <img className="icon icon-tag" src="/icon-tag.png" alt="" />
              <label>
                Acción a anotar
                <select
                  value={selectedAction || ''}
                  onChange={(e) => {
                    const val = e.target.value as ActionId | ''
                    setSelectedAction(val)
                    setDraft((d) => {
                      if (!val) return null
                      return d ? { ...d, action: val, repetitionId: nextRepetitionFor(val) } : d
                    })
                  }}
                >
                  <option value="">Escoge una acción</option>
                  {TGMD_ACTIONS.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
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
        </section>
      </main>
      {showFormModal && (
        <>
          <div className="dialog-backdrop" onClick={() => setShowFormModal(false)} />
          <div className="dialog-card" role="dialog" aria-modal="true">
            <div className="step-header">
              {['1. Reproducir y ubicar', '2. Marcar inicio/fin', '3. Etiquetar segmento', '4. Guardar'].map(
                (label, idx) => {
                  const stepIndex = idx + 1
                  const active =
                    (stepIndex === 1 && pendingStart === null) ||
                    (stepIndex === 2 && pendingStart !== null && pendingEnd === null) ||
                    (stepIndex === 3 && pendingEnd !== null && !!draft) ||
                    (stepIndex === 4 && pendingEnd !== null && !draft && lastSaved)
                  return (
                    <span key={label} className={`step-pill ${active ? 'active' : ''}`}>
                      {label}
                    </span>
                  )
                },
              )}
      </div>
            <div className="dialog-body">
              <div className="dialog-left">
                <VideoPlayer
                  src={videoSrc}
                  videoRef={videoRef}
                  isPlaying={isPlaying}
                  playbackRate={playbackRate}
                isMuted={isMuted}
                  isLoading={isVideoLoading}
                  seekTo={pendingSeek ?? undefined}
                onRequestExpand={() => setIsExpanded(true)}
                  onDuration={(d) => {
                    setDuration(d)
                    setVideoMeta((m) => (m ? { ...m, duration: d } : m))
                    setIsVideoLoading(false)
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
                isMuted={isMuted}
                  onTogglePlay={togglePlay}
                onToggleMute={() => setIsMuted((m) => !m)}
                  onChangeSpeed={(r) => setPlaybackRate(r)}
                  onJumpBackward={() => jump(-2)}
                  onJumpForward={() => jump(2)}
                />
                <div className="marker-row">
                  <button
                    onClick={markStart}
                    disabled={!selectedAction}
                    title={!selectedAction ? 'Selecciona una acción primero' : 'Marcar inicio'}
                  >
                    <img className="icon" src="/icon-flag.png" alt="" />
                    Marcar inicio
                  </button>
                  <button
                    onClick={markEnd}
                    disabled={!selectedAction}
                    title={!selectedAction ? 'Selecciona una acción primero' : 'Marcar fin'}
                  >
                    <img className="icon" src="/icon-flag.png" alt="" />
                    Marcar fin
        </button>
                  <div className="pending">
                    {pendingStart !== null && <span className="chip">Inicio: {formatTime(pendingStart)}</span>}
                    {pendingEnd !== null && <span className="chip">Fin: {formatTime(pendingEnd)}</span>}
                  </div>
                  <div className="action-selector">
                    <img className="icon icon-tag" src="/icon-tag.png" alt="" />
                    <label>
                      Acción a anotar
                      <select
                        value={selectedAction || ''}
                        onChange={(e) => {
                          const val = e.target.value as ActionId | ''
                          selectAction(val)
                        }}
                      >
                        <option value="">Escoge una acción</option>
                        {TGMD_ACTIONS.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
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
              </div>
              <div className="dialog-right">
                <div className="panel-header">
                  <h3>Formulario de anotación</h3>
                  <span className="video-id">Video ID: {currentVideoId}</span>
                </div>
                {draft ? (
                  <AnnotationForm
                    key={draft.id ?? `${draft.startSec}-${draft.endSec}`}
                    draft={{ ...draft, annotatorId: user.username }}
                    annotatorLocked={user.username}
                    lockAction={selectedAction as ActionId}
                    videoSrc={videoSrc}
                    onRetakeMarks={() => {
                      if (draft) {
                        setPendingStart(draft.startSec)
                        setPendingEnd(draft.endSec)
                        setSelectedAction(draft.action)
                        setShowFormModal(false)
                        setIsExpanded(true)
                      }
                    }}
                    onCancel={() => {
                      setShowFormModal(false)
                      resetAnnotationState()
                    }}
                    onSubmit={(segment) => {
                      handleSubmitSegment(segment)
                    }}
                  />
                ) : (
                  <p className="placeholder-text">
                    Marca un inicio y un fin (o edita un segmento) para rellenar los datos de TGMD-3.
                  </p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
      <div className="toast-region" aria-live="polite" aria-atomic="true">
        {status && (
          <div className="toast">
            <span>{status}</span>
            {lastSaved && (
              <button
                className="ghost"
                onClick={() => {
                  setSegments((prev) => prev.filter((s) => s.id !== lastSaved.id))
                  setStatus('Último segmento deshecho.')
                  setLastSaved(null)
                }}
              >
                Deshacer
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default App
