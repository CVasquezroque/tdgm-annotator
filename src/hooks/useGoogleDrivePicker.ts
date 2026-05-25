interface PickerResult {
  id: string
  name: string
  url: string
  mimeType: string
}

const DISABLED_MESSAGE =
  'La carga de videos desde Google Drive esta deshabilitada para este piloto. Usa un archivo local o una carpeta sincronizada en este dispositivo.'

// Phase 1 privacy note: this hook is intentionally disabled for video playback.
// Sensitive pediatric videos must remain local and must not be downloaded from Drive through fetch/blob flows.
export function useGoogleDrivePicker() {
  const openPicker = async (): Promise<PickerResult | null> => null
  const getVideoStream = async (): Promise<string | null> => null

  return {
    isLoaded: false,
    isLoading: false,
    isConfigured: false,
    error: DISABLED_MESSAGE,
    openPicker,
    getVideoStream,
    clearError: () => undefined,
  }
}
