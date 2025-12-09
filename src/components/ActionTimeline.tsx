import { ACTION_BY_ID } from '../constants/actions'
import type { Segment } from '../types'
import { formatTime } from '../utils/time'

interface Props {
  segments: Segment[]
  duration: number
  onSelect: (segment: Segment) => void
}

const ACTION_ORDER = [
  'run',
  'gallop',
  'hop',
  'skip',
  'horizontal_jump',
  'slide',
  'strike_two_hands',
  'strike_one_hand',
  'dribble_one_hand',
  'catch_two_hands',
  'kick',
  'overhand_throw',
  'underhand_throw',
] as const

export function ActionTimeline({ segments, duration, onSelect }: Props) {
  const grouped = ACTION_ORDER.map((actionId) => ({
    actionId,
    segments: segments.filter((s) => s.action === actionId),
  })).filter((g) => g.segments.length > 0)

  return (
    <div className="action-timeline">
      {grouped.map(({ actionId, segments: rows }) => {
        const action = ACTION_BY_ID[actionId]
        return (
          <div key={actionId} className="action-row">
            <div className="action-row-label">
              <span className="action-row-name">{action?.label ?? actionId}</span>
            </div>
            <div className="action-row-track">
              {rows.map((s) => {
                const left = duration > 0 ? (s.startSec / duration) * 100 : 0
                const width = duration > 0 ? ((s.endSec - s.startSec) / duration) * 100 : 0
                return (
                  <div
                    key={s.id}
                    className="action-block"
                    style={{
                      left: `${left}%`,
                      width: `${Math.max(width, 0.8)}%`,
                      backgroundColor: action?.color,
                    }}
                    title={`${action?.label ?? s.action}: ${formatTime(s.startSec)} - ${formatTime(s.endSec)}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelect(s)
                    }}
                  />
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

