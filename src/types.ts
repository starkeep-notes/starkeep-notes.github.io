import type { DocumentAst } from './widgetDocument'

export type FineSizeStep = 'step-1' | 'step-2' | 'step-3' | 'step-4' | 'step-5' | 'step-6' | 'step-7' | 'step-8'

/** Notes and widgets share one canonical JSON document AST in storage. */
export type NoteContent = DocumentAst

export type Note = {
  id: string
  title: string
  content: NoteContent
  collectionId?: string
  boardId?: string
  /** Legacy-persisted editor/presentation mode; widgets remain notes with the same identity. */
  isWidget?: boolean
  widgetStyle?: 'cream' | 'yellow' | 'blue' | 'green' | 'ink'
  widgetPinned?: boolean
  widgetHidden?: boolean
  widgetOrder?: number
  widgetSize?: 'small' | 'medium' | 'large' | 'wide' | FineSizeStep
  /** Persisted board-note width, expressed as a grid step. */
  boardSize?: 'tiny' | 'small' | 'medium' | 'large' | Exclude<FineSizeStep, 'step-7' | 'step-8'>
  /** Persisted card height. */
  boardHeight?: 'short' | 'medium' | 'tall' | Exclude<FineSizeStep, 'step-6' | 'step-7' | 'step-8'>
  widgetHeight?: 'short' | 'medium' | 'tall' | Exclude<FineSizeStep, 'step-6' | 'step-7' | 'step-8'>
  widgetBoardId?: string
  /** @deprecated legacy display label, migrated to groupId on database upgrade. */
  widgetGroup?: string
  groupId?: string
  createdAt: number
  updatedAt: number
  deletedAt?: number
}

export type Board = {
  id: string
  name: string
  createdAt: number
  updatedAt: number
}

export type BoardGroup = {
  id: string
  boardId: string
  name: string
  order: number
  columnSpan: 1 | 2 | 3 | 4
  verticalSize: 'compact' | 'normal' | 'tall'
  collapsed: boolean
}

export type Collection = {
  id: string
  name: string
  parentId?: string
  createdAt: number
  updatedAt: number
}

export type WebReference = {
  id: string
  noteId: string
  url: string
  title?: string
  selectedText?: string
}
