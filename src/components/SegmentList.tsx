import type { Segment } from '../types'
import { formatTime } from '../utils/time'
import { ACTION_BY_ID } from '../constants/actions'

interface Props {
  segments: Segment[]
  onEdit: (segment: Segment) => void
  onDelete: (id: string) => void
  onSeek: (time: number) => void
}

export function SegmentList({ segments, onEdit, onDelete, onSeek }: Props) {
  if (segments.length === 0) {
    return <div className="segment-empty">No hay segmentos aún.</div>
  }

  return (
    <table className="segment-table">
      <thead>
        <tr>
          <th>Acción</th>
          <th>Inicio</th>
          <th>Fin</th>
          <th>Duración</th>
          <th>Repetición</th>
          <th>Anotador</th>
          <th>Notas</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {segments.map((s) => {
          const action = ACTION_BY_ID[s.action]
          const duration = Math.max(0, s.endSec - s.startSec)
          return (
            <tr key={s.id}>
              <td>
                <span className="action-chip" style={{ backgroundColor: action?.color }}>
                  {action?.label ?? s.action}
                </span>
              </td>
              <td>{formatTime(s.startSec)}</td>
              <td>{formatTime(s.endSec)}</td>
              <td>{formatTime(duration)}</td>
              <td>{s.repetitionId ?? ''}</td>
              <td>{s.annotatorId ?? ''}</td>
              <td className="notes-cell">{s.notes}</td>
              <td className="row-actions">
                <button onClick={() => onSeek(s.startSec)}>
                  <img className="icon" src="/icon-segment.png" alt="" /> Ir
                </button>
                <button onClick={() => onEdit(s)}>
                  <img className="icon" src="/icon-edit.png" alt="" /> Editar
                </button>
                <button onClick={() => onDelete(s.id)}>
                  <img className="icon" src="/icon-trash.png" alt="" /> Eliminar
                </button>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

