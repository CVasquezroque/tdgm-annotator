import type { ChangeEvent } from 'react'
import { useState } from 'react'
import { useGoogleDrivePicker } from '../hooks/useGoogleDrivePicker'

interface Props {
  onVideoSelected: (file: File) => void
  onVideoUrl?: (url: string, fileName: string) => void
}

export function VideoLoader({ onVideoSelected, onVideoUrl }: Props) {
  const { isLoaded, isLoading, isConfigured, error, openPicker, getVideoStream, clearError } = useGoogleDrivePicker()
  const [downloading, setDownloading] = useState(false)

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onVideoSelected(file)
    }
  }

  const handleDrivePick = async () => {
    if (!onVideoUrl) return
    
    clearError()
    try {
      const result = await openPicker()
      if (result) {
        setDownloading(true)
        const blobUrl = await getVideoStream(result.id)
        if (blobUrl) {
          onVideoUrl(blobUrl, result.name)
        }
        setDownloading(false)
      }
    } catch {
      setDownloading(false)
    }
  }

  const isButtonDisabled = !isLoaded || isLoading || downloading

  return (
    <div className="video-loader-group">
      <label className="file-picker">
        <img className="icon" src="/icon-upload.png" alt="" />
        <span>Video local</span>
        <input type="file" accept="video/*" onChange={handleChange} />
      </label>
      
      {isConfigured && (
        <button 
          className="drive-picker-btn"
          onClick={handleDrivePick}
          disabled={isButtonDisabled}
          title={!isLoaded ? 'Cargando Google Drive...' : 'Seleccionar de Google Drive'}
        >
          <svg className="icon drive-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M7.71 3.5L1.15 15l3.43 5.95L17.95 3.5H7.71m4.29 0l8.56 14.84L17.14 15 12.86 7.73 16.14 3.5H12m1.56 9l3.43 5.95L5.44 18.45l3.43-5.95h5.69"/>
          </svg>
          {downloading ? 'Descargando...' : isLoading ? 'Cargando...' : 'Google Drive'}
        </button>
      )}
      
      {error && <span className="loader-error">{error}</span>}
    </div>
  )
}
