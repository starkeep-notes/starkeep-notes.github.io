import { describe, expect, it } from 'vitest'
import type { BoardGroup, Note } from './types'
import { createDisplayGroups, visibleBoardGroups, widgetsForGroup } from './boardGroupDisplay'

const group = (id: string): BoardGroup => ({
  id,
  boardId: 'board-1',
  name: 'Named group',
  order: 0,
  columnSpan: 1,
  verticalSize: 'normal',
  collapsed: false,
})

const widget = (id: string, groupId?: string): Note => ({
  id,
  title: id,
  content: { type: 'document', blocks: [] },
  groupId,
  isWidget: true,
  createdAt: 0,
  updatedAt: 0,
})

describe('board group display', () => {
  it('omits only an empty reserved-ID placeholder without deleting stored groups', () => {
    const placeholder = { ...group('__no-group__'), name: 'No group' }
    const realEmptyGroup = { ...group('real-group'), name: 'No group' }
    const withPlaceholder = visibleBoardGroups([placeholder, realEmptyGroup], [])

    expect(withPlaceholder).toEqual([realEmptyGroup])
    expect(visibleBoardGroups([placeholder], [widget('assigned', placeholder.id)])).toEqual([placeholder])
    expect(visibleBoardGroups([{ ...placeholder, name: 'Projects' }], [])).toEqual([{ ...placeholder, name: 'Projects' }])
  })

  it('keeps the synthetic no-group key distinct from persisted group keys', () => {
    const namedGroup = group('__no-group__')
    const { groups, noGroupId } = createDisplayGroups([namedGroup], 'board-1')

    expect(groups).toHaveLength(2)
    expect(new Set(groups.map((item) => item.id)).size).toBe(groups.length)
    expect(noGroupId).not.toBe(namedGroup.id)
    expect(groups.map((item) => `widget-group-${item.id}`)).toEqual([
      'widget-group-__no-group__',
      `widget-group-${noGroupId}`,
    ])
  })

  it('gives the unassigned region a distinct accessible heading when a group is also named No group', () => {
    const namedGroup = { ...group('real-id'), name: 'No group' }
    const { groups } = createDisplayGroups([namedGroup], 'board-1')

    expect(groups.map((item) => item.name)).toEqual(['No group', 'No group (unassigned)'])
    expect(new Set(groups.map((item) => item.name)).size).toBe(groups.length)
  })

  it('renders an ungrouped widget once when there are no named groups', () => {
    const { groups, noGroupId } = createDisplayGroups([], 'board-1')
    const ungrouped = widget('ungrouped')

    expect(groups).toHaveLength(1)
    expect(groups.flatMap((item) => widgetsForGroup([ungrouped], item.id, noGroupId))).toEqual([ungrouped])
  })

  it('assigns ungrouped widgets to exactly the synthetic group', () => {
    const namedGroup = group('__no-group__')
    const { groups, noGroupId } = createDisplayGroups([namedGroup], 'board-1')
    const ungrouped = widget('ungrouped')
    const grouped = widget('grouped', namedGroup.id)
    const widgets = [ungrouped, grouped]

    expect(groups.flatMap((item) => widgetsForGroup(widgets, item.id, noGroupId))).toEqual([grouped, ungrouped])
    expect(widgetsForGroup(widgets, noGroupId, noGroupId)).toEqual([ungrouped])
  })
})
