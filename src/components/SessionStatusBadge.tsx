import type { AnnotationSessionStatus } from '../types'

interface Props {
  status?: AnnotationSessionStatus | null
}

const LABELS: Record<AnnotationSessionStatus, string> = {
  draft: 'Borrador',
  submitted: 'Enviado',
  reviewed: 'Revisado',
  returned: 'Devuelto',
  locked: 'Bloqueado',
}

export function SessionStatusBadge({ status }: Props) {
  if (!status) return <span className="session-badge muted">Preparando</span>
  return <span className={`session-badge ${status}`}>{LABELS[status]}</span>
}
