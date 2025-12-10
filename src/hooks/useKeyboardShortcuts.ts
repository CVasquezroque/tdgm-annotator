import { useEffect } from 'react'
import type { ActionDefinition } from '../types'

interface Options {
  onTogglePlay: () => void
  onMarkStart: () => void
  onMarkEnd: () => void
  onJumpBackward?: () => void
  onJumpForward?: () => void
  onJumpBackwardPrecise?: () => void
  onJumpForwardPrecise?: () => void
  onSaveSegment?: () => void
  onChooseAction?: (actionId: string) => void
  actions: ActionDefinition[]
}

export function useKeyboardShortcuts({
  onTogglePlay,
  onMarkStart,
  onMarkEnd,
  onJumpBackward,
  onJumpForward,
  onJumpBackwardPrecise,
  onJumpForwardPrecise,
  onSaveSegment,
  onChooseAction,
  actions,
}: Options) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return
      if (e.key === ' ') {
        e.preventDefault()
        onTogglePlay()
      } else if (e.key.toLowerCase() === 'a') {
        e.preventDefault()
        onMarkStart()
      } else if (e.key.toLowerCase() === 'd') {
        e.preventDefault()
        onMarkEnd()
      } else if (e.key.toLowerCase() === 's') {
        e.preventDefault()
        onSaveSegment?.()
      } else if (e.key === 'ArrowLeft') {
        if (e.altKey) {
          onJumpBackwardPrecise?.()
        } else {
          onJumpBackward?.()
        }
      } else if (e.key === 'ArrowRight') {
        if (e.altKey) {
          onJumpForwardPrecise?.()
        } else {
          onJumpForward?.()
        }
      } else if (onChooseAction) {
        const match = actions.find((a) => a.shortKey === e.key.toLowerCase())
        if (match) {
          e.preventDefault()
          onChooseAction(match.id)
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [
    actions,
    onChooseAction,
    onJumpBackward,
    onJumpBackwardPrecise,
    onJumpForward,
    onJumpForwardPrecise,
    onMarkEnd,
    onMarkStart,
    onSaveSegment,
    onTogglePlay,
  ])
}

