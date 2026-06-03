import { useEffect, useState } from 'react'

export function useLocalBooleanPreference(key: string, defaultValue: boolean) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key)
      return stored === null ? defaultValue : stored === 'true'
    } catch {
      return defaultValue
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(key, String(value))
    } catch {
      // Preferences are best-effort only.
    }
  }, [key, value])

  return [value, setValue] as const
}
