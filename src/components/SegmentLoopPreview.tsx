import { useCallback, useEffect, useRef } from 'react'
import type { NormalizedLandmark, PoseLandmarker } from '@mediapipe/tasks-vision'
import { drawPoseOverlay, getSharedPoseLandmarker, getValidPoses } from '../services/poseAnalysis'

export type SegmentPoseTrackingStatus = 'disabled' | 'loading' | 'tracking' | 'detected' | 'unavailable'

interface Props {
  videoSrc: string
  startSec: number
  endSec: number
  enablePose?: boolean
  className?: string
  videoOpacity?: number
  onPoseStatusChange?: (status: SegmentPoseTrackingStatus) => void
  onMultiplePosesDetected?: () => void
  onPoseProcessingChange?: (processing: boolean) => void
}

interface VideoFrameMetadata {
  mediaTime: number
}

type VideoFrameCallback = (now: number, metadata: VideoFrameMetadata) => void

type FrameCallbackVideo = HTMLVideoElement & {
  requestVideoFrameCallback?: (callback: VideoFrameCallback) => number
  cancelVideoFrameCallback?: (handle: number) => void
}

export function SegmentLoopPreview({
  videoSrc,
  startSec,
  endSec,
  enablePose = false,
  className = '',
  videoOpacity = 1,
  onPoseStatusChange,
  onMultiplePosesDetected,
  onPoseProcessingChange,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const statusCallbackRef = useRef(onPoseStatusChange)
  const multiplePosesCallbackRef = useRef(onMultiplePosesDetected)
  const processingCallbackRef = useRef(onPoseProcessingChange)
  const firstAnalysisPassRef = useRef(false)

  useEffect(() => {
    statusCallbackRef.current = onPoseStatusChange
    multiplePosesCallbackRef.current = onMultiplePosesDetected
    processingCallbackRef.current = onPoseProcessingChange
  }, [onMultiplePosesDetected, onPoseProcessingChange, onPoseStatusChange])

  const reportStatus = useCallback((status: SegmentPoseTrackingStatus) => {
    statusCallbackRef.current?.(status)
  }, [])

  const clearPoseCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    context.clearRect(0, 0, canvas.width, canvas.height)
  }, [])

  const drawPoses = useCallback(
    (poses: NormalizedLandmark[][]) => {
      const canvas = canvasRef.current
      const context = canvas?.getContext('2d')
      if (!canvas || !context) return
      clearPoseCanvas()
      if (poses.length > 0) drawPoseOverlay(context, poses)
    },
    [clearPoseCanvas],
  )

  useEffect(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return undefined

    const syncCanvas = () => {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      clearPoseCanvas()
    }

    const startLoop = () => {
      const safeStart = Math.max(0, Math.min(startSec, Number.isFinite(video.duration) ? video.duration : startSec))
      video.currentTime = safeStart
      video.playbackRate = firstAnalysisPassRef.current ? 1 : 0.5
      void video.play().catch(() => {
        // Native controls remain available when autoplay is blocked.
      })
    }

    video.addEventListener('loadedmetadata', syncCanvas)
    video.addEventListener('loadedmetadata', startLoop)
    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
      syncCanvas()
      startLoop()
    }

    return () => {
      video.removeEventListener('loadedmetadata', syncCanvas)
      video.removeEventListener('loadedmetadata', startLoop)
      video.pause()
    }
  }, [clearPoseCanvas, startSec, videoSrc])

  useEffect(() => {
    if (!enablePose) {
      clearPoseCanvas()
      reportStatus('disabled')
      processingCallbackRef.current?.(false)
      return undefined
    }

    const video = videoRef.current
    if (!video) return undefined

    const controller = new AbortController()
    const frameVideo = video as FrameCallbackVideo
    let cancelled = false
    let inferenceFailed = false
    let landmarker: PoseLandmarker | null = null
    let videoFrameRequest: number | null = null
    let animationFrameRequest: number | null = null
    let lastFallbackTime = -1
    let poseDetected = false
    let crossingNotified = false
    const twoPoseFrameBuckets = new Set<number>()

    const processFrame = (mediaTime: number) => {
      if (
        cancelled ||
        inferenceFailed ||
        !landmarker ||
        video.paused ||
        video.ended ||
        video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
      ) {
        return
      }

      const currentTime = video.currentTime
      if (currentTime < startSec - 0.05 || currentTime > endSec + 0.05) return

      try {
        const result = landmarker.detectForVideo(video, performance.now())
        const validPoses = getValidPoses(result.landmarks ?? [])
        drawPoses(validPoses)

        if (validPoses.length > 0 && !poseDetected) {
          poseDetected = true
          reportStatus('detected')
        }

        if (validPoses.length >= 2 && !crossingNotified) {
          twoPoseFrameBuckets.add(Math.round(mediaTime * 30))
          if (twoPoseFrameBuckets.size >= 2) {
            crossingNotified = true
            multiplePosesCallbackRef.current?.()
          }
        }
      } catch (error) {
        inferenceFailed = true
        clearPoseCanvas()
        reportStatus('unavailable')
        processingCallbackRef.current?.(false)
        landmarker = null
        console.warn('No se pudo continuar la estimacion de pose del segmento.', error)
      }
    }

    const scheduleNextFrame = () => {
      if (cancelled || inferenceFailed) return

      if (frameVideo.requestVideoFrameCallback) {
        videoFrameRequest = frameVideo.requestVideoFrameCallback((_now, metadata) => {
          processFrame(metadata.mediaTime)
          scheduleNextFrame()
        })
        return
      }

      animationFrameRequest = window.requestAnimationFrame(() => {
        const mediaTime = video.currentTime
        if (mediaTime !== lastFallbackTime) {
          lastFallbackTime = mediaTime
          processFrame(mediaTime)
        }
        scheduleNextFrame()
      })
    }

    const loadLandmarker = async () => {
      reportStatus('loading')
      processingCallbackRef.current?.(true)
      try {
        landmarker = await getSharedPoseLandmarker(controller.signal)
        if (cancelled) {
          landmarker = null
          return
        }
        reportStatus('tracking')
        firstAnalysisPassRef.current = true
        video.playbackRate = 1
        video.currentTime = Math.max(
          0,
          Math.min(startSec, Number.isFinite(video.duration) ? video.duration : startSec),
        )
        void video.play().catch(() => {})
        scheduleNextFrame()
      } catch (error) {
        if (controller.signal.aborted) return
        inferenceFailed = true
        reportStatus('unavailable')
        processingCallbackRef.current?.(false)
        console.warn('No se pudo cargar MediaPipe para el segmento.', error)
      }
    }

    void loadLandmarker()

    return () => {
      cancelled = true
      controller.abort()
      if (videoFrameRequest !== null) frameVideo.cancelVideoFrameCallback?.(videoFrameRequest)
      if (animationFrameRequest !== null) window.cancelAnimationFrame(animationFrameRequest)
      landmarker = null
      clearPoseCanvas()
      processingCallbackRef.current?.(false)
    }
  }, [clearPoseCanvas, drawPoses, enablePose, endSec, reportStatus, startSec, videoSrc])

  useEffect(
    () => () => {
      const video = videoRef.current
      const canvas = canvasRef.current
      if (video) {
        video.pause()
        video.removeAttribute('src')
        video.load()
      }
      if (canvas) {
        canvas.width = 0
        canvas.height = 0
      }
    },
    [],
  )

  return (
    <div className={`segment-loop-preview ${className}`.trim()}>
      <video
        ref={videoRef}
        className="segment-loop-video"
        src={videoSrc}
        style={{ opacity: videoOpacity }}
        controls
        preload="metadata"
        muted
        autoPlay
        playsInline
        onTimeUpdate={(event) => {
          const video = event.currentTarget
          if (video.currentTime >= endSec - 0.05 || video.currentTime < startSec) {
            if (firstAnalysisPassRef.current) {
              firstAnalysisPassRef.current = false
              video.playbackRate = 0.5
            }
            video.currentTime = startSec
            void video.play().catch(() => {})
          }
        }}
      />
      <canvas ref={canvasRef} className="segment-loop-pose-canvas" aria-hidden="true" />
    </div>
  )
}
