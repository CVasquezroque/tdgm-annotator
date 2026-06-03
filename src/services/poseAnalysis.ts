import type { NormalizedLandmark, PoseLandmarker } from '@mediapipe/tasks-vision'

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'

const TASKS_VISION_VERSION = '0.10.22-rc.20250304'
const WASM_BASES = [
  `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VISION_VERSION}/wasm`,
  `https://unpkg.com/@mediapipe/tasks-vision@${TASKS_VISION_VERSION}/wasm`,
]

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
]

const LANDMARK_CONFIDENCE = 0.4
const MIN_VALID_BODY_LANDMARKS = 10

let sharedLandmarker: PoseLandmarker | null = null
let sharedLandmarkerPromise: Promise<PoseLandmarker> | null = null

function abortError() {
  return new DOMException('Pose analysis was aborted.', 'AbortError')
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw abortError()
}

function landmarkConfidence(landmark: NormalizedLandmark) {
  return typeof landmark.visibility === 'number' ? landmark.visibility : 1
}

function isValidPose(landmarks: NormalizedLandmark[]) {
  const validBodyLandmarks = BODY_LANDMARK_IDS.filter((id) => {
    const landmark = landmarks[id]
    return (
      landmark &&
      Number.isFinite(landmark.x) &&
      Number.isFinite(landmark.y) &&
      landmarkConfidence(landmark) >= LANDMARK_CONFIDENCE
    )
  })
  return validBodyLandmarks.length >= MIN_VALID_BODY_LANDMARKS
}

export function getValidPoses(poses: NormalizedLandmark[][]) {
  return poses.filter(isValidPose).slice(0, 2)
}

async function createPoseLandmarker(): Promise<PoseLandmarker> {
  const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision')
  let lastError: unknown = null

  for (const base of WASM_BASES) {
    try {
      const vision = await FilesetResolver.forVisionTasks(base)
      return await PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL },
        runningMode: 'VIDEO',
        numPoses: 2,
        minPoseDetectionConfidence: LANDMARK_CONFIDENCE,
        minPosePresenceConfidence: LANDMARK_CONFIDENCE,
        minTrackingConfidence: LANDMARK_CONFIDENCE,
      })
    } catch (error) {
      lastError = error
    }
  }

  throw lastError ?? new Error('Pose Landmarker could not be loaded.')
}

export async function getSharedPoseLandmarker(signal?: AbortSignal): Promise<PoseLandmarker> {
  throwIfAborted(signal)
  if (sharedLandmarker) return sharedLandmarker

  if (!sharedLandmarkerPromise) {
    sharedLandmarkerPromise = createPoseLandmarker()
      .then((landmarker) => {
        sharedLandmarker = landmarker
        return landmarker
      })
      .catch((error) => {
        sharedLandmarkerPromise = null
        throw error
      })
  }

  const landmarker = await sharedLandmarkerPromise
  throwIfAborted(signal)
  return landmarker
}

export function closeSharedPoseLandmarker() {
  sharedLandmarker?.close()
  sharedLandmarker = null
  sharedLandmarkerPromise = null
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', closeSharedPoseLandmarker)
}

export function drawPoseOverlay(context: CanvasRenderingContext2D, poses: NormalizedLandmark[][]) {
  const colors = ['#22c55e', '#f59e0b']
  context.save()
  context.globalAlpha = 0.85
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.lineWidth = Math.max(2, context.canvas.width / 180)

  poses.forEach((landmarks, poseIndex) => {
    const color = colors[poseIndex] ?? colors[0]
    context.strokeStyle = color
    context.fillStyle = color

    CONNECTORS.forEach(([fromId, toId]) => {
      const from = landmarks[fromId]
      const to = landmarks[toId]
      if (!from || !to || landmarkConfidence(from) < 0.25 || landmarkConfidence(to) < 0.25) return
      context.beginPath()
      context.moveTo(from.x * context.canvas.width, from.y * context.canvas.height)
      context.lineTo(to.x * context.canvas.width, to.y * context.canvas.height)
      context.stroke()
    })

    BODY_LANDMARK_IDS.forEach((id) => {
      const landmark = landmarks[id]
      if (!landmark || landmarkConfidence(landmark) < 0.25) return
      context.beginPath()
      context.arc(
        landmark.x * context.canvas.width,
        landmark.y * context.canvas.height,
        Math.max(2.5, context.canvas.width / 150),
        0,
        Math.PI * 2,
      )
      context.fill()
    })
  })

  context.restore()
}
