import { formatTime } from '../utils/time'

const SPEED_OPTIONS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]

interface Props {
  isPlaying: boolean
  currentTime: number
  duration: number
  playbackRate: number
  isMuted: boolean
  onTogglePlay: () => void
  onToggleMute: () => void
  onChangeSpeed: (rate: number) => void
  onJumpBackward?: () => void
  onJumpForward?: () => void
}

export function PlaybackControls({
  isPlaying,
  currentTime,
  duration,
  playbackRate,
  isMuted,
  onTogglePlay,
  onToggleMute,
  onChangeSpeed,
  onJumpBackward,
  onJumpForward,
}: Props) {
  return (
    <div className="controls">
      <div className="controls-left">
        <button onClick={onTogglePlay}>
          <img className="icon" src="/icon-play.png" alt="" />
          {isPlaying ? 'Pausa' : 'Reproducir'}
        </button>
        <button onClick={() => onJumpBackward?.()}>
          <img className="icon" src="/icon-rewind.png" alt="" />
          -2s
        </button>
        <button onClick={() => onJumpForward?.()}>
          <img className="icon icon-flip" src="/icon-rewind.png" alt="" />
          +2s
        </button>
        <div className="time-display">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      </div>
      <div className="controls-right">
        <button onClick={onToggleMute} className="secondary">
          {isMuted ? 'Activar audio' : 'Silenciar'}
        </button>
        <label className="speed-label">
          <img className="icon" src="/icon-speed.png" alt="" />
          Velocidad
          <select value={playbackRate} onChange={(e) => onChangeSpeed(Number(e.target.value))}>
            {SPEED_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}x
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  )
}

