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
import { ApprovalStatusCard } from './components/ApprovalStatusCard'
import { PosePreviewOverlay } from './components/PosePreviewOverlay'
import { AutosaveStatus } from './components/AutosaveStatus'
import { MySessionsPanel } from './components/MySessionsPanel'
import { ReviewerSessionsPanel } from './components/ReviewerSessionsPanel'
import { AdminUsersPanel } from './components/AdminUsersPanel'
import { ExportPanel } from './components/ExportPanel'
import type { ActionId, AnnotationSession, Segment, VideoMeta } from './types'
import { TGMD_ACTIONS } from './constants/actions'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useThumbnailGenerator } from './hooks/useThumbnailGenerator'
import { useAnnotationSession } from './hooks/useAnnotationSession'
import { formatTime } from './utils/time'
import { useAuth } from './hooks/useAuth'
import { updateOwnSafeProfile } from './services/userProfiles'

function codedFilenameFromFile(file: File) {
  const baseName = file.name.split(/[\\/]/).pop()?.trim() || `LOCAL-${Date.now().toString(36).toUpperCase()}`
  const cleaned = baseName
    .split('')
    .filter((char) => char >= ' ' && char !== '\u007f')
    .join('')
    .replace(/[\\/]/g, '_')
    .replace(/[^A-Za-z0-9._ -]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)

  return cleaned || `LOCAL-${Date.now().toString(36).toUpperCase()}`
}

type WorkspaceView = 'annotate' | 'sessions' | 'exports' | 'review' | 'users'

function App() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const videoObjectUrlRef = useRef<string | null>(null)
  const userMenuRef = useRef<HTMLDetailsElement | null>(null)
  const profileModalRef = useRef<HTMLDivElement | null>(null)
  const profileFirstFieldRef = useRef<HTMLInputElement | null>(null)
  const [videoSrc, setVideoSrc] = useState<string | null>(null)
  const [videoMeta, setVideoMeta] = useState<VideoMeta | null>(null)
  const [videoCode, setVideoCode] = useState('')
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [isExpanded, setIsExpanded] = useState(false)
  const [isVideoLoading, setIsVideoLoading] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const [selectedAction, setSelectedAction] = useState<ActionId | ''>('')
  const [pendingStart, setPendingStart] = useState<number | null>(null)
  const [pendingEnd, setPendingEnd] = useState<number | null>(null)
  const [draft, setDraft] = useState<AnnotationDraft | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [markError, setMarkError] = useState<string | null>(null)
  const [showFormModal, setShowFormModal] = useState(false)
  const [lastSaved, setLastSaved] = useState<Segment | null>(null)
  const [pendingSeek, setPendingSeek] = useState<number | null>(null)
  const [posePreview, setPosePreview] = useState<Segment | null>(null)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [profileDraftName, setProfileDraftName] = useState('')
  const [profileDraftInstitution, setProfileDraftInstitution] = useState('')
  const [profileSaveError, setProfileSaveError] = useState<string | null>(null)
  const [isProfileSaving, setIsProfileSaving] = useState(false)
  const [activeView, setActiveView] = useState<WorkspaceView>('annotate')
  const {
    user,
    profile,
    accessStatus,
    login,
    register,
    resetPassword,
    refreshVerification,
    refreshProfile,
    logout,
    clearError,
    loading: authLoading,
    error: authError,
  } = useAuth()

  const { previewUrl, previewTime, requestPreview } = useThumbnailGenerator(videoSrc)

  const annotatorCode = profile?.annotator_code.trim() || ''
  const annotatorCodeLabel = annotatorCode || 'codigo pendiente'
  const sessionProfile = profile && annotatorCode ? profile : null
  const sessionState = useAnnotationSession(sessionProfile, videoCode, videoMeta?.codedFilename || '', duration || null)
  const { session, segments, editable, autosaveStatus } = sessionState
  const sessionMatchesCode = Boolean(session && videoCode && session.video_code === videoCode)

  const canAnnotateVideo = Boolean(
    videoSrc && annotatorCode && videoCode.trim() && sessionMatchesCode && !sessionState.loading && editable,
  )
  const canSubmitSession = Boolean(
    videoSrc &&
      annotatorCode &&
      videoCode.trim() &&
      sessionMatchesCode &&
      !sessionState.loading &&
      editable &&
      segments.length > 0,
  )
  const canManageUsers = profile?.role === 'admin' || profile?.role === 'supervisor'
  const canReview = canManageUsers || profile?.role === 'reviewer'
  const roleLabel =
    profile?.role === 'admin'
      ? 'Admin'
      : profile?.role === 'supervisor'
        ? 'Supervisor'
        : profile?.role === 'reviewer'
          ? 'Revisor'
          : 'Anotador'
  const displayName = profile?.full_name?.trim() || user?.username || ''
  const shortName = useMemo(() => {
    const source = displayName.trim() || user?.email?.split('@')[0] || 'usuario'
    return source.split(/\s+/)[0]
  }, [displayName, user?.email])
  const initials = useMemo(() => {
    const source = displayName.trim() || user?.email?.split('@')[0] || 'U'
    const parts = source.split(/\s+/).filter(Boolean)
    return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : source.slice(0, 2)).toUpperCase()
  }, [displayName, user?.email])

  const availableViews = useMemo(() => {
    const views: Array<{ id: WorkspaceView; label: string }> = [
      { id: 'annotate', label: 'Anotar' },
      { id: 'sessions', label: 'Mis anotaciones' },
      { id: 'exports', label: 'Exportar' },
    ]
    if (canReview) views.push({ id: 'review', label: 'Revision' })
    if (canManageUsers) views.push({ id: 'users', label: 'Usuarios' })
    return views
  }, [canManageUsers, canReview])

  const annotationReadiness = (() => {
    if (!videoMeta) return 'Carga un video local para iniciar.'
    if (!annotatorCode) return 'Codigo de anotador pendiente. Contacta al administrador.'
    if (sessionState.loading) return 'Preparando anotacion...'
    if (sessionState.error) return 'No se pudo preparar la anotacion. Revisa tu conexion o permisos.'
    if (sessionMatchesCode && session?.status === 'submitted') return 'Enviada para revision'
    if (sessionMatchesCode && session?.status === 'reviewed') return 'Revisada'
    if (sessionMatchesCode && session?.status === 'returned') return 'Devuelta para correccion'
    if (sessionMatchesCode && session?.status === 'locked') return 'Bloqueada despues de revision'
    if (sessionMatchesCode) return 'Lista para anotar'
    return 'Preparando anotacion...'
  })()

  useEffect(() => {
    if (!availableViews.some((view) => view.id === activeView)) {
      setActiveView('annotate')
    }
  }, [activeView, availableViews])

  const openProfileEditor = () => {
    if (userMenuRef.current) userMenuRef.current.open = false
    setProfileDraftName(profile?.full_name ?? '')
    setProfileDraftInstitution(profile?.institution ?? '')
    setProfileSaveError(null)
    setShowProfileModal(true)
  }

  const closeProfileEditor = () => {
    setShowProfileModal(false)
  }

  const handleSaveProfile = async () => {
    if (!profile) return
    setIsProfileSaving(true)
    setProfileSaveError(null)
    try {
      await updateOwnSafeProfile(profile.uid, {
        fullName: profileDraftName,
        institution: profileDraftInstitution,
      })
      await refreshProfile()
      setShowProfileModal(false)
      setStatus('Perfil actualizado.')
    } catch (e) {
      console.warn('No se pudo actualizar el perfil seguro.', e)
      setProfileSaveError('No se pudo actualizar el perfil. Revisa tu conexion o permisos.')
    } finally {
      setIsProfileSaving(false)
    }
  }

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

  const revokeCurrentVideoUrl = () => {
    if (videoObjectUrlRef.current) {
      URL.revokeObjectURL(videoObjectUrlRef.current)
      videoObjectUrlRef.current = null
    }
  }

  const handleVideoSelected = (file: File) => {
    revokeCurrentVideoUrl()
    const src = URL.createObjectURL(file)
    videoObjectUrlRef.current = src
    setVideoSrc(src)
    const codedFilename = codedFilenameFromFile(file)
    setVideoMeta({
      source: 'local',
      duration: 0,
      codedFilename,
    })
    setVideoCode(codedFilename)
    setIsVideoLoading(true)
    setDuration(0)
    resetAnnotationState()
    setStatus('Video local cargado. Preparando anotacion...')
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
    if (!canAnnotateVideo) {
      setMarkError('Espera a que la anotacion este lista.')
      return
    }
    if (!selectedAction) {
      setMarkError('Debes escoger una accion.')
      return
    }
    setMarkError(null)
    setPendingStart(currentTime)
    setPendingEnd(null)
    setStatus(`Inicio marcado en ${formatTime(currentTime)}`)
    setDraft(null)
  }

  const markEnd = () => {
    if (!canAnnotateVideo) {
      setMarkError('Espera a que la anotacion este lista.')
      return
    }
    if (!selectedAction) {
      setMarkError('Debes escoger una accion.')
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
      annotatorId: annotatorCode,
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
    const withAnnotator = { ...segment, annotatorId: annotatorCode, repetitionId: repetition }
    sessionState.replaceSegments((prev) => {
      const filtered = prev.filter((p) => p.id !== segment.id)
      return [...filtered, withAnnotator].sort((a, b) => a.startSec - b.startSec)
    })
    resetAnnotationState()
    const msg = `Segmento guardado: ${withAnnotator.action} ${formatTime(withAnnotator.startSec)} - ${formatTime(
      withAnnotator.endSec,
    )}`
    setStatus(msg)
    setLastSaved(withAnnotator)
    setSelectedAction('')
    setIsExpanded(false)
    setShowFormModal(false)
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
    sessionState.replaceSegments((prev) => prev.filter((s) => s.id !== id))
    setStatus('Segmento eliminado.')
  }

  const handlePosePreview = (segment: Segment) => {
    if (!videoSrc) {
      setStatus('Primero carga un video para previsualizar la pose.')
      return
    }
    setIsPlaying(false)
    setPosePreview(segment)
  }

  const jump = (delta: number) => {
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

  const handleOpenStoredSession = (nextSession: AnnotationSession, nextSegments: Segment[]) => {
    setVideoCode(nextSession.video_code)
    sessionState.refreshFromSession(nextSession, nextSegments)
    setStatus('Anotacion cargada. Carga el video local correspondiente para reproducirlo.')
    setActiveView('annotate')
  }

  useKeyboardShortcuts({
    onTogglePlay: togglePlay,
    onMarkStart: markStart,
    onMarkEnd: markEnd,
    onJumpBackward: () => jump(-2),
    onJumpForward: () => jump(2),
    onJumpBackwardPrecise: () => jump(-0.04),
    onJumpForwardPrecise: () => jump(0.04),
    onSaveSegment: () => {
      if (draft && draft.endSec > draft.startSec && canAnnotateVideo) {
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

  useEffect(
    () => () => {
      if (videoObjectUrlRef.current) {
        URL.revokeObjectURL(videoObjectUrlRef.current)
        videoObjectUrlRef.current = null
      }
    },
    [],
  )

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
    const closeMenu = (event: MouseEvent) => {
      const menu = userMenuRef.current
      if (!menu?.open || !(event.target instanceof Node)) return
      if (!menu.contains(event.target)) menu.open = false
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && userMenuRef.current?.open) {
        userMenuRef.current.open = false
      }
    }

    document.addEventListener('mousedown', closeMenu)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeMenu)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [])

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
    if (!showProfileModal) return undefined
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    window.setTimeout(() => profileFirstFieldRef.current?.focus(), 0)

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowProfileModal(false)
        return
      }
      if (event.key !== 'Tab' || !profileModalRef.current) return

      const focusable = Array.from(
        profileModalRef.current.querySelectorAll<HTMLElement>(
          'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute('disabled') && element.tabIndex !== -1)

      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      previousFocus?.focus()
    }
  }, [showProfileModal])

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
          <p>Cargando sesion...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="auth-shell">
        <LoginCard
          onLogin={login}
          onRegister={register}
          onResetPassword={resetPassword}
          onClearError={clearError}
          error={authError}
        />
      </div>
    )
  }

  if (accessStatus !== 'allowed') {
    return (
      <ApprovalStatusCard
        user={user}
        profile={profile}
        accessStatus={accessStatus}
        error={authError}
        onRefreshVerification={refreshVerification}
        onLogout={logout}
      />
    )
  }

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <img className="brand-logo" src="/logo.png" alt="DIANA logo" />
          <div className="brand-text">
            <h1>DIANA Annotation Tool</h1>
            <p>Plataforma web para segmentacion TGMD-3.</p>
          </div>
        </div>
        <div className="header-actions">
          <details className="user-menu" ref={userMenuRef}>
            <summary aria-label="Menu de usuario" aria-haspopup="menu">
              <span className="user-avatar">{initials}</span>
              <span className="user-summary">
                <span className="user-menu-name">{shortName}</span>
                <small>
                  {roleLabel} - {annotatorCodeLabel}
                </small>
              </span>
              <span className="user-menu-chevron">v</span>
            </summary>
            <div className="user-menu-panel" role="menu">
              <div className="user-menu-panel-header">
                <strong>{displayName}</strong>
                <span>{user.email}</span>
              </div>
              <div className="user-menu-meta">
                <span>
                  Rol <strong>{roleLabel}</strong>
                </span>
                <span>
                  Codigo <strong>{annotatorCodeLabel}</strong>
                </span>
              </div>
              <button className="ghost" role="menuitem" onClick={openProfileEditor}>
                Editar perfil
              </button>
              <button className="ghost" role="menuitem" onClick={() => void logout()}>
                Cerrar sesion
              </button>
            </div>
          </details>
        </div>
      </header>

      <nav className="workspace-tabs" aria-label="Vistas de trabajo">
        {availableViews.map((view) => (
          <button
            key={view.id}
            className={activeView === view.id ? 'active' : ''}
            type="button"
            onClick={() => setActiveView(view.id)}
          >
            {view.label}
          </button>
        ))}
      </nav>

      {activeView === 'annotate' && (
        <div className="view-shell annotation-view">
          <section className="workspace-toolbar annotation-toolbar" aria-label="Controles principales">
            <VideoLoader onVideoSelected={handleVideoSelected} />
            <div className="privacy-inline">
              El video permanece en este dispositivo. No se sube a ningun servidor.
            </div>
          </section>

          <ShortcutsHelp />

          <main className="layout annotation-layout">
        {isExpanded && <div className="overlay-backdrop" onClick={() => setIsExpanded(false)} />}
        <section className={`player-section ${isExpanded ? 'expanded' : ''}`}>
          {videoMeta && (
            <div className="video-meta">
              <div>
                <strong>Archivo local:</strong> cargado en este dispositivo
              </div>
              <div>
                <strong>Archivo codificado:</strong> {videoMeta.codedFilename}
              </div>
              <div>
                <strong>Estado:</strong> {annotationReadiness}
              </div>
              <div>
                <strong>Duracion:</strong> {formatTime(duration)}
              </div>
            </div>
          )}
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
          {showFormModal && <div className="player-shell placeholder">Video en el modal de anotacion</div>}
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
          {sessionState.recoverableBackup && (
            <div className="backup-banner">
              <span>Hay un borrador local recuperable.</span>
              <button className="secondary" onClick={sessionState.restoreBackup}>
                Restaurar
              </button>
              <button className="ghost" onClick={sessionState.discardBackup}>
                Descartar
              </button>
            </div>
          )}
          <div className="session-toolbar annotation-status-bar">
            <div className="annotation-status-copy">
              <span className={`session-readiness ${sessionState.error ? 'error' : sessionMatchesCode ? 'ready' : 'idle'}`}>
                {annotationReadiness}
              </span>
              <AutosaveStatus status={autosaveStatus} error={sessionState.error} />
            </div>
            <button
              className="primary-strong"
              disabled={!canSubmitSession}
              onClick={() =>
                void sessionState.submit().then(() => {
                  setStatus('Anotacion enviada para revision.')
                }).catch(() => {
                  setStatus('No se pudo enviar. Revisa tu conexion o permisos.')
                })
              }
            >
              Enviar a revision
            </button>
          </div>
          <div className="marker-row">
            <button
              onClick={markStart}
              disabled={!selectedAction || !canAnnotateVideo}
              title={!canAnnotateVideo ? 'Espera a que la anotacion este lista' : 'Marcar inicio'}
            >
              <img className="icon" src="/icon-flag.png" alt="" />
              Marcar inicio
            </button>
            <button
              onClick={markEnd}
              disabled={!selectedAction || !canAnnotateVideo}
              title={!canAnnotateVideo ? 'Espera a que la anotacion este lista' : 'Marcar fin'}
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
                Accion a anotar
                <select
                  value={selectedAction || ''}
                  disabled={!canAnnotateVideo}
                  onChange={(e) => selectAction(e.target.value as ActionId | '')}
                >
                  <option value="">Escoge una accion</option>
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
                onPreviewPose={handlePosePreview}
                readOnly={!editable}
              />
            </div>
          </div>
        </section>
          </main>
        </div>
      )}

      {activeView !== 'annotate' && (
        <main className={`management-view view-shell management-${activeView}`}>
          {activeView === 'sessions' && <MySessionsPanel uid={user.uid} onOpenSession={handleOpenStoredSession} />}
          {activeView === 'exports' && (
            <ExportPanel uid={user.uid} videoMeta={videoMeta} session={session} segments={segments} canExportAll={canReview} />
          )}
          {activeView === 'review' && canReview && profile && (
            <ReviewerSessionsPanel profile={profile} onOpenSession={handleOpenStoredSession} />
          )}
          {activeView === 'users' && canManageUsers && <AdminUsersPanel actorUid={user.uid} />}
        </main>
      )}
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
                    disabled={!selectedAction || !canAnnotateVideo}
                    title={!canAnnotateVideo ? 'Espera a que la anotacion este lista' : 'Marcar inicio'}
                  >
                    <img className="icon" src="/icon-flag.png" alt="" />
                    Marcar inicio
                  </button>
                  <button
                    onClick={markEnd}
                    disabled={!selectedAction || !canAnnotateVideo}
                    title={!canAnnotateVideo ? 'Espera a que la anotacion este lista' : 'Marcar fin'}
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
                      Accion a anotar
                      <select
                        value={selectedAction || ''}
                        disabled={!canAnnotateVideo}
                        onChange={(e) => selectAction(e.target.value as ActionId | '')}
                      >
                        <option value="">Escoge una accion</option>
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
                  <h3>Formulario de anotacion</h3>
                  <span className="video-id">Anotacion local</span>
                </div>
                {draft ? (
                  <AnnotationForm
                    key={draft.id ?? `${draft.startSec}-${draft.endSec}`}
                    draft={{ ...draft, annotatorId: annotatorCode }}
                    annotatorLocked={annotatorCode}
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
      {showProfileModal && (
        <>
          <div className="dialog-backdrop profile-backdrop" onClick={closeProfileEditor} />
          <div
            className="profile-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-modal-title"
            aria-describedby="profile-modal-description"
            ref={profileModalRef}
          >
            <div className="profile-modal-header">
              <div>
                <span className="modal-kicker">Perfil institucional</span>
                <h3 id="profile-modal-title">Editar perfil</h3>
              </div>
              <button className="ghost icon-button" type="button" aria-label="Cerrar editor de perfil" onClick={closeProfileEditor}>
                x
              </button>
            </div>
            <p className="profile-edit-note" id="profile-modal-description">
              Puedes actualizar solo los datos institucionales seguros. Rol, estado, codigo de anotador y aprobaciones
              quedan bajo control del equipo administrador.
            </p>
            <label>
              Nombre
              <input
                ref={profileFirstFieldRef}
                value={profileDraftName}
                onChange={(e) => setProfileDraftName(e.target.value)}
                placeholder="Nombre y apellido"
              />
            </label>
            <label>
              Institucion
              <input
                value={profileDraftInstitution}
                onChange={(e) => setProfileDraftInstitution(e.target.value)}
                placeholder="Institucion"
              />
            </label>
            <div className="profile-readonly-grid">
              <div>
                <span>Codigo anotador</span>
                <strong>{annotatorCode || 'pendiente'}</strong>
              </div>
              <div>
                <span>Rol</span>
                <strong>{roleLabel}</strong>
              </div>
            </div>
            {profileSaveError && <div className="form-error">{profileSaveError}</div>}
            <div className="profile-modal-actions">
              <button className="secondary" onClick={closeProfileEditor} disabled={isProfileSaving}>
                Cancelar
              </button>
              <button className="primary-strong" onClick={() => void handleSaveProfile()} disabled={isProfileSaving}>
                {isProfileSaving ? 'Guardando...' : 'Guardar perfil'}
              </button>
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
                  sessionState.replaceSegments((prev) => prev.filter((s) => s.id !== lastSaved.id))
                  setStatus('Ultimo segmento deshecho.')
                  setLastSaved(null)
                }}
              >
                Deshacer
              </button>
            )}
          </div>
        )}
      </div>
      {posePreview && videoSrc && (
        <PosePreviewOverlay segment={posePreview} videoSrc={videoSrc} onClose={() => setPosePreview(null)} />
      )}
    </div>
  )
}

export default App
