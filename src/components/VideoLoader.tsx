import type { ChangeEvent } from 'react'

interface Props {
  onVideoSelected: (file: File) => void
}

export function VideoLoader({ onVideoSelected }: Props) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onVideoSelected(file)
      e.target.value = ''
    }
  }

  return (
    <div className="video-loader-group">
      <label className="file-picker">
        <img className="icon" src="/icon-upload.png" alt="" />
        <span>Cargar video local</span>
        <input type="file" accept="video/*" onChange={handleChange} />
      </label>
    </div>
  )
}
