import type { Segment } from '../types'
import { formatTime } from '../utils/time'
import { ACTION_BY_ID } from '../constants/actions'

interface Props {
  segments: Segment[]
  onEdit: (segment: Segment) => void
  onDelete: (id: string) => void
  onSeek: (time: number) => void
  onSelect?: (segment: Segment) => void
  onPreviewPose?: (segment: Segment) => void
  readOnly?: boolean
  allowDelete?: boolean
}

export function SegmentList({
  segments,
  onEdit,
  onDelete,
  onSeek,
  onSelect,
  onPreviewPose,
  readOnly,
  allowDelete = true,
}: Props) {
  if (segments.length === 0) {
    return <div className="segment-empty">No hay segmentos aun.</div>
  }

  return (
    <table className="segment-table">
      <thead>
        <tr>
          <th>Accion</th>
          <th>Inicio</th>
          <th>Fin</th>
          <th>Duracion</th>
          <th>Repeticion</th>
          <th>Anotador</th>
          <th>Notas</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {segments.map((segment) => {
          const action = ACTION_BY_ID[segment.action]
          const duration = Math.max(0, segment.endSec - segment.startSec)
          return (
            <tr key={segment.id}>
              <td>
                <span className="action-chip" style={{ backgroundColor: action?.color }}>
                  {action?.label ?? segment.action}
                </span>
              </td>
              <td>{formatTime(segment.startSec)}</td>
              <td>{formatTime(segment.endSec)}</td>
              <td>{formatTime(duration)}</td>
              <td>{segment.repetitionId ?? ''}</td>
              <td>{segment.annotatorId ?? ''}</td>
              <td className="notes-cell">{segment.notes}</td>
              <td className="row-actions">
                <button
                  onClick={() => {
                    onSelect?.(segment)
                    onSeek(segment.startSec)
                  }}
                  title="Ir al segmento"
                >
                  <img className="icon" src="/icon-segment.png" alt="Ir" />
                  <span className="btn-text">Ir</span>
                </button>
                {onPreviewPose && (
                  <button
                    onClick={() => {
                      onSelect?.(segment)
                      onPreviewPose(segment)
                    }}
                    title="Previsualizar pose (MediaPipe)"
                  >
                    <span className="btn-text">Pose</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    onSelect?.(segment)
                    onEdit(segment)
                  }}
                  title="Editar segmento"
                  disabled={readOnly}
                >
                  <img className="icon" src="/icon-edit.png" alt="Editar" />
                  <span className="btn-text">Editar</span>
                </button>
                <button
                  onClick={() => onDelete(segment.id)}
                  title="Eliminar segmento"
                  disabled={readOnly || !allowDelete}
                >
                  <img className="icon" src="/icon-trash.png" alt="Eliminar" />
                  <span className="btn-text">Eliminar</span>
                </button>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
