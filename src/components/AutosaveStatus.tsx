import type { AutosaveStatus as AutosaveStatusValue } from '../types'

interface Props {
  status: AutosaveStatusValue
  error?: string | null
}

const LABELS: Record<AutosaveStatusValue, string> = {
  idle: 'Listo',
  unsaved: 'Cambios sin guardar',
  saving: 'Guardando cambios...',
  saved: 'Cambios guardados',
  failed: 'No se pudo guardar',
}

export function AutosaveStatus({ status }: Props) {
  return (
    <div className={`autosave-status ${status}`}>
      <span>{LABELS[status]}</span>
      {status === 'failed' && <small>Revisa tu conexion o permisos.</small>}
    </div>
  )
}
