import { useCallback, useEffect, useRef, useState } from 'react'
import type { AnnotationSession, AutosaveStatus, Segment, UserProfile } from '../types'
import {
  canEditSession,
  getOrCreateAnnotationSession,
  saveSessionSegments,
  submitSession,
  timestampToIso,
} from '../services/annotationSessions'
import { APP_VERSION } from '../constants/app'

interface LocalDraftBackup {
  session_id: string
  video_code: string
  annotator_uid: string
  annotator_code: string
  segments: Segment[]
  local_updated_at: string
  app_version: string
  status: AnnotationSession['status']
}

const FRIENDLY_SESSION_ERROR = 'No se pudo preparar la sesion. Revisa tu conexion o permisos.'
const FRIENDLY_SAVE_ERROR = 'No se pudo guardar. Revisa tu conexion o permisos.'

function backupKey(uid: string, videoCode: string) {
  return `tgdm-draft:${uid}:${videoCode}`
}

function readBackup(uid: string, videoCode: string): LocalDraftBackup | null {
  try {
    const raw = localStorage.getItem(backupKey(uid, videoCode))
    if (!raw) return null
    return JSON.parse(raw) as LocalDraftBackup
  } catch {
    return null
  }
}

function writeBackup(session: AnnotationSession, segments: Segment[]) {
  try {
    const backup: LocalDraftBackup = {
      session_id: session.session_id,
      video_code: session.video_code,
      annotator_uid: session.annotator_uid,
      annotator_code: session.annotator_code,
      segments,
      local_updated_at: new Date().toISOString(),
      app_version: APP_VERSION,
      status: session.status,
    }
    localStorage.setItem(backupKey(session.annotator_uid, session.video_code), JSON.stringify(backup))
  } catch {
    // Local backup is best-effort only.
  }
}

function clearBackup(session: AnnotationSession | null) {
  if (!session) return
  localStorage.removeItem(backupKey(session.annotator_uid, session.video_code))
}

export function useAnnotationSession(profile: UserProfile | null, videoCode: string, durationSec: number | null) {
  const [session, setSession] = useState<AnnotationSession | null>(null)
  const [segments, setSegments] = useState<Segment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>('idle')
  const [recoverableBackup, setRecoverableBackup] = useState<LocalDraftBackup | null>(null)
  const [dirtyTick, setDirtyTick] = useState(0)
  const loadedKeyRef = useRef('')
  const initialLoadRef = useRef(true)
  const sessionRef = useRef<AnnotationSession | null>(null)
  const segmentsRef = useRef<Segment[]>([])

  const editable = canEditSession(session, profile?.uid)

  useEffect(() => {
    sessionRef.current = session
  }, [session])

  useEffect(() => {
    segmentsRef.current = segments
  }, [segments])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!profile || !videoCode) {
        setSession(null)
        setSegments([])
        setRecoverableBackup(null)
        setAutosaveStatus('idle')
        return
      }
      const key = `${profile.uid}:${videoCode}`
      if (loadedKeyRef.current === key) return
      loadedKeyRef.current = key
      initialLoadRef.current = true
      setSession(null)
      setSegments([])
      setRecoverableBackup(null)
      setAutosaveStatus('idle')
      setLoading(true)
      setError(null)
      try {
        const bundle = await getOrCreateAnnotationSession({
          videoCode,
          annotatorUid: profile.uid,
          annotatorCode: profile.annotator_code || profile.uid.slice(0, 8).toUpperCase(),
          durationSec,
        })
        if (cancelled) return
        setSession(bundle.session)
        setSegments(bundle.segments)
        setRecoverableBackup(readBackup(profile.uid, videoCode))
        setAutosaveStatus('saved')
      } catch (e) {
        if (!cancelled) {
          console.warn('No se pudo preparar la sesion de anotacion.', e)
          setError(FRIENDLY_SESSION_ERROR)
          setAutosaveStatus('failed')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
          setTimeout(() => {
            initialLoadRef.current = false
          }, 0)
        }
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [durationSec, profile, videoCode])

  useEffect(() => {
    const currentSession = sessionRef.current
    if (!currentSession || !editable || initialLoadRef.current) return undefined
    setAutosaveStatus('unsaved')
    writeBackup(currentSession, segmentsRef.current)
    const timer = window.setTimeout(async () => {
      const saveSession = sessionRef.current
      const saveSegments = segmentsRef.current
      if (!saveSession) return
      setAutosaveStatus('saving')
      try {
        await saveSessionSegments(saveSession, saveSegments)
        setSession((current) =>
          current
            ? {
                ...current,
                updated_at: new Date(),
                segment_count: saveSegments.length,
              }
            : current,
        )
        setAutosaveStatus('saved')
      } catch (e) {
        console.warn('No se pudo guardar automaticamente la sesion.', e)
        setError(FRIENDLY_SAVE_ERROR)
        setAutosaveStatus('failed')
      }
    }, 2000)

    return () => window.clearTimeout(timer)
  }, [dirtyTick, editable])

  const replaceSegments = useCallback(
    (updater: Segment[] | ((previous: Segment[]) => Segment[])) => {
      setSegments((previous) => {
        const next = typeof updater === 'function' ? updater(previous) : updater
        return [...next].sort((a, b) => a.startSec - b.startSec)
      })
      setDirtyTick((tick) => tick + 1)
    },
    [],
  )

  const restoreBackup = () => {
    if (!recoverableBackup) return
    setSegments(recoverableBackup.segments)
    setRecoverableBackup(null)
    setDirtyTick((tick) => tick + 1)
  }

  const discardBackup = () => {
    if (profile && videoCode) {
      localStorage.removeItem(backupKey(profile.uid, videoCode))
    }
    setRecoverableBackup(null)
  }

  const submit = async () => {
    if (!session) return
    try {
      if (editable) {
        await saveSessionSegments(session, segments)
      }
      await submitSession(session, segments.length)
      clearBackup(session)
      setSession({
        ...session,
        status: 'submitted',
        submitted_at: new Date(),
        updated_at: new Date(),
        segment_count: segments.length,
      })
      setAutosaveStatus('saved')
      setError(null)
    } catch (e) {
      console.warn('No se pudo enviar la sesion.', e)
      setError(FRIENDLY_SAVE_ERROR)
      setAutosaveStatus('failed')
      throw new Error(FRIENDLY_SAVE_ERROR)
    }
  }

  const refreshFromSession = (nextSession: AnnotationSession, nextSegments: Segment[]) => {
    setSession(nextSession)
    setSegments(nextSegments)
    setAutosaveStatus('saved')
    initialLoadRef.current = false
  }

  return {
    session,
    segments,
    loading,
    error,
    editable,
    autosaveStatus,
    recoverableBackup,
    replaceSegments,
    restoreBackup,
    discardBackup,
    submit,
    refreshFromSession,
    clearLocalBackup: () => clearBackup(session),
    sessionUpdatedIso: timestampToIso(session?.updated_at),
  }
}
