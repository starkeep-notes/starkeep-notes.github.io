import Dexie, { type EntityTable } from 'dexie'
import type { Board, BoardGroup, Collection, Note, WebReference } from './types'

export class StarkeepDatabase extends Dexie {
  notes!: EntityTable<Note, 'id'>
  collections!: EntityTable<Collection, 'id'>
  webReferences!: EntityTable<WebReference, 'id'>
  boards!: EntityTable<Board, 'id'>
  boardGroups!: EntityTable<BoardGroup, 'id'>

  constructor() {
    super('starkeep')
    this.version(1).stores({
      notes: 'id, updatedAt, collectionId, deletedAt',
      collections: 'id, parentId, updatedAt',
      webReferences: 'id, noteId, url',
    })
    this.version(2).stores({
      notes: 'id, updatedAt, collectionId, deletedAt, widgetBoardId, widgetGroup',
      collections: 'id, parentId, updatedAt',
      webReferences: 'id, noteId, url',
      boards: 'id, updatedAt',
    })
    this.version(3).stores({
      notes: 'id, updatedAt, collectionId, boardId, deletedAt, widgetBoardId, widgetGroup',
      collections: 'id, parentId, updatedAt',
      webReferences: 'id, noteId, url',
      boards: 'id, updatedAt',
    })
    this.version(4).stores({
      notes: 'id, updatedAt, collectionId, boardId, deletedAt, widgetBoardId, widgetGroup, groupId',
      collections: 'id, parentId, updatedAt',
      webReferences: 'id, noteId, url',
      boards: 'id, updatedAt',
      boardGroups: 'id, boardId, order',
    }).upgrade(async (transaction) => {
      const notes = transaction.table('notes') as EntityTable<Note, 'id'>
      const groups = transaction.table('boardGroups') as EntityTable<BoardGroup, 'id'>
      const boards = await (transaction.table('boards') as EntityTable<Board, 'id'>).toArray()
      const allNotes = await notes.toArray()
      for (const board of boards) {
        const boardNotes = allNotes.filter((note) => (note.isWidget ? note.widgetBoardId : note.boardId) === board.id)
        const labels = [...new Set(boardNotes.map((note) => note.widgetGroup?.trim()).filter((label): label is string => Boolean(label)))]
        const fallback = labels.length ? [] : ['Ungrouped']
        const created = [...labels, ...fallback].map((name, order) => ({ id: crypto.randomUUID(), boardId: board.id, name, order, columnSpan: 1 as const, verticalSize: 'normal' as const, collapsed: false }))
        await groups.bulkAdd(created)
        const byName = new Map(created.map((group) => [group.name, group.id]))
        await Promise.all(boardNotes.map((note) => notes.update(note.id, { groupId: byName.get(note.widgetGroup?.trim() || 'Ungrouped') })))
      }
    })
    this.version(5).stores({
      notes: 'id, updatedAt, collectionId, boardId, deletedAt, widgetBoardId, widgetGroup, groupId',
      collections: 'id, parentId, updatedAt',
      webReferences: 'id, noteId, url',
      boards: 'id, updatedAt',
      boardGroups: 'id, boardId, order',
    })
    this.version(6).stores({
      notes: 'id, updatedAt, collectionId, boardId, deletedAt, widgetBoardId, widgetGroup, groupId',
      collections: 'id, parentId, updatedAt',
      webReferences: 'id, noteId, url',
      boards: 'id, updatedAt',
      boardGroups: 'id, boardId, order',
    }).upgrade(async (transaction) => {
      const notes = transaction.table('notes') as EntityTable<Note, 'id'>
      const groups = transaction.table('boardGroups') as EntityTable<BoardGroup, 'id'>
      const legacyUngrouped = new Set((await groups.toArray()).filter((group) => group.name.trim().toLowerCase() === 'ungrouped').map((group) => group.id))
      if (legacyUngrouped.size) await notes.toCollection().modify((note) => { if (note.groupId && legacyUngrouped.has(note.groupId)) note.groupId = undefined })
      await groups.toCollection().filter((group) => group.name.trim().toLowerCase() === 'ungrouped').delete()
    })
  }
}

export const database = new StarkeepDatabase()
