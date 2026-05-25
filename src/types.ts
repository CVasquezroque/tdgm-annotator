export type ActionId =
  | 'run'
  | 'gallop'
  | 'hop'
  | 'skip'
  | 'horizontal_jump'
  | 'slide'
  | 'strike_two_hands'
  | 'strike_one_hand'
  | 'dribble_one_hand'
  | 'catch_two_hands'
  | 'kick'
  | 'overhand_throw'
  | 'underhand_throw'

export interface ActionDefinition {
  id: ActionId
  label: string
  color: string
  shortKey?: string
}

export interface Segment {
  id: string
  action: ActionId
  startSec: number
  endSec: number
  repetitionId?: string
  annotatorId?: string
  notes?: string
}

export type UserRole = 'admin' | 'supervisor' | 'annotator' | 'reviewer'

export type UserStatus = 'pending' | 'active' | 'suspended'

export interface UserProfile {
  uid: string
  full_name: string
  email: string | null
  institution: string
  role: UserRole
  annotator_code: string
  status: UserStatus
  email_verified: boolean
  training_completed: boolean
  confidentiality_agreement: boolean
  created_at?: unknown
  updated_at?: unknown
  last_login?: unknown
}

export type AccessStatus =
  | 'allowed'
  | 'email_unverified'
  | 'pending_approval'
  | 'suspended'
  | 'training_pending'
  | 'profile_missing'
  | 'profile_creation_denied'
  | 'network_error'
  | 'unknown_error'

export type VideoSourceType = 'local'

export interface VideoMeta {
  source: VideoSourceType
  duration: number
  codedFilename: string
}

export type AnnotationSessionStatus = 'draft' | 'submitted' | 'reviewed' | 'returned' | 'locked'

export type ReviewEventType = 'submitted' | 'reviewed' | 'returned' | 'locked' | 'unlocked'

export type AutosaveStatus = 'idle' | 'unsaved' | 'saving' | 'saved' | 'failed'

export interface VideoRegistryEntry {
  video_code: string
  video_filename: string
  source_type: 'local' | 'local_synced_folder' | 'unknown'
  duration_sec: number | null
  created_by_uid: string
  created_at?: unknown
  notes: string | null
}

export interface AnnotationSession {
  session_id: string
  video_code: string
  video_filename: string
  annotator_uid: string
  annotator_code: string
  reviewer_uid: string | null
  status: AnnotationSessionStatus
  created_at?: unknown
  updated_at?: unknown
  submitted_at?: unknown | null
  reviewed_at?: unknown | null
  locked_at?: unknown | null
  app_version: string
  segment_count: number
  local_video_notice_ack: boolean
}

export interface AnnotationSegment {
  segment_id: string
  session_id: string
  video_code: string
  video_filename: string
  annotator_uid: string
  annotator_code: string
  action: ActionId
  start_sec: number
  end_sec: number
  repetition_id: string
  notes: string | null
  created_at?: unknown
  updated_at?: unknown
}

export interface ReviewEvent {
  event_id: string
  session_id: string
  actor_uid: string
  actor_role: Extract<UserRole, 'reviewer' | 'supervisor' | 'admin'>
  event_type: ReviewEventType
  created_at?: unknown
  comment: string | null
}

export interface AnnotationSessionExportMeta {
  sessionId: string
  videoCode: string
  videoFilename: string
  annotatorUid: string
  annotatorCode: string
  status?: AnnotationSessionStatus
  createdAt: string
  updatedAt: string
  submittedAt?: string | null
  reviewedAt?: string | null
  lockedAt?: string | null
  appVersion: string
  project: 'DIANA'
}

