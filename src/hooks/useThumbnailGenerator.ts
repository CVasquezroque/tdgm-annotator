import { useEffect, useRef, useState } from 'react'

const PREVIEW_REQUEST_INTERVAL_MS = 180

function cleanupVideo(video: HTMLVideoElement) {
  video.pause()
  video.removeAttribute('src')
  video.load()
}

export function useThumbnailGenerator(src: string | null, enabled = true) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const lastRequestAtRef = useRef(0)
  const pendingRequestRef = useRef<number | null>(null)
  const pendingTimeRef = useRef<number | null>(null)
  const [ready, setReady] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewTime, setPreviewTime] = useState<number | null>(null)

  useEffect(() => {
    if (!src || !enabled) return undefined

    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true
    video.src = src

    const handleLoaded = () => setReady(true)
    const handleSeeked = () => {
      const canvas = canvasRef.current ?? document.createElement('canvas')
      canvasRef.current = canvas
      const context = canvas.getContext('2d')
      if (!context || !video.videoWidth || !video.videoHeight) return
      const maxWidth = 240
      const ratio = Math.min(1, maxWidth / video.videoWidth)
      canvas.width = Math.max(1, Math.round(video.videoWidth * ratio))
      canvas.height = Math.max(1, Math.round(video.videoHeight * ratio))
      context.drawImage(video, 0, 0, canvas.width, canvas.height)
      setPreviewUrl(canvas.toDataURL('image/jpeg', 0.75))
    }

    video.addEventListener('loadedmetadata', handleLoaded)
    video.addEventListener('seeked', handleSeeked)
    videoRef.current = video

    return () => {
      video.removeEventListener('loadedmetadata', handleLoaded)
      video.removeEventListener('seeked', handleSeeked)
      cleanupVideo(video)
      if (videoRef.current === video) videoRef.current = null
      if (canvasRef.current) {
        canvasRef.current.width = 0
        canvasRef.current.height = 0
        canvasRef.current = null
      }
      if (pendingRequestRef.current !== null) {
        window.clearTimeout(pendingRequestRef.current)
        pendingRequestRef.current = null
      }
      pendingTimeRef.current = null
      setReady(false)
      setPreviewUrl(null)
      setPreviewTime(null)
    }
  }, [enabled, src])

  const seekPreviewVideo = (time: number) => {
    if (!ready || !enabled || !videoRef.current) return
    const clamped = Math.max(0, Math.min(time, videoRef.current.duration || time))
    setPreviewTime(clamped)
    videoRef.current.currentTime = clamped
    lastRequestAtRef.current = performance.now()
  }

  const requestPreview = (time: number) => {
    if (!ready || !enabled || !videoRef.current) return
    const elapsed = performance.now() - lastRequestAtRef.current
    if (elapsed >= PREVIEW_REQUEST_INTERVAL_MS) {
      seekPreviewVideo(time)
      return
    }

    pendingTimeRef.current = time
    if (pendingRequestRef.current !== null) return
    pendingRequestRef.current = window.setTimeout(() => {
      pendingRequestRef.current = null
      const pendingTime = pendingTimeRef.current
      pendingTimeRef.current = null
      if (pendingTime !== null) seekPreviewVideo(pendingTime)
    }, PREVIEW_REQUEST_INTERVAL_MS - elapsed)
  }

  return { previewUrl, previewTime, requestPreview }
}
