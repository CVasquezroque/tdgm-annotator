import { useEffect, useMemo, useState } from 'react'

interface Props {
  value: string
  disabled?: boolean
  loading?: boolean
  ready?: boolean
  sessionError?: string | null
  onValidCode: (videoCode: string) => void
  onPendingCode: () => void
}

function normalizeVideoCode(value: string) {
  return value.trim().replace(/\s+/g, '-').toUpperCase()
}

function hasIdentifierRisk(value: string) {
  const text = value.toLowerCase()
  return (
    /\b(dni|nombre|name|colegio|school|apellido|iniciales|initials)\b/.test(text) ||
    /\d{8,}/.test(text) ||
    /[\\/]/.test(text) ||
    /^[a-z]{2,3}$/i.test(value.trim())
  )
}

function hasSafeCodeShape(value: string) {
  return /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(value) && value.length >= 3 && value.length <= 40
}

function validationMessage(draft: string, normalized: string) {
  if (!draft.trim()) return null
  if (!hasSafeCodeShape(normalized)) {
    return 'Usa solo letras, numeros y guiones, entre 3 y 40 caracteres. Ejemplos: V000050 o DIANA-VID-001.'
  }
  if (hasIdentifierRisk(draft)) {
    return 'El codigo parece contener identificadores personales. Usa un codigo de estudio pseudonimizado.'
  }
  return null
}

export function VideoCodeForm({
  value,
  disabled,
  loading,
  ready,
  sessionError,
  onValidCode,
  onPendingCode,
}: Props) {
  const [draft, setDraft] = useState(value)
  const normalized = useMemo(() => normalizeVideoCode(draft), [draft])
  const error = validationMessage(draft, normalized)
  const hasDraft = draft.trim().length > 0
  const valid = hasDraft && !error

  useEffect(() => {
    if (disabled) return undefined
    if (!hasDraft || error) return undefined

    const timer = window.setTimeout(() => {
      onValidCode(normalized)
    }, 550)

    return () => window.clearTimeout(timer)
  }, [disabled, error, hasDraft, normalized, onValidCode])

  const statusClass = sessionError || error ? 'invalid' : ready ? 'ready' : loading ? 'loading' : valid ? 'valid' : 'idle'
  const statusText = (() => {
    if (disabled) return 'Carga un video local para iniciar.'
    if (!hasDraft) return 'Ingresa un codigo de video para iniciar la anotacion.'
    if (error) return 'Codigo invalido'
    if (sessionError) return 'No se pudo preparar la sesion. Revisa tu conexion o permisos.'
    if (loading) return 'Preparando sesion de anotacion...'
    if (ready && value === normalized) return 'Sesion lista'
    return 'Codigo valido'
  })()

  return (
    <div className="video-code-card">
      <div className="video-code-copy">
        <strong>Codigo de video pseudonimizado</strong>
        <span>No uses nombres, iniciales, DNI, colegio, ruta local ni datos personales.</span>
      </div>
      <label>
        Video code
        <input
          value={draft}
          onChange={(e) => {
            const nextDraft = e.target.value
            setDraft(nextDraft)
            onPendingCode()
          }}
          onBlur={() => {
            if (valid) setDraft(normalized)
          }}
          placeholder="Ej. V000050"
          disabled={disabled}
          aria-describedby="video-code-help video-code-status"
        />
      </label>
      <div id="video-code-status" className={`video-code-status ${statusClass}`}>
        {statusText}
      </div>
      <p id="video-code-help" className={`privacy-note ${error ? 'warning' : ''}`}>
        El video permanece en este dispositivo. La app no sube videos a ningun servidor.
      </p>
      {error && <div className="form-error">{error}</div>}
    </div>
  )
}
