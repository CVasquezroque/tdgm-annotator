import { useCallback, useEffect, useRef, useState } from 'react'
import type { ActionId, Segment } from '../types'
import { TGMD_ACTIONS } from '../constants/actions'
import { formatTime } from '../utils/time'
import { SegmentLoopPreview, type SegmentPoseTrackingStatus } from './SegmentLoopPreview'

export interface AnnotationDraft {
  id?: string
  action: ActionId
  startSec: number
  endSec: number
  repetitionId?: string
  annotatorId?: string
  notes?: string
}

interface Props {
  draft: AnnotationDraft
  onCancel: () => void
  onSubmit: (segment: Segment) => void
  annotatorLocked?: string
  videoSrc?: string | null
  onRetakeMarks?: () => void
  showAutomaticPose?: boolean
  onPoseProcessingChange?: (processing: boolean) => void
  onActionChange?: (action: ActionId) => string | undefined
}

const INSTRUCTOR_CROSSING_NOTE = 'cruce_instructor'

function hasIdentifierRisk(value: string | undefined) {
  if (!value) return false
  const text = value.toLowerCase()
  return /\b(dni|nombre|name|colegio|school|apellido)\b/.test(text) || /\d{8,}/.test(text)
}

function hasInstructorCrossingNote(value: string | undefined) {
  return Boolean(value && /\bcruce_instructor\b/i.test(value))
}

function addInstructorCrossingNote(value: string | undefined) {
  const current = value?.trim() ?? ''
  if (hasInstructorCrossingNote(current)) return current
  return current ? `${current}\n${INSTRUCTOR_CROSSING_NOTE}` : INSTRUCTOR_CROSSING_NOTE
}

export function AnnotationForm({
  draft,
  onCancel,
  onSubmit,
  annotatorLocked,
  videoSrc,
  onRetakeMarks,
  showAutomaticPose = false,
  onPoseProcessingChange,
  onActionChange,
}: Props) {
  const [form, setForm] = useState<AnnotationDraft>(draft)
  const [error, setError] = useState<string | null>(null)
  const [poseStatus, setPoseStatus] = useState<SegmentPoseTrackingStatus>('disabled')
  const [possibleInstructorCrossing, setPossibleInstructorCrossing] = useState(false)
  const suggestionAppliedRef = useRef(false)

  const duration = Number.isFinite(form.endSec - form.startSec) ? Math.max(0, form.endSec - form.startSec) : 0
  const noteRisk = hasIdentifierRisk(form.notes)
  const hasCrossingNote = hasInstructorCrossingNote(form.notes)
  const handleMultiplePosesDetected = useCallback(() => {
    setPossibleInstructorCrossing(true)
    if (suggestionAppliedRef.current) return
    suggestionAppliedRef.current = true
    setForm((current) => ({ ...current, notes: addInstructorCrossingNote(current.notes) }))
  }, [])

  const handleSave = useCallback(() => {
    if (!form.action) {
      setError('Selecciona una accion.')
      return
    }
    if (form.endSec <= form.startSec) {
      setError('El fin debe ser mayor que el inicio.')
      return
    }
    setError(null)
    onSubmit({
      id: form.id ?? crypto.randomUUID?.() ?? String(Date.now()),
      action: form.action,
      startSec: form.startSec,
      endSec: form.endSec,
      repetitionId: form.repetitionId?.trim() || undefined,
      annotatorId: form.annotatorId?.trim() || undefined,
      notes: form.notes?.trim() || undefined,
    })
  }, [form, onSubmit])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      if (event.key.toLowerCase() !== 's') return
      event.preventDefault()
      handleSave()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleSave])

  return (
    <div className="annotation-form">
      <div className="form-row">
        <label>
          Accion TGMD-3
          <select
            value={form.action}
            onChange={(event) => {
              const action = event.target.value as ActionId
              const repetitionId = onActionChange?.(action)
              setForm((current) => ({ ...current, action, repetitionId: repetitionId ?? current.repetitionId }))
            }}
          >
            {TGMD_ACTIONS.map((action) => (
              <option key={action.id} value={action.id}>
                {action.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="form-grid">
        <label>
          Inicio (s)
          <input
            type="number"
            step="0.01"
            value={form.startSec}
            onChange={(event) => setForm((current) => ({ ...current, startSec: Number(event.target.value) }))}
          />
          <small>{formatTime(form.startSec)}</small>
        </label>
        <label>
          Fin (s)
          <input
            type="number"
            step="0.01"
            value={form.endSec}
            onChange={(event) => setForm((current) => ({ ...current, endSec: Number(event.target.value) }))}
          />
          <small>{formatTime(form.endSec)}</small>
        </label>
        <label>
          Duracion (s)
          <input type="text" value={duration.toFixed(2)} disabled />
          <small>{formatTime(duration)}</small>
        </label>
        <label>
          Repeticion
          <input type="text" value={form.repetitionId ?? ''} disabled placeholder="Auto" />
        </label>
        <label>
          Anotador
          <input
            type="text"
            value={annotatorLocked ?? form.annotatorId ?? ''}
            onChange={(event) =>
              setForm((current) =>
                annotatorLocked ? current : { ...current, annotatorId: event.target.value },
              )
            }
            placeholder="ID o iniciales"
            disabled={!!annotatorLocked}
          />
        </label>
      </div>
      <label>
        Notas
        <textarea
          value={form.notes ?? ''}
          onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
          rows={2}
        />
        <small>No incluyas nombres, DNI, colegios ni identificadores personales del menor.</small>
      </label>
      {noteRisk && (
        <div className="form-warning">
          Las notas parecen contener un identificador personal. Revisa el texto antes de guardar.
        </div>
      )}
      {videoSrc && Number.isFinite(form.startSec) && Number.isFinite(form.endSec) && form.endSec > form.startSec && (
        <div className="preview-block">
          <div className="preview-header">
            <span className="preview-label">Resumen del segmento</span>
            {onRetakeMarks && (
              <button type="button" className="secondary" onClick={onRetakeMarks}>
                Reabrir marcadores
              </button>
            )}
          </div>
          <SegmentLoopPreview
            videoSrc={videoSrc}
            startSec={form.startSec}
            endSec={form.endSec}
            enablePose={showAutomaticPose}
            onPoseStatusChange={setPoseStatus}
            onMultiplePosesDetected={handleMultiplePosesDetected}
            onPoseProcessingChange={onPoseProcessingChange}
          />
          <div className="segment-summary-status" aria-live="polite">
            {showAutomaticPose && poseStatus === 'loading' && <span>Cargando MediaPipe para el segmento...</span>}
            {showAutomaticPose && poseStatus === 'tracking' && (
              <span>Estimando pose durante toda la reproduccion del segmento.</span>
            )}
            {showAutomaticPose && poseStatus === 'detected' && (
              <span>Pose activa durante toda la reproduccion del segmento.</span>
            )}
            {showAutomaticPose && poseStatus === 'unavailable' && (
              <span>No se pudo ejecutar MediaPipe. El clip sigue disponible sin overlay.</span>
            )}
          </div>
          {possibleInstructorCrossing && (
            <div className="auto-suggestion">
              <span className="auto-suggestion-badge">Sugerido automaticamente: {INSTRUCTOR_CROSSING_NOTE}</span>
              {!hasCrossingNote && (
                <button
                  type="button"
                  className="ghost"
                  onClick={() =>
                    setForm((current) => ({ ...current, notes: addInstructorCrossingNote(current.notes) }))
                  }
                >
                  Agregar a notas
                </button>
              )}
            </div>
          )}
        </div>
      )}
      {error && <div className="form-error">{error}</div>}
      <div className="form-actions">
        <button onClick={handleSave}>Guardar segmento</button>
        <button onClick={onCancel} className="secondary">
          Cancelar
        </button>
      </div>
    </div>
  )
}
