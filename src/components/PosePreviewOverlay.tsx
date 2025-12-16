import { useEffect, useMemo, useRef, useState } from 'react'
import type { Segment } from '../types'
import { FilesetResolver, PoseLandmarker, type NormalizedLandmark } from '@mediapipe/tasks-vision'
import { formatTime } from '../utils/time'

// Modelo oficial pose_landmarker lite float16 (ruta doc oficial)
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'

// Rutas WASM recomendadas (doc oficial usa @latest). Probamos jsdelivr y luego unpkg.
const WASM_BASES = [
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
  'https://unpkg.com/@mediapipe/tasks-vision@latest/wasm',
]

// Landmarks seleccionados (cuerpo)
const BODY_LANDMARK_IDS = [
  11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32,
] as const

const CONNECTORS: Array<[number, number]> = [
  [11, 12],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [24, 26],
  [25, 27],
  [26, 28],
  [27, 29],
  [28, 30],
  [29, 31],
  [30, 32],
  [11, 13],
  [13, 15],
  [15, 17],
  [15, 19],
  [15, 21],
  [12, 14],
  [14, 16],
  [16, 18],
  [16, 20],
  [16, 22],
] as const

// Color único (verde) para trazos y puntos
const LANDMARK_COLOR = '#22c55e'

interface Props {
  segment: Segment
  videoSrc: string | null
  onClose: () => void
}

export function PosePreviewOverlay({ segment, videoSrc, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const landmarkerRef = useRef<PoseLandmarker | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadingModel, setLoadingModel] = useState(true)
  const [ready, setReady] = useState(false)
  const [videoOpacity, setVideoOpacity] = useState(0.85)
  const [showPanel, setShowPanel] = useState(true)

  const bodySet = useMemo(() => new Set(BODY_LANDMARK_IDS), [])

  // Carga del modelo de Pose
  useEffect(() => {
    let cancelled = false
    const loadModel = async () => {
      try {
        let vision = null
        let lastError: unknown = null
        for (const base of WASM_BASES) {
          try {
            vision = await FilesetResolver.forVisionTasks(base)
            lastError = null
            break
          } catch (err) {
            lastError = err
          }
        }
        if (!vision) throw lastError ?? new Error('No se pudo cargar WASM de MediaPipe')
        if (cancelled) return

        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL },
          runningMode: 'VIDEO',
          numPoses: 1,
        })
        if (cancelled) return
        landmarkerRef.current = landmarker
        setError(null)
      } catch (e) {
        console.error(e)
        if (!cancelled)
          setError(
            'No se pudo cargar el modelo de MediaPipe. Revisa conexión o bloqueos a jsdelivr/unpkg/storage.googleapis.com.',
          )
      } finally {
        if (!cancelled) setLoadingModel(false)
      }
    }
    void loadModel()
    return () => {
      cancelled = true
      landmarkerRef.current?.close()
      landmarkerRef.current = null
    }
  }, [])

  // Configura video en el inicio del segmento
  useEffect(() => {
    const video = videoRef.current
    if (!video || !videoSrc) return
    const onLoaded = () => {
      video.currentTime = segment.startSec
      video.playbackRate = 0.5
      void video.play().catch(() => {})
      setReady(true)
    }
    video.addEventListener('loadedmetadata', onLoaded)
    return () => {
      video.removeEventListener('loadedmetadata', onLoaded)
    }
  }, [segment.startSec, videoSrc])

  // Loop de reproducción limitado al segmento
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const onTime = () => {
      if (video.currentTime >= segment.endSec) {
        video.currentTime = segment.startSec
      }
    }
    video.addEventListener('timeupdate', onTime)
    return () => video.removeEventListener('timeupdate', onTime)
  }, [segment.endSec, segment.startSec])

  // Ajusta el canvas al tamaño del video
  useEffect(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    const resize = () => {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
    }
    video.addEventListener('loadedmetadata', resize)
    return () => video.removeEventListener('loadedmetadata', resize)
  }, [])

  // Dibuja landmarks filtrados
  const drawLandmarks = (landmarks: NormalizedLandmark[]) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const selected: Record<number, NormalizedLandmark> = {}
    landmarks.forEach((lm, idx) => {
      if (bodySet.has(idx as (typeof BODY_LANDMARK_IDS)[number])) {
        selected[idx] = lm
      }
    })

    ctx.lineWidth = 4
    ctx.strokeStyle = LANDMARK_COLOR
    CONNECTORS.forEach(([a, b]) => {
      const lmA = selected[a]
      const lmB = selected[b]
      if (!lmA || !lmB) return
      ctx.beginPath()
      ctx.moveTo(lmA.x * canvas.width, lmA.y * canvas.height)
      ctx.lineTo(lmB.x * canvas.width, lmB.y * canvas.height)
      ctx.stroke()
    })

    ctx.fillStyle = LANDMARK_COLOR
    Object.values(selected).forEach((lm) => {
      ctx.beginPath()
      ctx.arc(lm.x * canvas.width, lm.y * canvas.height, 6, 0, Math.PI * 2)
      ctx.fill()
    })
  }

  // Bucle de inferencia
  useEffect(() => {
    let raf: number
    const loop = () => {
      const video = videoRef.current
      const landmarker = landmarkerRef.current
      if (!video || !landmarker || loadingModel || !ready) {
        raf = requestAnimationFrame(loop)
        return
      }
      if (!video.paused && !video.ended) {
        const results = landmarker.detectForVideo(video, performance.now())
        const lms = results?.landmarks?.[0]
        if (lms) {
          drawLandmarks(lms)
        }
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [loadingModel, ready, bodySet])

  return (
    <div className="pose-overlay-backdrop" onClick={onClose}>
      <div className="pose-overlay" onClick={(e) => e.stopPropagation()}>
        <div className="pose-overlay-header">
          <div className="pose-heading">
            <p className="pose-eyebrow">Previsualización de pose (MediaPipe)</p>
            <h3>{segment.action}</h3>
            <p className="pose-meta">
              {formatTime(segment.startSec)} → {formatTime(segment.endSec)} ({formatTime(segment.endSec - segment.startSec)
              })
            </p>
          </div>
          <button className="ghost" onClick={onClose}>
            Cerrar
          </button>
        </div>

        {error && <div className="pose-error">{error}</div>}
        {loadingModel && <div className="pose-status">Cargando modelo de pose...</div>}

        <div className={`pose-body ${showPanel ? 'with-panel' : 'panel-hidden'}`}>
          <div className="pose-player">
            <video
              ref={videoRef}
              className="pose-video"
              src={videoSrc ?? undefined}
              muted
              style={{ opacity: videoOpacity }}
              playsInline
              controls
              autoPlay
            />
            <canvas ref={canvasRef} className="pose-canvas" />
          </div>

          {showPanel && (
            <div className="pose-panel">
              <div className="pose-panel-header">
                <strong>Controles</strong>
                <button className="ghost small" onClick={() => setShowPanel(false)}>
                  Ocultar panel
                </button>
              </div>
              <div className="pose-opacity">
                <label>
                  Opacidad del video
                  <input
                    type="range"
                    min={0.3}
                    max={1}
                    step={0.05}
                    value={videoOpacity}
                    onChange={(e) => setVideoOpacity(Number(e.target.value))}
                  />
                  <span>{Math.round(videoOpacity * 100)}%</span>
                </label>
              </div>
              {error && <div className="pose-error">{error}</div>}
              {loadingModel && !error && <div className="pose-status">Cargando modelo de pose...</div>}
            </div>
          )}
          {!showPanel && (
            <button className="ghost small panel-toggle" onClick={() => setShowPanel(true)}>
              Mostrar panel
            </button>
          )}
        </div>
      </div>
    </div>
  )
}


