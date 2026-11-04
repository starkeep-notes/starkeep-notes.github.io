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
  it('hides the legacy reserved No group placeholder, whether empty or populated', () => {
    const placeholder = { ...group('__no-group__'), name: 'No group' }
    const realEmptyGroup = { ...group('real-group'), name: 'No group' }

    expect(visibleBoardGroups([placeholder, realEmptyGroup])).toEqual([realEmptyGroup])
    expect(visibleBoardGroups([placeholder])).toEqual([])
    expect(visibleBoardGroups([{ ...placeholder, name: 'Projects' }])).toEqual([{ ...placeholder, name: 'Projects' }])
    const { noGroupId } = createDisplayGroups([placeholder])
    expect(cardsForGroup([widget('legacy-unassigned', placeholder.id)], noGroupId, noGroupId)).toEqual([widget('legacy-unassigned', placeholder.id)])
  })

  it('uses a no-group sentinel without rendering it as a group', () => {
    const namedGroup = group('__no-group__')
    const { groups, noGroupId } = createDisplayGroups([namedGroup])

    expect(groups).toEqual([namedGroup])
    expect(noGroupId).not.toBe(namedGroup.id)
  })

  it('does not add a no-group heading beside a user-named No group', () => {
    const namedGroup = { ...group('real-id'), name: 'No group' }
    const { groups } = createDisplayGroups([namedGroup])

    expect(groups).toEqual([namedGroup])
  })

  it('keeps ungrouped cards outside groups when there are no named groups', () => {
    const { groups, noGroupId } = createDisplayGroups([])
    const ungrouped = widget('ungrouped')

    expect(groups).toHaveLength(0)
    expect(cardsForGroup([ungrouped], noGroupId, noGroupId)).toEqual([ungrouped])
  })

  it('clears group assignment when a card is dropped outside any rendered group', () => {
    expect(groupIdForDrop(null, undefined, 'synthetic-no-group')).toBeUndefined()
    expect(groupIdForDrop('group:synthetic-no-group', undefined, 'synthetic-no-group')).toBeUndefined()
  })

  it('assigns a drop to the real group represented by its target', () => {
    expect(groupIdForDrop('group:projects', undefined, 'synthetic-no-group')).toBe('projects')
    expect(groupIdForDrop('target-card', widget('target-card', 'projects'), 'synthetic-no-group')).toBe('projects')
    expect(groupIdForDrop('board:outside-groups', undefined, 'synthetic-no-group')).toBeUndefined()
  })

  it('assigns ungrouped widgets to exactly the synthetic group', () => {
    const namedGroup = group('__no-group__')
    const { groups, noGroupId } = createDisplayGroups([namedGroup])
    const ungrouped = widget('ungrouped')
    const grouped = widget('grouped', namedGroup.id)
    const widgets = [ungrouped, grouped]

    expect(groups.flatMap((item) => cardsForGroup(widgets, item.id, noGroupId))).toEqual([grouped])
    expect(cardsForGroup(widgets, noGroupId, noGroupId)).toEqual([ungrouped])
  })

  it('places note and widget modes in the same named groups and outer space', () => {
    const projects = group('projects')
    const { groups, noGroupId } = createDisplayGroups([projects])
    const note = { ...widget('note', projects.id), isWidget: false }
    const ungroupedNote = { ...widget('untitled-note'), isWidget: false }
    const ungroupedWidget = widget('untitled-widget')
    const cards = [note, ungroupedNote, ungroupedWidget]

    expect(cardsForGroup(cards, projects.id, noGroupId)).toEqual([note])
    expect(cardsForGroup(cards, noGroupId, noGroupId)).toEqual([ungroupedNote, ungroupedWidget])
    const renderedCards = [...groups.flatMap((item) => cardsForGroup(cards, item.id, noGroupId)), ...cardsForGroup(cards, noGroupId, noGroupId)]
    expect(renderedCards).toHaveLength(cards.length)
    expect(groupIdForDrop('note', note, noGroupId)).toBe(projects.id)
  })
})
