import type { Segment } from '../types'
import { formatTime } from '../utils/time'
import { ACTION_BY_ID } from '../constants/actions'

interface Props {
  segments: Segment[]
  duration: number
  onSelect: (segment: Segment) => void
}

export function SegmentTrack({ segments, duration, onSelect }: Props) {
  return (
    <div className="segment-track">
      {segments.map((s) => {
        const left = duration > 0 ? (s.startSec / duration) * 100 : 0
        const width = duration > 0 ? ((s.endSec - s.startSec) / duration) * 100 : 0
        const action = ACTION_BY_ID[s.action]
        return (
          <div
            key={s.id}
            className="segment-block"
            title={`${action?.label ?? s.action}: ${formatTime(s.startSec)} - ${formatTime(s.endSec)}`}
            style={{ left: `${left}%`, width: `${Math.max(width, 0.5)}%`, backgroundColor: action?.color }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              onSelect(s)
            }}
          />
        )
      })}
    </div>
  )
}

