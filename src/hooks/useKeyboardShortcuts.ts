import { useEffect } from 'react'
import type { ActionDefinition } from '../types'

interface Options {
  onTogglePlay: () => void
  onMarkStart: () => void
  onMarkEnd: () => void
  onJumpBackward?: () => void
  onJumpForward?: () => void
  onChooseAction?: (actionId: string) => void
  actions: ActionDefinition[]
}

export function useKeyboardShortcuts({
  onTogglePlay,
  onMarkStart,
  onMarkEnd,
  onJumpBackward,
  onJumpForward,
  onChooseAction,
  actions,
}: Options) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return
      if (e.key === ' ') {
        e.preventDefault()
        onTogglePlay()
      } else if (e.key === '[') {
        e.preventDefault()
        onMarkStart()
      } else if (e.key === ']') {
        e.preventDefault()
        onMarkEnd()
      } else if (e.key === 'ArrowLeft') {
        onJumpBackward?.()
      } else if (e.key === 'ArrowRight') {
        onJumpForward?.()
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
  }, [actions, onChooseAction, onJumpBackward, onJumpForward, onMarkEnd, onMarkStart, onTogglePlay])
}

