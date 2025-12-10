import { useEffect, useState } from 'react'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User as FirebaseUser,
} from 'firebase/auth'
import { auth } from '../firebase'

export interface User {
  uid: string
  username: string
  email: string | null
}

function translateFirebaseError(code: string): string {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
      return 'Credenciales inválidas. Verifica correo y contraseña o crea una cuenta.'
    case 'auth/user-not-found':
      return 'No existe una cuenta con este correo.'
    case 'auth/email-already-in-use':
      return 'Ya existe una cuenta con este correo.'
    case 'auth/weak-password':
      return 'La contraseña debe tener al menos 6 caracteres.'
    case 'auth/invalid-email':
      return 'El correo electrónico no es válido.'
    case 'auth/too-many-requests':
      return 'Demasiados intentos. Intenta más tarde.'
    case 'auth/network-request-failed':
      return 'Error de red. Verifica tu conexión.'
    default:
      return 'Error de autenticación. Intenta de nuevo.'
  }
}

function getErrorMessage(e: unknown): string {
  if (e && typeof e === 'object' && 'code' in e && typeof (e as { code: unknown }).code === 'string') {
    return translateFirebaseError((e as { code: string }).code)
  }
  return e instanceof Error ? e.message : 'Error desconocido.'
}

function mapUser(firebaseUser: FirebaseUser): User {
  const email = firebaseUser.email ?? null
  const displayName = firebaseUser.displayName?.trim() || null
  return {
    uid: firebaseUser.uid,
    email,
    username: displayName ?? (email ? email.split('@')[0] : firebaseUser.uid.slice(0, 8)),
  }
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u ? mapUser(u) : null)
      setLoading(false)
    })
    return () => unsub()
  }, [])

  const login = async (email: string, password: string) => {
    setError(null)
    try {
      const creds = await signInWithEmailAndPassword(auth, email, password)
      const mapped = mapUser(creds.user)
      setUser(mapped)
      return mapped
    } catch (e) {
      const msg = getErrorMessage(e)
      setError(msg)
      throw new Error(msg)
    }
  }

  const register = async (email: string, password: string, username: string) => {
    setError(null)
    try {
      const creds = await createUserWithEmailAndPassword(auth, email, password)
      if (username.trim()) {
        await updateProfile(creds.user, { displayName: username.trim() })
      }
      const mapped = mapUser(creds.user)
      setUser(mapped)
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

  const logout = async () => {
    await signOut(auth)
    setUser(null)
  }

  const clearError = () => setError(null)

  return { user, loading, error, login, register, logout, resetPassword, clearError }
}

