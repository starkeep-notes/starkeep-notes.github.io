import type { FineSizeStep, Note } from './types'

export const NOTE_WIDTH_STEPS = [1, 2, 3, 4, 5, 6] as const
export const WIDGET_WIDTH_STEPS = [1, 2, 3, 4, 5, 6, 7, 8] as const
export const HEIGHT_STEPS = [1, 2, 3, 4, 5] as const

const stepNumber = (value: unknown, maximum: number, fallback: number) => {
  if (typeof value !== 'string') return fallback
  const match = value.match(/^step-([1-9])$/)
  if (!match) return fallback
  const step = Number(match[1])
  return step <= maximum ? step : fallback
}

export function boardNoteWidthStep(size: Note['boardSize']): number {
  if (size === 'tiny' || size === 'small' || size === undefined) return 2
  if (size === 'medium') return 4
  if (size === 'large') return 6
  return stepNumber(size, 6, 2)
}

export function widgetWidthStep(size: Note['widgetSize']): number {
  if (size === 'small') return 2
  if (size === 'medium' || size === undefined) return 4
  if (size === 'large' || size === 'wide') return 6
  return stepNumber(size, 8, 4)
}

export function heightStep(size: Note['boardHeight']): number {
  if (size === 'short') return 1
  if (size === 'medium' || size === undefined) return 3
  if (size === 'tall') return 5
  return stepNumber(size, 5, 3)
}

export function widgetHeightStep(size: Note['widgetHeight']): number {
  if (size === 'short') return 1
  if (size === 'medium') return 2
  if (size === 'tall') return 5
  if (size === undefined) return 2
  return stepNumber(size, 5, 2)
}

export const fineSizeValue = (step: number) => `step-${step}` as FineSizeStep
export const boardWidthValue = (step: number): NonNullable<Note['boardSize']> => fineSizeValue(step) as NonNullable<Note['boardSize']>
export const heightSizeValue = (step: number): NonNullable<Note['boardHeight']> => fineSizeValue(step) as NonNullable<Note['boardHeight']>
