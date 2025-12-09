import { useEffect, useRef, useState } from 'react'

export function useThumbnailGenerator(src: string | null) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [ready, setReady] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewTime, setPreviewTime] = useState<number | null>(null)

  useEffect(() => {
    if (!src) return undefined
    const video = document.createElement('video')
    video.preload = 'auto'
    video.muted = true
    video.src = src
    const handleLoaded = () => setReady(true)
    const handleSeeked = () => {
      const canvas = canvasRef.current ?? document.createElement('canvas')
      canvasRef.current = canvas
      const ctx = canvas.getContext('2d')
      if (!ctx || !video.videoWidth || !video.videoHeight) return
      const maxWidth = 240
      const ratio = Math.min(1, maxWidth / video.videoWidth)
      canvas.width = Math.max(1, video.videoWidth * ratio)
      canvas.height = Math.max(1, video.videoHeight * ratio)
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      setPreviewUrl(canvas.toDataURL('image/jpeg'))
    }
    video.addEventListener('loadedmetadata', handleLoaded)
    video.addEventListener('seeked', handleSeeked)
    videoRef.current = video
    return () => {
      video.pause()
      video.removeEventListener('loadedmetadata', handleLoaded)
      video.removeEventListener('seeked', handleSeeked)
      videoRef.current = null
      setReady(false)
      setPreviewUrl(null)
    }
  }, [src])

  const requestPreview = (time: number) => {
    if (!ready || !videoRef.current) return
    const clamped = Math.max(0, Math.min(time, videoRef.current.duration || time))
    setPreviewTime(clamped)
    videoRef.current.currentTime = clamped
  }

  return { previewUrl, previewTime, requestPreview }
}

