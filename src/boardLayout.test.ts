import { describe, expect, it } from 'vitest'
import { boardNoteWidthStep, fineSizeValue, heightStep, widgetHeightStep, widgetWidthStep } from './boardLayout'
import { boardCardBoardId, boardCardBoardMovePatch, boardCardLayout, boardCardLayoutPatch, boardCardMode, boardCardOrder, boardCardOrderPatch, nextBoardCardOrder } from './boardPlacement'
import type { Note } from './types'

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

  it('reads and updates either legacy board layout shape through one card abstraction', () => {
    const note: Note = { id: 'note', title: 'Note', content: { type: 'document', blocks: [] }, boardId: 'board-note', boardSize: 'medium', boardHeight: 'short', createdAt: 0, updatedAt: 0 }
    const widget: Note = { ...note, isWidget: true, boardId: 'legacy-board', widgetBoardId: 'board-widget', widgetSize: 'large', widgetHeight: 'tall' }

    expect(boardCardMode(note)).toBe('note')
    expect(boardCardLayout(note)).toEqual({ boardId: 'board-note', width: 4, height: 1 })
    expect(boardCardLayout(widget)).toEqual({ boardId: 'board-widget', width: 6, height: 5 })
    expect(boardCardLayoutPatch(note, { boardId: 'next', width: 5, height: 2 })).toEqual({ boardId: 'next', boardSize: 'step-5', boardHeight: 'step-2' })
    expect(boardCardLayoutPatch(widget, { boardId: 'next', width: 7, height: 4 })).toEqual({ widgetBoardId: 'next', widgetSize: 'step-7', widgetHeight: 'step-4' })
    expect(boardCardBoardId({ ...widget, widgetBoardId: undefined })).toBe('legacy-board')
    expect(widget.boardId).toBe('legacy-board')
    expect(boardCardOrder(note)).toBe(note.createdAt)
    expect(boardCardOrder({ ...widget, widgetOrder: 4 })).toBe(4)
    expect(boardCardOrderPatch(2)).toEqual({ widgetOrder: 2 })
    expect(nextBoardCardOrder([note, { ...widget, widgetOrder: 7 }])).toBe(8)
    expect(boardCardBoardMovePatch(widget, 'board-widget', 'replacement')).toEqual({ widgetBoardId: 'replacement' })
    expect(boardCardBoardMovePatch(widget, 'legacy-board', 'replacement')).toEqual({ boardId: 'replacement' })
  })
})
