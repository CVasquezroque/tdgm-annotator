import type { User as FirebaseUser } from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import type { UserProfile } from '../types'

export interface RegistrationProfileInput {
  fullName: string
  institution: string
}

export interface SafeProfileUpdateInput {
  fullName: string
  institution: string
}

const USERS_COLLECTION = 'users'

function profileRef(uid: string) {
  return doc(db, USERS_COLLECTION, uid)
}

function cleanText(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

function fallbackFullName(user: FirebaseUser) {
  return user.displayName?.trim() || ''
}

export function isFirestorePermissionError(e: unknown) {
  return Boolean(
    e &&
      typeof e === 'object' &&
      'code' in e &&
      ((e as { code: unknown }).code === 'permission-denied' ||
        (e as { code: unknown }).code === 'PERMISSION_DENIED'),
  )
}

export function isFirestoreNetworkError(e: unknown) {
  return Boolean(
    e &&
      typeof e === 'object' &&
      'code' in e &&
      ((e as { code: unknown }).code === 'unavailable' || (e as { code: unknown }).code === 'deadline-exceeded'),
  )
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(profileRef(uid))
  return snap.exists() ? (snap.data() as UserProfile) : null
}

export async function createPendingUserProfile(
  user: FirebaseUser,
  input: RegistrationProfileInput,
): Promise<UserProfile> {
  const now = new Date()
  const profile: UserProfile = {
    uid: user.uid,
    full_name: cleanText(input.fullName),
    email: user.email ?? null,
    institution: cleanText(input.institution),
    role: 'annotator',
    annotator_code: '',
    status: 'pending',
    email_verified: user.emailVerified,
    training_completed: false,
    confidentiality_agreement: false,
    created_at: now,
    updated_at: now,
    last_login: now,
  }

  await setDoc(profileRef(user.uid), {
    ...profile,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
    last_login: serverTimestamp(),
  })
  return profile
}

export async function ensureUserProfile(user: FirebaseUser): Promise<UserProfile> {
  const existing = await getUserProfile(user.uid)
  if (existing) return existing

  return createPendingUserProfile(user, {
    fullName: fallbackFullName(user),
    institution: '',
  })
}

export async function updateProfileLoginState(user: FirebaseUser) {
  await updateDoc(profileRef(user.uid), {
    email: user.email ?? null,
    email_verified: user.emailVerified,
    last_login: serverTimestamp(),
    updated_at: serverTimestamp(),
  })
}

export async function updateOwnSafeProfile(uid: string, input: SafeProfileUpdateInput) {
  await updateDoc(profileRef(uid), {
    full_name: cleanText(input.fullName),
    institution: cleanText(input.institution),
    updated_at: serverTimestamp(),
  })
}
