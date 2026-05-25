import { collection, getDocs, orderBy, query, serverTimestamp, updateDoc, doc } from 'firebase/firestore'
import { db } from '../firebase'
import type { UserProfile, UserRole, UserStatus } from '../types'

const USERS = 'users'

export interface UserAdminUpdate {
  role: UserRole
  status: UserStatus
  annotator_code: string
  training_completed: boolean
  confidentiality_agreement: boolean
  approved_by_uid?: string
}

export async function listUserProfiles() {
  const snaps = await getDocs(query(collection(db, USERS), orderBy('created_at', 'desc')))
  return snaps.docs.map((snap) => snap.data() as UserProfile)
}

export async function updateUserProfileAdmin(uid: string, update: UserAdminUpdate) {
  await updateDoc(doc(db, USERS, uid), {
    role: update.role,
    status: update.status,
    annotator_code: update.annotator_code.trim(),
    training_completed: update.training_completed,
    confidentiality_agreement: update.confidentiality_agreement,
    approved_by_uid: update.approved_by_uid ?? null,
    approved_at: update.status === 'active' ? serverTimestamp() : null,
    updated_at: serverTimestamp(),
  })
}
