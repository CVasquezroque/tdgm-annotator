import type { ActionDefinition } from '../types'

export const TGMD_ACTIONS: ActionDefinition[] = [
  { id: 'run', label: 'Correr (Run)', color: '#2563eb', shortKey: '1' },
  { id: 'gallop', label: 'Galope (Gallop)', color: '#16a34a', shortKey: '2' },
  { id: 'hop', label: 'Saltar en un pie (Hop)', color: '#d946ef', shortKey: '3' },
  { id: 'skip', label: 'Salto indio (Skip)', color: '#f97316', shortKey: '4' },
  { id: 'horizontal_jump', label: 'Saltar con ambos pies (Horizontal jump)', color: '#0891b2', shortKey: '5' },
  { id: 'slide', label: 'Deslizarse (Slide)', color: '#7c3aed', shortKey: '6' },
  { id: 'strike_two_hands', label: 'Golpear con ambas manos (Strike two hands)', color: '#dc2626', shortKey: '7' },
  { id: 'strike_one_hand', label: 'Golpear con una mano (Strike one hand)', color: '#f59e0b', shortKey: '8' },
  { id: 'dribble_one_hand', label: 'Rebotar con una mano (Dribble one hand)', color: '#0ea5e9', shortKey: '9' },
  { id: 'catch_two_hands', label: 'Atrapar con ambas manos (Catch two hands)', color: '#84cc16', shortKey: '0' },
  { id: 'kick', label: 'Patear (Kick)', color: '#c026d3', shortKey: 'q' },
  { id: 'overhand_throw', label: 'Lanzar por encima (Overhand throw)', color: '#14b8a6', shortKey: 'w' },
  { id: 'underhand_throw', label: 'Lanzar por debajo (Underhand throw)', color: '#f43f5e', shortKey: 'e' },
]

export const ACTION_BY_ID = Object.fromEntries(TGMD_ACTIONS.map((a) => [a.id, a]))

