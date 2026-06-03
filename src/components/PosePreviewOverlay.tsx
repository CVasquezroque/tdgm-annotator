import { useCallback, useState } from 'react'
import type { Segment } from '../types'
import { formatTime } from '../utils/time'
import { SegmentLoopPreview, type SegmentPoseTrackingStatus } from './SegmentLoopPreview'

interface Props {
  segment: Segment
  videoSrc: string | null
  onClose: () => void
}

export function PosePreviewOverlay({ segment, videoSrc, onClose }: Props) {
  const [videoOpacity, setVideoOpacity] = useState(0.85)
  const [showPanel, setShowPanel] = useState(true)
  const [poseStatus, setPoseStatus] = useState<SegmentPoseTrackingStatus>('loading')
  const [possibleInstructorCrossing, setPossibleInstructorCrossing] = useState(false)
  const handleMultiplePosesDetected = useCallback(() => setPossibleInstructorCrossing(true), [])

  return (
    <div className="pose-overlay-backdrop" onClick={onClose}>
      <div className="pose-overlay" onClick={(event) => event.stopPropagation()}>
        <div className="pose-overlay-header">
          <div className="pose-heading">
            <p className="pose-eyebrow">Previsualizacion de pose (MediaPipe)</p>
            <h3>{segment.action}</h3>
            <p className="pose-meta">
              {formatTime(segment.startSec)} - {formatTime(segment.endSec)} (
              {formatTime(segment.endSec - segment.startSec)})
            </p>
          </div>
          <button className="ghost" onClick={onClose}>
            Cerrar
          </button>
        </div>

        <div className={`pose-body ${showPanel ? 'with-panel' : 'panel-hidden'}`}>
          <div className="pose-player">
            {videoSrc ? (
              <SegmentLoopPreview
                className="pose-loop-preview"
                videoSrc={videoSrc}
                startSec={segment.startSec}
                endSec={segment.endSec}
                enablePose
                videoOpacity={videoOpacity}
                onPoseStatusChange={setPoseStatus}
                onMultiplePosesDetected={handleMultiplePosesDetected}
              />
            ) : (
              <div className="pose-status">Carga el video local correspondiente para previsualizar la pose.</div>
            )}
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
                    onChange={(event) => setVideoOpacity(Number(event.target.value))}
                  />
                  <span>{Math.round(videoOpacity * 100)}%</span>
                </label>
              </div>
              <div className="pose-summary-details" aria-live="polite">
                {poseStatus === 'loading' && <span>Cargando MediaPipe para el segmento.</span>}
                {poseStatus === 'tracking' && (
                  <span>Estimando pose durante toda la reproduccion del segmento.</span>
                )}
                {poseStatus === 'detected' && (
                  <span>Pose activa durante toda la reproduccion del segmento.</span>
                )}
                {poseStatus === 'unavailable' && <span>No se pudo ejecutar MediaPipe.</span>}
                {possibleInstructorCrossing && (
                  <span className="auto-suggestion-badge">Posible cruce de instructor</span>
                )}
              </div>
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
