import { database } from './db'
import type { Note } from './types'

export const notesRepository = {
  async list(): Promise<Note[]> {
    const notes = await database.notes.toArray()
    return notes.sort((a, b) => b.updatedAt - a.updatedAt)
  },
  async add(note: Note): Promise<void> { await database.notes.add(note); window.dispatchEvent(new Event('starkeep-notes-changed')) },
    async save(note: Note): Promise<void> { await database.notes.put(note); window.dispatchEvent(new Event('starkeep-notes-changed')) },
    async trash(id: string): Promise<void> { await database.notes.update(id, { deletedAt: Date.now() }); window.dispatchEvent(new Event('starkeep-notes-changed')) },
    async restore(id: string): Promise<void> { await database.notes.update(id, { deletedAt: undefined }); window.dispatchEvent(new Event('starkeep-notes-changed')) },
}
