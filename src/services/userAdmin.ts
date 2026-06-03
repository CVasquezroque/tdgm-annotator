import { collection, deleteDoc, doc, getDocs, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore'
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

export async function deleteUserProfileAdmin(uid: string, actorUid: string) {
  if (uid === actorUid) {
    throw new Error('No puedes eliminar tu propio perfil administrativo.')
  }
  await deleteDoc(doc(db, USERS, uid))
}
