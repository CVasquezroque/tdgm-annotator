export type ActionId =
  | 'run'
  | 'gallop'
  | 'hop'
  | 'skip'
  | 'horizontal_jump'
  | 'slide'
  | 'strike_two_hands'
  | 'strike_one_hand'
  | 'dribble_one_hand'
  | 'catch_two_hands'
  | 'kick'
  | 'overhand_throw'
  | 'underhand_throw'

export interface ActionDefinition {
  id: ActionId
  label: string
  color: string
  shortKey?: string
}

export interface Segment {
  id: string
  action: ActionId
  startSec: number
  endSec: number
  repetitionId?: string
  annotatorId?: string
  notes?: string
}

export interface VideoMeta {
  fileName: string
  filePath: string
  duration: number
}

