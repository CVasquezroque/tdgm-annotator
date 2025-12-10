import { useEffect, useRef } from 'react'
import type { MutableRefObject } from 'react'

interface Props {
  src?: string | null
  videoRef: MutableRefObject<HTMLVideoElement | null>
  isPlaying: boolean
  playbackRate: number
  isMuted?: boolean
  isLoading?: boolean
  seekTo?: number
  onTimeUpdate: (time: number) => void
  onDuration: (duration: number) => void
  onEnded?: () => void
  onPlayStateChange: (playing: boolean) => void
  onRequestExpand?: () => void
}

export function VideoPlayer({
  src,
  videoRef,
  isPlaying,
  playbackRate,
  isMuted = false,
  isLoading,
  seekTo,
  onTimeUpdate,
  onDuration,
  onEnded,
  onPlayStateChange,
  onRequestExpand,
}: Props) {
  const lastSeek = useRef<number | null>(null)
  const throttleRef = useRef<number>(0)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.playbackRate = playbackRate
    video.muted = isMuted
    if (src) {
      if (isPlaying) {
        void video.play().catch(() => {
          /* autoplay blocked */
        })
      } else {
        video.pause()
      }
    }
  }, [isMuted, isPlaying, playbackRate, src, videoRef])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (typeof seekTo === 'number' && Number.isFinite(seekTo) && seekTo !== lastSeek.current) {
      lastSeek.current = seekTo
      try {
        video.currentTime = seekTo
      } catch {
        /* ignore */
      }
    }
  }, [seekTo, videoRef])

  return (
    <div className={`player-shell ${isLoading ? 'loading' : ''}`}>
      <video
        ref={videoRef}
        className="video-element"
        src={src ?? undefined}
        controls={false}
        onLoadedMetadata={(e) => onDuration((e.target as HTMLVideoElement).duration)}
        onTimeUpdate={(e) => {
          const now = Date.now()
          if (now - throttleRef.current > 100) {
            throttleRef.current = now
            onTimeUpdate((e.target as HTMLVideoElement).currentTime)
          }
        }}
        onClick={() => {
          if (!videoRef.current) return
          onRequestExpand?.()
          if (videoRef.current.paused) {
            void videoRef.current.play()
            onPlayStateChange(true)
          } else {
            videoRef.current.pause()
            onPlayStateChange(false)
          }
        }}
        onPlay={() => onPlayStateChange(true)}
        onPause={() => onPlayStateChange(false)}
        onEnded={() => {
          onEnded?.()
          onPlayStateChange(false)
        }}
      />
      {!src && <div className="placeholder">Carga un video para empezar</div>}
    </div>
  )
}

