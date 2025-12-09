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
}

export function AnnotationForm({ draft, onCancel, onSubmit, annotatorLocked }: Props) {
  const [form, setForm] = useState<AnnotationDraft>(draft)
  const [error, setError] = useState<string | null>(null)

  const handleSave = () => {
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

