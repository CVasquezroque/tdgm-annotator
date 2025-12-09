import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { clamp, formatTime } from '../utils/time'

interface Props {
  duration: number
  currentTime: number
  onSeek: (time: number) => void
  onRequestPreview: (time: number) => void
  previewUrl?: string | null
  previewTime?: number | null
  children?: ReactNode
}

export function Timeline({
  duration,
  currentTime,
  onSeek,
  onRequestPreview,
  previewUrl,
  previewTime,
  children,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [isScrubbing, setIsScrubbing] = useState(false)
  const [hoverTime, setHoverTime] = useState<number | null>(null)

  const ratio = duration > 0 ? (currentTime / duration) * 100 : 0

  const computeTimeFromClientX = useCallback(
    (clientX: number) => {
      if (!containerRef.current || duration <= 0) return 0
      const rect = containerRef.current.getBoundingClientRect()
      const percent = clamp((clientX - rect.left) / rect.width, 0, 1)
      return percent * duration
    },
    [duration],
  )

  const handlePointer = useCallback(
    (clientX: number) => {
      const t = computeTimeFromClientX(clientX)
      setHoverTime(t)
      onRequestPreview(t)
      return t
    },
    [computeTimeFromClientX, onRequestPreview],
  )

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!isScrubbing) return
      const t = handlePointer(e.clientX)
      onSeek(t)
    }
    const up = (e: MouseEvent) => {
      if (!isScrubbing) return
      const t = handlePointer(e.clientX)
      onSeek(t)
      setIsScrubbing(false)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    return () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
  }, [handlePointer, isScrubbing, onSeek])

  const thumbLeft = `${ratio}%`
  const previewLeft =
    hoverTime !== null && duration > 0 ? `${(hoverTime / duration) * 100}%` : thumbLeft

  return (
    <div
      className="timeline-container"
      ref={containerRef}
      onMouseMove={(e) => handlePointer(e.clientX)}
      onMouseEnter={(e) => handlePointer(e.clientX)}
      onMouseLeave={() => setHoverTime(null)}
      onMouseDown={(e) => {
        setIsScrubbing(true)
        const t = handlePointer(e.clientX)
        onSeek(t)
      }}
    >
      <div className="timeline-track">
        <div className="timeline-progress" style={{ width: `${ratio}%` }} />
        <div className="timeline-thumb" style={{ left: thumbLeft }} />
      </div>
      {children}
      {hoverTime !== null && (
        <div className="timeline-preview" style={{ left: previewLeft }}>
          {previewUrl ? <img src={previewUrl} alt="preview" /> : <div className="preview-empty" />}
          <div className="preview-time">{formatTime(previewTime ?? hoverTime)}</div>
        </div>
      )}
    </div>
  )
}

