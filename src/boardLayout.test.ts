import { describe, expect, it } from 'vitest'
import { boardNoteWidthStep, fineSizeValue, heightStep, widgetHeightStep, widgetWidthStep } from './boardLayout'

describe('board layout resize steps', () => {
  it('maps legacy note and widget widths to equivalent steps', () => {
    expect(['tiny', 'small', 'medium', 'large'].map((size) => boardNoteWidthStep(size as 'tiny' | 'small' | 'medium' | 'large'))).toEqual([2, 2, 4, 6])
    expect(['small', 'medium', 'large', 'wide'].map((size) => widgetWidthStep(size as 'small' | 'medium' | 'large' | 'wide'))).toEqual([2, 4, 6, 6])
  })

  it('keeps legacy heights and exposes finer five-step sizing', () => {
    expect(heightStep('short')).toBe(1)
    expect(heightStep('medium')).toBe(3)
    expect(heightStep('tall')).toBe(5)
    expect(widgetHeightStep('medium')).toBe(2)
    expect(widgetHeightStep('tall')).toBe(5)
    expect([1, 2, 3, 4, 5].map(fineSizeValue)).toEqual(['step-1', 'step-2', 'step-3', 'step-4', 'step-5'])
  })

  it('falls back safely for unexpected legacy numeric size values', () => {
    expect(boardNoteWidthStep(2 as never)).toBe(2)
    expect(widgetWidthStep(2 as never)).toBe(4)
    expect(heightStep(2 as never)).toBe(3)
    expect(widgetHeightStep(2 as never)).toBe(2)
  })
})
