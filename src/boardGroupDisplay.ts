import type { BoardGroup, Note } from './types'

export const BOARD_OUTSIDE_DROP_ID = 'board:outside-groups'
const RESERVED_NO_GROUP_ID = '__no-group__'

export function visibleBoardGroups(activeGroups: readonly BoardGroup[]) {
  return activeGroups.filter((group) => !(group.id === RESERVED_NO_GROUP_ID && group.name === 'No group'))
}

export function createDisplayGroups(activeGroups: readonly BoardGroup[]) {
  const groups = visibleBoardGroups(activeGroups)
  const usedIds = new Set(groups.map((group) => group.id))
  let noGroupId = RESERVED_NO_GROUP_ID
  while (usedIds.has(noGroupId)) noGroupId = `${noGroupId}_`
  return { noGroupId, groups }
}

export function cardsForGroup(cards: readonly Note[], groupId: string, noGroupId: string) {
  return cards.filter((note) => groupId === noGroupId ? !note.groupId || note.groupId === noGroupId : note.groupId === groupId)
}

export function groupIdForDrop(overId: string | null, target: Note | undefined, noGroupId: string): string | undefined {
  if (!overId) return undefined
  if (overId === BOARD_OUTSIDE_DROP_ID) return undefined
  if (overId.startsWith('group:')) {
    const groupId = overId.slice('group:'.length)
    return groupId === noGroupId ? undefined : groupId
  }
  return target?.groupId || undefined
}
