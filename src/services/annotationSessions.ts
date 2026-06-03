import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type DocumentReference,
  type QueryDocumentSnapshot,
  type Timestamp,
} from 'firebase/firestore'
import { APP_VERSION } from '../constants/app'
import { db } from '../firebase'
import type {
  AnnotationSegment,
  AnnotationSession,
  AnnotationSessionStatus,
  ReviewEvent,
  ReviewEventType,
  Segment,
  UserProfile,
} from '../types'

const SESSIONS = 'annotation_sessions'
const VIDEO_REGISTRY = 'video_registry'
const UNIFIED_SEGMENTS = 'annotation_segments'

export interface SessionInitInput {
  videoCode: string
  videoFilename: string
  annotatorUid: string
  annotatorCode: string
  durationSec: number | null
}

export interface SessionBundle {
  session: AnnotationSession
  segments: Segment[]
}

function cleanId(value: string) {
  return value.replace(/[^A-Z0-9_-]/gi, '_').slice(0, 90)
}

export function makeSessionId(annotatorUid: string, videoCode: string) {
  return `session_${cleanId(annotatorUid)}_${cleanId(videoCode)}`
}

function sessionRef(sessionId: string) {
  return doc(db, SESSIONS, sessionId)
}

function segmentsRef(sessionId: string) {
  return collection(db, SESSIONS, sessionId, 'segments')
}

function unifiedSegmentId(sessionId: string, segmentId: string) {
  return `${cleanId(sessionId)}_${cleanId(segmentId)}`
}

function unifiedSegmentRef(sessionId: string, segmentId: string) {
  return doc(db, UNIFIED_SEGMENTS, unifiedSegmentId(sessionId, segmentId))
}

function reviewEventsRef(sessionId: string) {
  return collection(db, SESSIONS, sessionId, 'review_events')
}

async function deleteDocumentRefs(refs: DocumentReference<DocumentData>[]) {
  const chunkSize = 400
  for (let index = 0; index < refs.length; index += chunkSize) {
    const batch = writeBatch(db)
    refs.slice(index, index + chunkSize).forEach((ref) => batch.delete(ref))
    await batch.commit()
  }
}

export function timestampToIso(value: unknown): string | null {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string') return value
  const maybeTimestamp = value as Partial<Timestamp>
  if (typeof maybeTimestamp.toDate === 'function') {
    return maybeTimestamp.toDate().toISOString()
  }
  return null
}

function mapSessionSnap(snap: QueryDocumentSnapshot<DocumentData> | { id: string; data: () => DocumentData }) {
  const data = snap.data()
  return {
    session_id: data.session_id ?? snap.id,
    video_code: data.video_code,
    video_filename: data.video_filename ?? data.video_code,
    annotator_uid: data.annotator_uid,
    annotator_code: data.annotator_code,
    reviewer_uid: data.reviewer_uid ?? null,
    status: data.status,
    created_at: data.created_at,
    updated_at: data.updated_at,
    submitted_at: data.submitted_at ?? null,
    reviewed_at: data.reviewed_at ?? null,
    locked_at: data.locked_at ?? null,
    app_version: data.app_version ?? APP_VERSION,
    segment_count: data.segment_count ?? 0,
    local_video_notice_ack: data.local_video_notice_ack === true,
  } as AnnotationSession
}

function segmentToFirestore(session: AnnotationSession, segment: Segment): AnnotationSegment {
  return {
    segment_id: segment.id,
    session_id: session.session_id,
    video_code: session.video_code,
    video_filename: session.video_filename,
    annotator_uid: session.annotator_uid,
    annotator_code: session.annotator_code,
    action: segment.action,
    start_sec: segment.startSec,
    end_sec: segment.endSec,
    repetition_id: segment.repetitionId ?? '',
    notes: segment.notes?.trim() || null,
    updated_at: serverTimestamp(),
  }
}

function firestoreToSegment(data: DocumentData): Segment {
  return {
    id: data.segment_id,
    action: data.action,
    startSec: Number(data.start_sec),
    endSec: Number(data.end_sec),
    repetitionId: data.repetition_id ? String(data.repetition_id) : undefined,
    notes: data.notes ?? undefined,
  }
}

function mapUnifiedSegmentSnap(snap: QueryDocumentSnapshot<DocumentData>) {
  const data = snap.data()
  return {
    unified_segment_id: data.unified_segment_id ?? snap.id,
    segment_id: data.segment_id,
    session_id: data.session_id,
    video_code: data.video_code,
    video_filename: data.video_filename,
    annotator_uid: data.annotator_uid,
    annotator_code: data.annotator_code,
    action: data.action,
    start_sec: Number(data.start_sec),
    end_sec: Number(data.end_sec),
    repetition_id: data.repetition_id ?? '',
    notes: data.notes ?? null,
    created_at: data.created_at,
    updated_at: data.updated_at,
  } as AnnotationSegment & { unified_segment_id: string }
}

export function canEditSession(session: AnnotationSession | null, uid?: string | null) {
  if (!session || !uid) return false
  return session.annotator_uid === uid && (session.status === 'draft' || session.status === 'returned')
}

export async function getOrCreateAnnotationSession(input: SessionInitInput): Promise<SessionBundle> {
  const sessionId = makeSessionId(input.annotatorUid, input.videoCode)
  const ref = sessionRef(sessionId)
  const existing = await getDoc(ref)

  const videoRef = doc(db, VIDEO_REGISTRY, input.videoCode)
  const existingVideo = await getDoc(videoRef)
  if (!existingVideo.exists()) {
    await setDoc(videoRef, {
      video_code: input.videoCode,
      video_filename: input.videoFilename,
      source_type: 'local',
      duration_sec: input.durationSec,
      created_by_uid: input.annotatorUid,
      created_at: serverTimestamp(),
      notes: null,
    })
  }

  if (!existing.exists()) {
    const session: AnnotationSession = {
      session_id: sessionId,
      video_code: input.videoCode,
      video_filename: input.videoFilename,
      annotator_uid: input.annotatorUid,
      annotator_code: input.annotatorCode,
      reviewer_uid: null,
      status: 'draft',
      created_at: new Date(),
      updated_at: new Date(),
      submitted_at: null,
      reviewed_at: null,
      locked_at: null,
      app_version: APP_VERSION,
      segment_count: 0,
      local_video_notice_ack: true,
    }
    await setDoc(ref, {
      ...session,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    })
    return { session, segments: [] }
  }

  const session = mapSessionSnap(existing)
  const segmentSnaps = await getDocs(query(segmentsRef(sessionId), orderBy('start_sec', 'asc')))
  const segments = segmentSnaps.docs.map((snap) => firestoreToSegment(snap.data()))
  return { session, segments }
}

export async function saveSessionSegments(session: AnnotationSession, segments: Segment[]) {
  if (session.status !== 'draft' && session.status !== 'returned') {
    throw new Error('La sesion no es editable.')
  }

  const batch = writeBatch(db)
  const current = await getDocs(segmentsRef(session.session_id))
  const nextIds = new Set(segments.map((segment) => segment.id))

  current.docs.forEach((snap) => {
    if (!nextIds.has(snap.id)) {
      batch.delete(snap.ref)
      batch.delete(unifiedSegmentRef(session.session_id, snap.id))
    }
  })

  segments.forEach((segment) => {
    const ref = doc(db, SESSIONS, session.session_id, 'segments', segment.id)
    const payload = segmentToFirestore(session, segment)
    batch.set(
      ref,
      {
        ...payload,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      },
      { merge: true },
    )
    batch.set(
      unifiedSegmentRef(session.session_id, segment.id),
      {
        unified_segment_id: unifiedSegmentId(session.session_id, segment.id),
        ...payload,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      },
      { merge: true },
    )
  })

  batch.update(sessionRef(session.session_id), {
    updated_at: serverTimestamp(),
    segment_count: segments.length,
  })

  await batch.commit()
}

export async function saveReviewedSessionSegments(session: AnnotationSession, segments: Segment[]) {
  if (session.status !== 'submitted') {
    throw new Error('Solo se pueden editar segmentos de una sesion enviada.')
  }

  const current = await getDocs(segmentsRef(session.session_id))
  const currentIds = new Set(current.docs.map((snap) => snap.id))
  const nextIds = new Set(segments.map((segment) => segment.id))
  if (
    currentIds.size !== nextIds.size ||
    [...currentIds].some((segmentId) => !nextIds.has(segmentId))
  ) {
    throw new Error('La revision solo permite editar segmentos existentes.')
  }

  const batch = writeBatch(db)
  segments.forEach((segment) => {
    const payload = {
      action: segment.action,
      start_sec: segment.startSec,
      end_sec: segment.endSec,
      repetition_id: segment.repetitionId ?? '',
      notes: segment.notes?.trim() || null,
      updated_at: serverTimestamp(),
    }
    batch.update(doc(db, SESSIONS, session.session_id, 'segments', segment.id), payload)
    batch.update(unifiedSegmentRef(session.session_id, segment.id), payload)
  })

  await batch.commit()
}

export async function saveReviewSessionNotes(session: AnnotationSession, segments: Segment[]) {
  const chunkSize = 200
  for (let index = 0; index < segments.length; index += chunkSize) {
    const batch = writeBatch(db)
    segments.slice(index, index + chunkSize).forEach((segment) => {
      const payload = {
        notes: segment.notes?.trim() || null,
        updated_at: serverTimestamp(),
      }
      batch.update(doc(db, SESSIONS, session.session_id, 'segments', segment.id), payload)
      batch.update(unifiedSegmentRef(session.session_id, segment.id), payload)
    })
    await batch.commit()
  }
}

export async function submitSession(session: AnnotationSession, segmentCount: number) {
  await updateDoc(sessionRef(session.session_id), {
    status: 'submitted',
    submitted_at: serverTimestamp(),
    updated_at: serverTimestamp(),
    segment_count: segmentCount,
  })
}

export async function setSessionReviewStatus(
  session: AnnotationSession,
  status: Extract<AnnotationSessionStatus, 'reviewed' | 'returned' | 'locked'>,
  actor: UserProfile,
  comment: string | null,
) {
  const update: Record<string, unknown> = {
    status,
    reviewer_uid: actor.uid,
    updated_at: serverTimestamp(),
  }
  if (status === 'reviewed') update.reviewed_at = serverTimestamp()
  if (status === 'locked') update.locked_at = serverTimestamp()
  await updateDoc(sessionRef(session.session_id), update)
  await createReviewEvent(session.session_id, {
    actorUid: actor.uid,
    actorRole: actor.role === 'admin' || actor.role === 'supervisor' || actor.role === 'reviewer' ? actor.role : 'reviewer',
    eventType: status,
    comment,
  })
}

export async function createReviewEvent(
  sessionId: string,
  input: {
    actorUid: string
    actorRole: ReviewEvent['actor_role']
    eventType: ReviewEventType
    comment: string | null
  },
) {
  const eventId = `event_${Date.now()}_${crypto.randomUUID?.() ?? Math.random().toString(16).slice(2)}`
  await setDoc(doc(db, SESSIONS, sessionId, 'review_events', eventId), {
    event_id: eventId,
    session_id: sessionId,
    actor_uid: input.actorUid,
    actor_role: input.actorRole,
    event_type: input.eventType,
    created_at: serverTimestamp(),
    comment: input.comment,
  })
}

export async function getReviewEvents(sessionId: string) {
  const snaps = await getDocs(query(reviewEventsRef(sessionId), orderBy('created_at', 'desc'), limit(25)))
  return snaps.docs.map((snap) => snap.data() as ReviewEvent)
}

export async function listMySessions(uid: string) {
  const snaps = await getDocs(query(collection(db, SESSIONS), where('annotator_uid', '==', uid)))
  return snaps.docs
    .map((snap) => mapSessionSnap(snap))
    .sort((a, b) => {
      const aTime = timestampToIso(a.updated_at) ?? ''
      const bTime = timestampToIso(b.updated_at) ?? ''
      return bTime.localeCompare(aTime)
    })
}

export async function listReviewableSessions() {
  const snaps = await getDocs(query(collection(db, SESSIONS), orderBy('updated_at', 'desc'), limit(200)))
  return snaps.docs.map((snap) => mapSessionSnap(snap))
}

export async function listSessionsForDashboard(input: { uid: string; canReadAll: boolean }) {
  if (!input.canReadAll) return listMySessions(input.uid)

  const snaps = await getDocs(collection(db, SESSIONS))
  return snaps.docs
    .map((snap) => mapSessionSnap(snap))
    .sort((a, b) => {
      const aTime = timestampToIso(a.updated_at) ?? ''
      const bTime = timestampToIso(b.updated_at) ?? ''
      return bTime.localeCompare(aTime)
    })
}

export async function listUnifiedSegmentsForExport(input: { uid: string; canReadAll: boolean }) {
  const base = collection(db, UNIFIED_SEGMENTS)
  const segmentQuery = input.canReadAll ? query(base) : query(base, where('annotator_uid', '==', input.uid))
  const snaps = await getDocs(segmentQuery)
  return snaps.docs
    .map((snap) => mapUnifiedSegmentSnap(snap))
    .sort((a, b) => {
      const byVideo = a.video_filename.localeCompare(b.video_filename)
      if (byVideo !== 0) return byVideo
      const byAnnotator = a.annotator_code.localeCompare(b.annotator_code)
      if (byAnnotator !== 0) return byAnnotator
      return a.start_sec - b.start_sec
    })
}

export async function loadSessionBundle(sessionId: string): Promise<SessionBundle | null> {
  const snap = await getDoc(sessionRef(sessionId))
  if (!snap.exists()) return null
  const session = mapSessionSnap(snap)
  const segmentSnaps = await getDocs(query(segmentsRef(sessionId), orderBy('start_sec', 'asc')))
  return {
    session,
    segments: segmentSnaps.docs.map((segmentSnap) => firestoreToSegment(segmentSnap.data())),
  }
}

export async function deleteAnnotationSession(sessionId: string) {
  const [segmentSnaps, reviewEventSnaps, unifiedSegmentSnaps] = await Promise.all([
    getDocs(segmentsRef(sessionId)),
    getDocs(reviewEventsRef(sessionId)),
    getDocs(query(collection(db, UNIFIED_SEGMENTS), where('session_id', '==', sessionId))),
  ])

  await deleteDocumentRefs([
    ...segmentSnaps.docs.map((snap) => snap.ref),
    ...reviewEventSnaps.docs.map((snap) => snap.ref),
    ...unifiedSegmentSnaps.docs.map((snap) => snap.ref),
  ])
  await deleteDoc(sessionRef(sessionId))
}

export async function deleteSessionSegment(sessionId: string, segmentId: string) {
  await deleteDoc(doc(db, SESSIONS, sessionId, 'segments', segmentId))
  await deleteDoc(unifiedSegmentRef(sessionId, segmentId))
}
