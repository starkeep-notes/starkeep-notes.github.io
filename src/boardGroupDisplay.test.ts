import { describe, expect, it } from 'vitest'
import type { BoardGroup, Note } from './types'
import { cardsForGroup, createDisplayGroups, groupIdForDrop, visibleBoardGroups } from './boardGroupDisplay'

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
    expect(groups.flatMap((item) => cardsForGroup([ungrouped], item.id, noGroupId))).toEqual([ungrouped])
  })

  it('clears group assignment when a card is dropped outside any rendered group', () => {
    expect(groupIdForDrop(null, undefined, 'synthetic-no-group')).toBeUndefined()
    expect(groupIdForDrop('group:synthetic-no-group', undefined, 'synthetic-no-group')).toBeUndefined()
  })

  it('assigns a drop to the real group represented by its target', () => {
    expect(groupIdForDrop('group:projects', undefined, 'synthetic-no-group')).toBe('projects')
    expect(groupIdForDrop('target-card', widget('target-card', 'projects'), 'synthetic-no-group')).toBe('projects')
  })

  it('assigns ungrouped widgets to exactly the synthetic group', () => {
    const namedGroup = group('__no-group__')
    const { groups, noGroupId } = createDisplayGroups([namedGroup], 'board-1')
    const ungrouped = widget('ungrouped')
    const grouped = widget('grouped', namedGroup.id)
    const widgets = [ungrouped, grouped]

    expect(groups.flatMap((item) => cardsForGroup(widgets, item.id, noGroupId))).toEqual([grouped, ungrouped])
    expect(cardsForGroup(widgets, noGroupId, noGroupId)).toEqual([ungrouped])
  })

  it('places note and widget modes in the same persisted and synthetic groups', () => {
    const projects = group('projects')
    const { groups, noGroupId } = createDisplayGroups([projects], 'board-1')
    const note = { ...widget('note', projects.id), isWidget: false }
    const ungroupedNote = { ...widget('untitled-note'), isWidget: false }
    const ungroupedWidget = widget('untitled-widget')
    const cards = [note, ungroupedNote, ungroupedWidget]

    expect(cardsForGroup(cards, projects.id, noGroupId)).toEqual([note])
    expect(cardsForGroup(cards, noGroupId, noGroupId)).toEqual([ungroupedNote, ungroupedWidget])
    expect(groups.flatMap((item) => cardsForGroup(cards, item.id, noGroupId))).toHaveLength(cards.length)
    expect(groupIdForDrop('note', note, noGroupId)).toBe(projects.id)
  })
})
