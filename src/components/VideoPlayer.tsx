import { useEffect } from 'react'
import type { MutableRefObject } from 'react'

interface Props {
  src?: string | null
  videoRef: MutableRefObject<HTMLVideoElement | null>
  isPlaying: boolean
  playbackRate: number
  onTimeUpdate: (time: number) => void
  onDuration: (duration: number) => void
  onEnded?: () => void
  onPlayStateChange: (playing: boolean) => void
}

export function VideoPlayer({
  src,
  videoRef,
  isPlaying,
  playbackRate,
  onTimeUpdate,
  onDuration,
  onEnded,
  onPlayStateChange,
}: Props) {
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.playbackRate = playbackRate
    if (src) {
      if (isPlaying) {
        void video.play().catch(() => {
          /* autoplay blocked */
        })
      } else {
        video.pause()
      }
    }
  }, [isPlaying, playbackRate, src, videoRef])

  return (
    <div className="player-shell">
      <video
        ref={videoRef}
        className="video-element"
        src={src ?? undefined}
        controls={false}
        onLoadedMetadata={(e) => onDuration((e.target as HTMLVideoElement).duration)}
        onTimeUpdate={(e) => onTimeUpdate((e.target as HTMLVideoElement).currentTime)}
        onClick={() => {
          if (!videoRef.current) return
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

