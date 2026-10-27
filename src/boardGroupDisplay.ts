import type { BoardGroup, Note } from './types'

const RESERVED_NO_GROUP_ID = '__no-group__'

export function visibleBoardGroups(activeGroups: readonly BoardGroup[], widgets: readonly Note[]) {
  return activeGroups.filter((group) => !(group.id === RESERVED_NO_GROUP_ID && group.name === 'No group' && !widgets.some((widget) => widget.groupId === group.id)))
}

export function createDisplayGroups(activeGroups: readonly BoardGroup[], boardId: string) {
  const usedIds = new Set(activeGroups.map((group) => group.id))
  let noGroupId = RESERVED_NO_GROUP_ID
  while (usedIds.has(noGroupId)) noGroupId = `${noGroupId}_`

  let noGroupName = 'No group'
  let suffix = 1
  while (activeGroups.some((group) => group.name.trim().toLowerCase() === noGroupName.toLowerCase())) {
    noGroupName = suffix === 1 ? 'No group (unassigned)' : `No group (unassigned ${suffix})`
    suffix += 1
  }

  const noGroup: BoardGroup = {
    id: noGroupId,
    boardId,
    name: noGroupName,
    order: Number.MAX_SAFE_INTEGER,
    columnSpan: 1,
    verticalSize: 'normal',
    collapsed: false,
  }
  return { noGroupId, groups: [...activeGroups, noGroup] }
}

export function widgetsForGroup(widgets: readonly Note[], groupId: string, noGroupId: string) {
  return widgets.filter((note) => groupId === noGroupId ? !note.groupId : note.groupId === groupId)
}

export function groupIdForDrop(overId: string | null, target: Note | undefined, noGroupId: string): string | undefined {
  if (!overId) return undefined
  if (overId.startsWith('group:')) {
    const groupId = overId.slice('group:'.length)
    return groupId === noGroupId ? undefined : groupId
  }
  return target?.groupId || undefined
}
