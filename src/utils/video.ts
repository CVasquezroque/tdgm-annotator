export function codedFilenameFromFile(file: File) {
  const baseName = file.name.split(/[\\/]/).pop()?.trim() || `LOCAL-${Date.now().toString(36).toUpperCase()}`
  const cleaned = baseName
    .split('')
    .filter((char) => char >= ' ' && char !== '\u007f')
    .join('')
    .replace(/[\\/]/g, '_')
    .replace(/[^A-Za-z0-9._ -]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)

  return cleaned || `LOCAL-${Date.now().toString(36).toUpperCase()}`
}
