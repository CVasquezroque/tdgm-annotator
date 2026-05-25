import { useEffect, useMemo, useState } from 'react'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User as FirebaseUser,
} from 'firebase/auth'
import { auth } from '../firebase'
import type { AccessStatus, UserProfile } from '../types'
import {
  createPendingUserProfile,
  ensureUserProfile,
  isFirestoreNetworkError,
  isFirestorePermissionError,
  updateProfileLoginState,
  type RegistrationProfileInput,
} from '../services/userProfiles'

export interface User {
  uid: string
  username: string
  email: string | null
  emailVerified: boolean
}

function translateFirebaseError(code: string): string {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
      return 'Credenciales invalidas. Verifica correo y contrasena o crea una cuenta.'
    case 'auth/user-not-found':
      return 'No existe una cuenta con este correo.'
    case 'auth/email-already-in-use':
      return 'Ya existe una cuenta con este correo.'
    case 'auth/weak-password':
      return 'La contrasena debe tener al menos 6 caracteres.'
    case 'auth/invalid-email':
      return 'El correo electronico no es valido.'
    case 'auth/too-many-requests':
      return 'Demasiados intentos. Intenta mas tarde.'
    case 'auth/network-request-failed':
      return 'Error de red. Verifica tu conexion.'
    case 'permission-denied':
      return 'No pudimos completar la accion con los permisos actuales. Contacta al administrador del proyecto.'
    default:
      return 'Error de autenticacion. Intenta de nuevo.'
  }
}

function getErrorMessage(e: unknown): string {
  if (e && typeof e === 'object' && 'code' in e && typeof (e as { code: unknown }).code === 'string') {
    return translateFirebaseError((e as { code: string }).code)
  }
  return e instanceof Error ? e.message : 'Error desconocido.'
}

function mapUser(firebaseUser: FirebaseUser, profile?: UserProfile | null): User {
  const email = firebaseUser.email ?? null
  const profileName = profile?.annotator_code || profile?.full_name
  const displayName = profileName?.trim() || firebaseUser.displayName?.trim() || null
  return {
    uid: firebaseUser.uid,
    email,
    emailVerified: firebaseUser.emailVerified,
    username: displayName ?? (email ? email.split('@')[0] : firebaseUser.uid.slice(0, 8)),
  }
}

function resolveAccessStatus(user: User | null, profile: UserProfile | null): AccessStatus {
  if (!user || !profile) return 'profile_missing'
  if (profile.status === 'suspended') return 'suspended'
  if (!user.emailVerified || !profile.email_verified) return 'email_unverified'
  if (profile.status !== 'active') return 'pending_approval'
  if (!profile.training_completed || !profile.confidentiality_agreement) return 'training_pending'
  return 'allowed'
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [profileErrorStatus, setProfileErrorStatus] = useState<AccessStatus | null>(null)

  const loadProfileForUser = async (firebaseUser: FirebaseUser) => {
    if (firebaseUser.emailVerified) {
      await firebaseUser.getIdToken(true)
    }
    const existingProfile = await ensureUserProfile(firebaseUser)
    try {
      await updateProfileLoginState(firebaseUser)
    } catch (e) {
      console.warn('No se pudo actualizar last_login del perfil.', e)
    }

    const hydratedProfile: UserProfile = {
      ...existingProfile,
      email: firebaseUser.email ?? existingProfile.email,
      email_verified: firebaseUser.emailVerified,
    }
    const mappedUser = mapUser(firebaseUser, hydratedProfile)
    setProfile(hydratedProfile)
    setUser(mappedUser)
    setProfileErrorStatus(null)
    return { user: mappedUser, profile: hydratedProfile }
  }

  useEffect(() => {
    let cancelled = false
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true)
      setError(null)
      try {
        if (!firebaseUser) {
          if (!cancelled) {
            setUser(null)
            setProfile(null)
            setProfileErrorStatus(null)
          }
          return
        }
        const result = await loadProfileForUser(firebaseUser)
        if (cancelled) return
        setUser(result.user)
        setProfile(result.profile)
      } catch (e) {
        if (!cancelled) {
          setUser(firebaseUser ? mapUser(firebaseUser) : null)
          setProfile(null)
          if (isFirestorePermissionError(e)) {
            setProfileErrorStatus('profile_creation_denied')
          } else if (isFirestoreNetworkError(e)) {
            setProfileErrorStatus('network_error')
          } else {
            setProfileErrorStatus('unknown_error')
          }
          setError(getErrorMessage(e))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })
    return () => {
      cancelled = true
      unsub()
    }
  }, [])

  const login = async (email: string, password: string) => {
    setError(null)
    try {
      const creds = await signInWithEmailAndPassword(auth, email, password)
      const result = await loadProfileForUser(creds.user)
      setProfileErrorStatus(null)
      return result.user
    } catch (e) {
      const msg = getErrorMessage(e)
      setError(msg)
      throw new Error(msg)
    }
  }

  const register = async (email: string, password: string, input: RegistrationProfileInput) => {
    setError(null)
    try {
      const creds = await createUserWithEmailAndPassword(auth, email, password)
      await updateProfile(creds.user, { displayName: input.fullName.trim() })
      await createPendingUserProfile(creds.user, input)
      await sendEmailVerification(creds.user)
      const mapped = mapUser(creds.user, {
        uid: creds.user.uid,
        full_name: input.fullName.trim(),
        email: creds.user.email ?? null,
        institution: input.institution.trim(),
        role: 'annotator',
        annotator_code: '',
        status: 'pending',
        email_verified: creds.user.emailVerified,
        training_completed: false,
        confidentiality_agreement: false,
      })
      setUser(mapped)
      setProfile({
        uid: creds.user.uid,
        full_name: input.fullName.trim(),
        email: creds.user.email ?? null,
        institution: input.institution.trim(),
        role: 'annotator',
        annotator_code: '',
        status: 'pending',
        email_verified: creds.user.emailVerified,
        training_completed: false,
        confidentiality_agreement: false,
      })
      setProfileErrorStatus(null)
      return mapped
    } catch (e) {
      const msg = getErrorMessage(e)
      setError(msg)
      throw new Error(msg)
    }
  }

  const resetPassword = async (email: string) => {
    setError(null)
    try {
      await sendPasswordResetEmail(auth, email)
    } catch (e) {
      const msg = getErrorMessage(e)
      setError(msg)
      throw new Error(msg)
    }
  }

  const refreshVerification = async () => {
    setError(null)
    const current = auth.currentUser
    if (!current) return null
    try {
      await reload(current)
      if (current.emailVerified) {
        await current.getIdToken(true)
      }
      const result = await loadProfileForUser(current)
      return result.user
    } catch (e) {
      const msg = getErrorMessage(e)
      setError(msg)
      throw new Error(msg)
    }
  }

  const refreshProfile = async () => {
    setError(null)
    const current = auth.currentUser
    if (!current) return null
    try {
      const result = await loadProfileForUser(current)
      return result.profile
    } catch (e) {
      const msg = getErrorMessage(e)
      setError(msg)
      throw new Error(msg)
    }
  }

  const logout = async () => {
    await signOut(auth)
    setUser(null)
    setProfile(null)
    setProfileErrorStatus(null)
  }

  const clearError = () => setError(null)

  const accessStatus = useMemo(
    () => profileErrorStatus ?? resolveAccessStatus(user, profile),
    [profile, profileErrorStatus, user],
  )

  return {
    user,
    profile,
    accessStatus,
    loading,
    error,
    login,
    register,
    logout,
    resetPassword,
    refreshVerification,
    refreshProfile,
    clearError,
  }
}
