import { describe, expect, it } from 'vitest'
import { BACKUP_FORMAT, BACKUP_VERSION, validateBackupPayload } from './portability'

const backup = (version: number, noteLayout: Record<string, string> = {}) => ({
  format: BACKUP_FORMAT,
  version,
  exportedAt: '2026-10-27T00:00:00.000Z',
  notes: [{ id: 'note-1', title: 'A note', content: { type: 'document', blocks: [] }, createdAt: 1, updatedAt: 1, ...noteLayout }],
  collections: [],
  webReferences: [],
  boards: [],
  boardGroups: [],
})

describe('backup layout compatibility', () => {
  it('accepts existing version 6 backups', () => {
    expect(validateBackupPayload(backup(6)).version).toBe(6)
  })

  it('accepts and retains finer note and widget size steps in the current format', () => {
    const payload = validateBackupPayload(backup(BACKUP_VERSION, {
      boardSize: 'step-6',
      boardHeight: 'step-5',
      widgetSize: 'step-8',
      widgetHeight: 'step-4',
    }))
    expect(payload.notes[0]).toMatchObject({ boardSize: 'step-6', boardHeight: 'step-5', widgetSize: 'step-8', widgetHeight: 'step-4' })
  })

  it('rejects finer size values outside each field range', () => {
    expect(() => validateBackupPayload(backup(BACKUP_VERSION, { boardSize: 'step-7' }))).toThrow('invalid board note width')
    expect(() => validateBackupPayload(backup(BACKUP_VERSION, { widgetHeight: 'step-6' }))).toThrow('invalid widget height')
  })
})
