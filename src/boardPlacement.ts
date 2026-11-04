import type { Note } from './types'
import { boardNoteWidthStep, fineSizeValue, heightSizeValue, heightStep, widgetHeightStep, widgetWidthStep } from './boardLayout'

export type BoardCardMode = 'note' | 'widget'
export type BoardCardLayout = { boardId?: string; width: number; height: number }

/** Read either historical placement field without rewriting the stored record. */
export function boardCardBoardId(note: Note): string | undefined {
  return note.isWidget ? note.widgetBoardId ?? note.boardId : note.boardId ?? note.widgetBoardId
}

export function boardCardMode(note: Note): BoardCardMode {
  return note.isWidget ? 'widget' : 'note'
}

/** Reassign only legacy board slots that point at the board being deleted. */
export function boardCardBoardMovePatch(note: Note, from: string, to: string): Partial<Note> {
  return {
    ...(note.boardId === from ? { boardId: to } : {}),
    ...(note.widgetBoardId === from ? { widgetBoardId: to } : {}),
  }
}

export function boardCardOrder(note: Note): number {
  return note.widgetOrder ?? note.createdAt
}

export function boardCardOrderPatch(order: number): Pick<Note, 'widgetOrder'> {
  return { widgetOrder: order }
}

export function nextBoardCardOrder(cards: readonly Note[]): number {
  return cards.reduce((highest, card) => Math.max(highest, boardCardOrder(card)), -1) + 1
}

export function boardCardLayout(note: Note): BoardCardLayout {
  return {
    boardId: boardCardBoardId(note),
    width: note.isWidget ? widgetWidthStep(note.widgetSize) : boardNoteWidthStep(note.boardSize),
    height: note.isWidget ? widgetHeightStep(note.widgetHeight) : heightStep(note.boardHeight),
  }
}

/** Update the active presentation's legacy field, leaving the other field intact. */
export function boardCardLayoutPatch(note: Note, layout: Partial<Pick<BoardCardLayout, 'boardId' | 'width' | 'height'>>): Partial<Note> {
  const patch: Partial<Note> = {}
  if ('boardId' in layout) {
    if (note.isWidget) patch.widgetBoardId = layout.boardId
    else patch.boardId = layout.boardId
  }
  if (layout.width !== undefined) {
    if (note.isWidget) patch.widgetSize = fineSizeValue(layout.width)
    else patch.boardSize = fineSizeValue(layout.width) as NonNullable<Note['boardSize']>
  }
  if (layout.height !== undefined) {
    if (note.isWidget) patch.widgetHeight = heightSizeValue(layout.height)
    else patch.boardHeight = heightSizeValue(layout.height)
  }
  return patch
}
