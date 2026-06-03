import { useEffect, useRef, useState } from 'react'

interface Props {
  title: string
  targetLabel: string
  warning: string
  busy?: boolean
  error?: string | null
  onCancel: () => void
  onConfirm: () => void
}

const CONFIRMATION_WORD = 'eliminar'

export function DangerZoneConfirmDialog({
  title,
  targetLabel,
  warning,
  busy = false,
  error,
  onCancel,
  onConfirm,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [confirmation, setConfirmation] = useState('')
  const confirmed = confirmation.trim().toLowerCase() === CONFIRMATION_WORD

  useEffect(() => {
    window.setTimeout(() => inputRef.current?.focus(), 0)
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [busy, onCancel])

  return (
    <div className="danger-zone-backdrop" onClick={() => !busy && onCancel()}>
      <div
        className="danger-zone-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="danger-zone-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="danger-zone-header">
          <span className="danger-zone-kicker">Danger Zone</span>
          <h3 id="danger-zone-title">{title}</h3>
        </div>
        <div className="danger-zone-target">{targetLabel}</div>
        <p>{warning}</p>
        <label>
          Escribe <strong>{CONFIRMATION_WORD}</strong> para confirmar
          <input
            ref={inputRef}
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="off"
            spellCheck={false}
            disabled={busy}
          />
        </label>
        {error && <div className="form-error">{error}</div>}
        <div className="danger-zone-actions">
          <button type="button" className="secondary" onClick={onCancel} disabled={busy}>
            Cancelar
          </button>
          <button type="button" className="danger" onClick={onConfirm} disabled={!confirmed || busy}>
            {busy ? 'Eliminando...' : 'Eliminar'}
          </button>
        </div>
      </div>
    </div>
  )
}
