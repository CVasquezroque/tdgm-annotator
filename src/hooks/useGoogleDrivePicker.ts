import { useEffect, useState, useCallback, useRef } from 'react'

declare global {
  interface Window {
    gapi: any
    google: any
    pickerApiLoaded?: boolean
    gisLoaded?: boolean
  }
}

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY
const APP_ID = import.meta.env.VITE_GOOGLE_APP_ID
const SCOPES = 'https://www.googleapis.com/auth/drive.readonly'

interface PickerResult {
  id: string
  name: string
  url: string
  mimeType: string
}

export function useGoogleDrivePicker() {
  const [isLoaded, setIsLoaded] = useState(false)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const tokenClientRef = useRef<any>(null)

  // Cargar scripts
  useEffect(() => {
    const loadScript = (src: string) =>
      new Promise<void>((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) return resolve()
        const s = document.createElement('script')
        s.src = src
        s.async = true
        s.defer = true
        s.onload = () => resolve()
        s.onerror = () => reject(new Error(`Failed to load ${src}`))
        document.head.appendChild(s)
      })

    const init = async () => {
      try {
        await loadScript('https://apis.google.com/js/api.js')
        await new Promise<void>((r) => window.gapi.load('picker', () => { window.pickerApiLoaded = true; r() }))
        await loadScript('https://accounts.google.com/gsi/client')
        window.gisLoaded = true
        setIsLoaded(true)
      } catch (err) {
        setError('Error cargando Google APIs')
        console.error(err)
      }
    }

    if (CLIENT_ID && API_KEY && APP_ID) init()
  }, [])

  const requestToken = useCallback(
    (prompt: 'consent' | '' = ''): Promise<string | null> =>
      new Promise((resolve) => {
        if (!window.google?.accounts?.oauth2) {
          setError('No se pudo inicializar OAuth')
          resolve(null)
          return
        }
        if (!tokenClientRef.current) {
          tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPES,
            callback: (response: any) => {
              if (response?.access_token) {
                setAccessToken(response.access_token)
                resolve(response.access_token)
              } else {
                setError(`Error de autenticación: ${response?.error ?? 'desconocido'}`)
                resolve(null)
              }
            },
          })
        }
        tokenClientRef.current.requestAccessToken({ prompt })
      }),
    []
  )

  const openPicker = useCallback((): Promise<PickerResult | null> => {
    return new Promise(async (resolve) => {
      if (!isLoaded) {
        setError('Google APIs aún no cargadas')
        resolve(null)
        return
      }
      setError(null)

      const token = accessToken ?? (await requestToken('consent'))
      if (!token) {
        resolve(null)
        return
      }

      const view = new window.google.picker.DocsView()
        .setIncludeFolders(true)
        .setMimeTypes('video/mp4,video/webm,video/quicktime,video/x-msvideo,video/x-matroska,video/ogg')
        .setMode(window.google.picker.DocsViewMode.LIST)

      const picker = new window.google.picker.PickerBuilder()
        .addView(view)
        .setOAuthToken(token)
        .setDeveloperKey(API_KEY)
        .setAppId(APP_ID)
        .setTitle('Selecciona un video de Google Drive')
        .setLocale('es')
        .setCallback((data: any) => {
          if (data.action === window.google.picker.Action.PICKED) {
            const file = data.docs[0]
            resolve({ id: file.id, name: file.name, url: file.url, mimeType: file.mimeType })
          } else if (data.action === window.google.picker.Action.CANCEL) {
            resolve(null)
          }
        })
        .build()

      picker.setVisible(true)
    })
  }, [isLoaded, accessToken, requestToken])

  const getVideoStream = useCallback(
    async (fileId: string): Promise<string | null> => {
      let token = accessToken
      if (!token) {
        token = await requestToken('')
        if (!token) {
          setError('No hay sesión de Google activa')
          return null
        }
      }

      setIsLoading(true)
      setError(null)
      try {
        const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!response.ok) {
          if (response.status === 403) throw new Error('No tienes permisos para este archivo.')
          if (response.status === 404) throw new Error('Archivo no encontrado.')
          throw new Error(`Error ${response.status}: ${response.statusText}`)
        }
        const blob = await response.blob()
        return URL.createObjectURL(blob)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error descargando video.'
        setError(msg)
        console.error(err)
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [accessToken, requestToken]
  )

  const isConfigured = Boolean(CLIENT_ID && API_KEY && APP_ID)

  return { isLoaded, isLoading, isConfigured, error, openPicker, getVideoStream, clearError: () => setError(null) }
}
