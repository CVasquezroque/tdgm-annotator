import type { ChangeEvent } from 'react'

interface Props {
  onVideoSelected: (file: File) => void
}

export function VideoLoader({ onVideoSelected }: Props) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onVideoSelected(file)
    }
  }

  return (
    <label className="file-picker">
      <img className="icon" src="/icon-upload.png" alt="" />
      <span>Seleccionar video local (MP4 u otro formato compatible)</span>
      <input type="file" accept="video/*" onChange={handleChange} />
    </label>
  )
}

