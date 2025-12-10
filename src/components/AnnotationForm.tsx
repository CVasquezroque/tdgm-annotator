import { useState } from 'react'
import type { ActionId, Segment } from '../types'
import { TGMD_ACTIONS } from '../constants/actions'
import { formatTime } from '../utils/time'

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
  lockAction?: ActionId
  videoSrc?: string | null
  onRetakeMarks?: () => void
}

export function AnnotationForm({
  draft,
  onCancel,
  onSubmit,
  annotatorLocked,
  lockAction,
  videoSrc,
  onRetakeMarks,
}: Props) {
  const [form, setForm] = useState<AnnotationDraft>(draft)
  const [error, setError] = useState<string | null>(null)

  const duration = Number.isFinite(form.endSec - form.startSec) ? Math.max(0, form.endSec - form.startSec) : 0

  const handleSave = () => {
    if (!form.action) {
      setError('Selecciona una acción.')
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
  }

  return (
    <div className="annotation-form">
      <div className="form-row">
        <label>
          Acción TGMD-3
          <select
            value={form.action}
            disabled={!!lockAction}
            onChange={(e) => setForm((f) => ({ ...f, action: e.target.value as ActionId }))}
          >
            {TGMD_ACTIONS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
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
            onChange={(e) => setForm((f) => ({ ...f, startSec: Number(e.target.value) }))}
          />
          <small>{formatTime(form.startSec)}</small>
        </label>
        <label>
          Fin (s)
          <input
            type="number"
            step="0.01"
            value={form.endSec}
            onChange={(e) => setForm((f) => ({ ...f, endSec: Number(e.target.value) }))}
          />
          <small>{formatTime(form.endSec)}</small>
        </label>
        <label>
          Duración (s)
          <input type="text" value={duration.toFixed(2)} disabled />
          <small>{formatTime(duration)}</small>
        </label>
        <label>
          Repetición
          <input
            type="text"
            value={form.repetitionId ?? ''}
            disabled
            placeholder="Auto"
          />
        </label>
        <label>
          Anotador
          <input
            type="text"
            value={annotatorLocked ?? form.annotatorId ?? ''}
            onChange={(e) =>
              setForm((f) =>
                annotatorLocked ? f : { ...f, annotatorId: e.target.value },
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
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          rows={2}
        />
      </label>
      {videoSrc && Number.isFinite(form.startSec) && Number.isFinite(form.endSec) && form.endSec > form.startSec && (
        <div className="preview-block">
          <div className="preview-header">
            <span className="preview-label">Previsualización del segmento</span>
            {onRetakeMarks && (
              <button type="button" className="secondary" onClick={onRetakeMarks}>
                Reabrir marcadores
              </button>
            )}
          </div>
          <video
            className="preview-video"
            src={videoSrc}
            controls
            preload="metadata"
            muted
            autoPlay
            playsInline
            onLoadedMetadata={(e) => {
              const v = e.currentTarget
              v.playbackRate = 0.5
              v.currentTime = form.startSec
              void v.play().catch(() => {})
            }}
            onTimeUpdate={(e) => {
              const v = e.currentTarget
              if (v.currentTime >= form.endSec - 0.05) {
                v.currentTime = form.startSec
                void v.play().catch(() => {})
              }
            }}
          />
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

