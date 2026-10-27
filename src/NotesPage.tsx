import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, pointerWithin, useDroppable, useSensor, useSensors, type CollisionDetection, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useNavigate, useParams } from 'react-router-dom'
import type { Board, BoardGroup, Collection, Note } from './types'
import { database } from './db'
import { notesRepository } from './notesRepository'
import { NoteEditor } from './NoteEditor'
import { serializeWidgetDocument } from './widgetDocument'
import { plainContent } from './editorDraft'
import { DocumentPreview } from './DocumentPreview'
import { cardsForGroup, createDisplayGroups, groupIdForDrop, visibleBoardGroups } from './boardGroupDisplay'
import { BoardCard } from './BoardCard'
import { ResizeEdgeHandle } from './ResizeEdgeHandle'
import { boardCardBoardId, boardCardBoardMovePatch, boardCardLayout, boardCardLayoutPatch, boardCardOrder, boardCardOrderPatch, nextBoardCardOrder } from './boardPlacement'

const now = () => Date.now()
const newId = () => crypto.randomUUID()
const preview = (content: Note['content']) => serializeWidgetDocument(content).trim() || 'Empty note'
const boardCollisionDetection: CollisionDetection = (args) => {
  if (!args.pointerCoordinates) return closestCenter(args)
  const collisions = pointerWithin(args)
  const cardCollisions = collisions.filter((collision) => !String(collision.id).startsWith('group:'))
  return cardCollisions.length ? cardCollisions : collisions
}

function GroupDropTarget({ groupId, name }: { groupId: string; name: string }) {
  const { isOver, setNodeRef } = useDroppable({ id: `group:${groupId}` })
  const setGroupRef = (element: HTMLDivElement | null) => setNodeRef(element?.closest<HTMLElement>('.board-widget-group') ?? element)
  return <div ref={setGroupRef} className={`group-drop-target ${isOver ? 'is-over' : ''}`} aria-label={`Drop card in ${name}`}><span>Drop here to move cards into {name}</span></div>
}


export function NotesPage({ showTrash = false, board = false, newNoteRequest = 0, onNewNoteHandled }: { showTrash?: boolean; board?: boolean; newNoteRequest?: number; onNewNoteHandled?: () => void }) {
  const { noteId } = useParams()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [collectionId, setCollectionId] = useState('')
  const [notes, setNotes] = useState<Note[]>([])
  const [collections, setCollections] = useState<Collection[]>([])
  const [boards, setBoards] = useState<Board[]>([])
  const [boardGroups, setBoardGroups] = useState<BoardGroup[]>([])
  const [groupName, setGroupName] = useState('')
  const [groupStatus, setGroupStatus] = useState('')
  const [boardsLoaded, setBoardsLoaded] = useState(false)
  const [activeBoardId, setActiveBoardId] = useState('')
  const [selectedCardId, setSelectedCardId] = useState('')
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [resizeTarget, setResizeTarget] = useState('')
  const [resizePreview, setResizePreview] = useState<Record<string, number>>({})
  const [boardSettingsOpen, setBoardSettingsOpen] = useState(false)
  const [boardSettingsMode, setBoardSettingsMode] = useState<'create' | 'manage'>('manage')
  const [boardName, setBoardName] = useState('')
  const [boardStatus, setBoardStatus] = useState('')
  const pendingRequest = useRef(0)
  const boardInitialization = useRef(false)
  const cardRefs = useRef(new Map<string, HTMLElement>())
  const groupRefs = useRef(new Map<string, HTMLElement>())
  const boardSettingsTriggerRef = useRef<HTMLButtonElement>(null)
  const previewResize = (key: string, value: number) => setResizePreview((current) => current[key] === value ? current : { ...current, [key]: value })
  const clearResizePreview = (key: string) => setResizePreview((current) => { const remaining = { ...current }; delete remaining[key]; return remaining })
  const resizeValue = (key: string, fallback: number) => resizePreview[key] ?? fallback
  useEffect(() => {
    const refresh = () => void Promise.all([notesRepository.list(), database.collections.toArray(), database.boards.toArray(), database.boardGroups.toArray()]).then(([loadedNotes, loadedCollections, loadedBoards, loadedGroups]) => { setNotes(loadedNotes); setCollections(loadedCollections); setBoardGroups(loadedGroups.sort((a, b) => a.order - b.order)); setBoards(loadedBoards.sort((a, b) => a.createdAt - b.createdAt)); setBoardsLoaded(true); setActiveBoardId((current) => current || loadedBoards[0]?.id || '') })
    refresh()
    window.addEventListener('starkeep-notes-changed', refresh)
    return () => window.removeEventListener('starkeep-notes-changed', refresh)
  }, [])
  useEffect(() => {
    if (!board || !boardsLoaded || boards.length || boardInitialization.current) return
    boardInitialization.current = true
    const timestamp = now()
    const personal: Board = { id: newId(), name: 'Personal', createdAt: timestamp, updatedAt: timestamp }
    void database.transaction('rw', database.boards, database.notes, async () => {
      await database.boards.add(personal)
      await database.notes.toCollection().modify((note) => {
        if (boardCardBoardId(note)) return
        if (note.isWidget) note.widgetBoardId = personal.id
        else note.boardId = personal.id
      })
    }).then(() => { setBoards([personal]); setBoardGroups([]); setActiveBoardId(personal.id); setNotes((current) => current.map((note) => boardCardBoardId(note) ? note : { ...note, ...boardCardLayoutPatch(note, { boardId: personal.id }), groupId: undefined })) })
  }, [board, boardsLoaded, boards.length, notes])
  useEffect(() => {
    if (!board || !boardsLoaded || boards.length === 0) return
    const boardId = boards[0].id
    const hasUnassignedItems = notes.some((note) => !boardCardBoardId(note))
    if (!hasUnassignedItems) return
    void database.notes.toCollection().modify((note) => {
      if (!boardCardBoardId(note)) {
        if (note.isWidget) note.widgetBoardId = boardId
        else note.boardId = boardId
      }
    }).then(() => setNotes((current) => current.map((note) => boardCardBoardId(note) ? note : { ...note, ...boardCardLayoutPatch(note, { boardId }) })))
  }, [board, boardsLoaded, boards, notes])
  useEffect(() => {
    if (!board || (!selectedCardId && !selectedGroupId && !resizeTarget)) return
    const clearSelection = () => { setSelectedCardId(''); setSelectedGroupId(''); setResizeTarget(''); setResizePreview({}) }
    const dismissOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Element) || !target.closest('.board-note-card, .board-widget-card, .board-widget-group')) clearSelection()
    }
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      const cardId = selectedCardId
      const groupId = selectedGroupId
      clearSelection()
      requestAnimationFrame(() => (cardId ? cardRefs.current.get(cardId) : groupId ? groupRefs.current.get(groupId) : undefined)?.focus())
    }
    document.addEventListener('pointerdown', dismissOnOutsidePointer)
    document.addEventListener('keydown', dismissOnEscape)
    return () => { document.removeEventListener('pointerdown', dismissOnOutsidePointer); document.removeEventListener('keydown', dismissOnEscape) }
  }, [board, selectedCardId, selectedGroupId, resizeTarget])
  useEffect(() => {
    if (!boardSettingsOpen) return
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setBoardSettingsOpen(false)
      requestAnimationFrame(() => boardSettingsTriggerRef.current?.focus())
    }
    document.addEventListener('keydown', dismissOnEscape)
    return () => document.removeEventListener('keydown', dismissOnEscape)
  }, [boardSettingsOpen])
  const selected = notes.find((note) => note.id === noteId && Boolean(note.deletedAt) === showTrash) ?? null
  const collectionNames = useMemo(() => new Map(collections.map((collection) => [collection.id, collection.name])), [collections])
  const filtered = useMemo(() => notes.filter((note) => Boolean(note.deletedAt) === showTrash && (!collectionId || note.collectionId === collectionId) && `${note.title} ${preview(note.content)} ${note.collectionId ? collectionNames.get(note.collectionId) ?? '' : ''}`.toLowerCase().includes(query.toLowerCase())), [notes, query, showTrash, collectionId, collectionNames])
  const activeBoard = boards.find((item) => item.id === activeBoardId)
  const allBoardCards = useMemo(() => notes.filter((note) => !note.deletedAt && (!note.isWidget || !note.widgetHidden) && boardCardBoardId(note) === activeBoardId), [notes, activeBoardId])
  const boardCards = useMemo(() => allBoardCards.filter((note) => `${note.title} ${preview(note.content)}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => boardCardOrder(a) - boardCardOrder(b) || Number(Boolean(b.widgetPinned)) - Number(Boolean(a.widgetPinned)) || a.createdAt - b.createdAt), [allBoardCards, query])
  const boardNotes = boardCards.filter((note) => !note.isWidget)
  const noteWidgets = boardCards.filter((note) => note.isWidget)
  const pinnedNotes = noteWidgets.filter((note) => note.widgetPinned)
  const activeGroups = useMemo(() => visibleBoardGroups(boardGroups.filter((group) => group.boardId === activeBoardId), allBoardCards).sort((a, b) => a.order - b.order), [boardGroups, activeBoardId, allBoardCards])
  const { noGroupId, groups: displayGroups } = createDisplayGroups(activeGroups, activeBoardId)
  const groupCards = useCallback((groupId?: string) => allBoardCards.filter((card) => groupId ? card.groupId === groupId : !card.groupId).sort((a, b) => boardCardOrder(a) - boardCardOrder(b) || a.createdAt - b.createdAt), [allBoardCards])
  const latestNote = boardNotes.slice().sort((a, b) => b.updatedAt - a.updatedAt)[0]
  const updateBoardCard = useCallback(async (note: Note, patch: Partial<Note>) => {
    const changesBoard = 'boardId' in patch || 'widgetBoardId' in patch
    const changesGroup = 'groupId' in patch && patch.groupId !== note.groupId
    let cardPatch = patch
    if (changesBoard || changesGroup) {
      const updatedCard = { ...note, ...patch }
      const destination = changesBoard
        ? notes.filter((item) => item.id !== note.id && !item.deletedAt && (!item.isWidget || !item.widgetHidden) && boardCardBoardId(item) === boardCardBoardId(updatedCard))
        : groupCards(patch.groupId).filter((item) => item.id !== note.id)
      cardPatch = { ...patch, ...(changesBoard ? { groupId: undefined } : {}), ...boardCardOrderPatch(nextBoardCardOrder(destination)) }
    }
    const updated = { ...note, ...cardPatch, updatedAt: now() }
    setNotes((current) => current.map((item) => item.id === note.id ? updated : item))
    await notesRepository.save(updated)
  }, [groupCards, notes])
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
  const saveCardOrder = useCallback(async (items: Note[], groupId: string | undefined) => {
    const timestamp = now()
    const updated = items.map((item, index) => ({ ...item, groupId, ...boardCardOrderPatch(index), updatedAt: timestamp }))
    await Promise.all(updated.map((item) => notesRepository.save(item)))
    setNotes((current) => current.map((item) => updated.find((changed) => changed.id === item.id) ?? item))
  }, [])
  const handleCardDragEnd = ({ active, over }: DragEndEvent) => {
    const dragged = boardCards.find((item) => item.id === active.id)
    if (!dragged || (over && active.id === over.id)) return
    const target = over ? boardCards.find((item) => item.id === over.id) : undefined
    const destinationGroupId = groupIdForDrop(over ? String(over.id) : null, target, noGroupId)
    const sourceGroupId = dragged.groupId
    const destination = groupCards(destinationGroupId).filter((item) => item.id !== dragged.id)
    const targetIndex = target ? destination.findIndex((item) => item.id === target.id) : -1
    destination.splice(targetIndex < 0 ? destination.length : targetIndex, 0, { ...dragged, groupId: destinationGroupId })
    if (sourceGroupId !== destinationGroupId) void saveCardOrder(groupCards(sourceGroupId).filter((item) => item.id !== dragged.id), sourceGroupId)
    void saveCardOrder(destination, destinationGroupId)
  }
  const createGroup = async () => { const name = groupName.trim(); if (!activeBoardId || !name) { setGroupStatus('Enter a group name.'); return }; const group: BoardGroup = { id: newId(), boardId: activeBoardId, name, order: activeGroups.length, columnSpan: 1, verticalSize: 'normal', collapsed: false }; await database.boardGroups.add(group); setBoardGroups((current) => [...current, group]); setGroupName(''); setGroupStatus('Group created locally.') }
  const updateGroup = async (group: BoardGroup, patch: Partial<BoardGroup>) => { const updated = { ...group, ...patch }; setBoardGroups((current) => current.map((item) => item.id === group.id ? updated : item)); await database.boardGroups.put(updated) }
  const deleteGroup = async (group: BoardGroup) => {
    const replacement = activeGroups.find((item) => item.id !== group.id)
    if (!window.confirm(replacement ? `Delete “${group.name}”? Its cards will move to “${replacement.name}”.` : `Delete “${group.name}”? Its cards will move to “No group”.`)) return
    const movedCards = groupCards(group.id)
    const orderById = new Map(movedCards.map((card, index) => [card.id, index]))
    const updatedAt = now()
    await database.transaction('rw', database.boardGroups, database.notes, async () => {
      await database.notes.where('groupId').equals(group.id).modify((note) => {
        const order = orderById.get(note.id)
        note.groupId = undefined
        if (order !== undefined) note.widgetOrder = order
        note.updatedAt = updatedAt
      })
      await database.boardGroups.delete(group.id)
    })
    setNotes((current) => current.map((note) => {
      if (note.groupId !== group.id) return note
      const order = orderById.get(note.id)
      return { ...note, groupId: undefined, ...(order !== undefined ? boardCardOrderPatch(order) : {}), updatedAt }
    }))
    setBoardGroups((current) => current.filter((item) => item.id !== group.id))
    setGroupStatus('Group deleted and cards moved to No group.')
  }
  const duplicateWidget = async (note: Note) => {
    const timestamp = now()
    const duplicate: Note = { ...note, id: newId(), title: `${note.title} copy`, widgetPinned: false, widgetHidden: false, widgetOrder: nextBoardCardOrder(allBoardCards), createdAt: timestamp, updatedAt: timestamp }
    await notesRepository.add(duplicate)
    setNotes((current) => [...current, duplicate])
  }
  const createBoard = async () => {
    const name = boardName.trim()
    if (!name) { setBoardStatus('Enter a board name.'); return }
    const timestamp = now()
    const newBoard: Board = { id: newId(), name, createdAt: timestamp, updatedAt: timestamp }
    await database.boards.add(newBoard)
    setBoards((current) => [...current, newBoard])
    setActiveBoardId(newBoard.id)
    setSelectedCardId('')
    setBoardSettingsMode('manage')
    setBoardName(newBoard.name)
    setBoardStatus('Board created locally.')
  }
  const startCreatingBoard = () => { setSelectedCardId(''); setBoardSettingsMode('create'); setBoardName(''); setBoardStatus(''); setBoardSettingsOpen(true) }
  const switchBoard = (item: Board) => { setActiveBoardId(item.id); setSelectedCardId(''); setBoardSettingsOpen(false); setBoardStatus('') }
  const openBoardSettings = (item = activeBoard) => { if (!item) return; setActiveBoardId(item.id); setSelectedCardId(''); setBoardSettingsMode('manage'); setBoardName(item.name); setBoardStatus(''); setBoardSettingsOpen(true) }
  const renameBoard = async () => { if (!activeBoard || !boardName.trim()) { setBoardStatus('Enter a board name.'); return }; const updated = { ...activeBoard, name: boardName.trim(), updatedAt: now() }; await database.boards.put(updated); setBoards((current) => current.map((item) => item.id === updated.id ? updated : item)); setBoardName(updated.name); setBoardStatus('Board renamed locally.') }
  const closeBoardSettings = () => { setBoardSettingsOpen(false); requestAnimationFrame(() => boardSettingsTriggerRef.current?.focus()) }
  const deleteBoard = async () => {
    if (!activeBoard) return
    if (boards.length <= 1) { setBoardStatus('Keep at least one board. Create another board before deleting this one.'); return }
    const replacement = boards.find((item) => item.id !== activeBoard.id)
    if (!replacement || !window.confirm(`Delete “${activeBoard.name}”? Its cards will move to “${replacement.name}”.`)) return
    const movedAt = now()
    await database.transaction('rw', database.boards, database.notes, database.boardGroups, async () => {
      await database.notes.toCollection().modify((note) => {
        if (note.boardId !== activeBoard.id && note.widgetBoardId !== activeBoard.id && boardCardBoardId(note) !== activeBoard.id) return
        Object.assign(note, boardCardBoardMovePatch(note, activeBoard.id, replacement.id), { groupId: undefined, updatedAt: movedAt })
      })
      await database.boardGroups.where('boardId').equals(activeBoard.id).delete()
      await database.boards.delete(activeBoard.id)
    })
    setNotes((current) => current.map((note) => note.boardId === activeBoard.id || note.widgetBoardId === activeBoard.id || boardCardBoardId(note) === activeBoard.id ? { ...note, ...boardCardBoardMovePatch(note, activeBoard.id, replacement.id), groupId: undefined, updatedAt: movedAt } : note))
    setBoardGroups((current) => current.filter((group) => group.boardId !== activeBoard.id))
    setBoards((current) => current.filter((item) => item.id !== activeBoard.id))
    setActiveBoardId(replacement.id); setSelectedCardId(''); setBoardSettingsOpen(false)
  }
  const basePath = board ? '/board' : showTrash ? '/trash' : ''
  const createNote = useCallback(async (asWidget = false) => {
    const timestamp = now()
    const existingCards = board ? (await notesRepository.list()).filter((note) => !note.deletedAt && (!note.isWidget || !note.widgetHidden) && boardCardBoardId(note) === activeBoardId) : []
    const widgetOrder = board ? nextBoardCardOrder(existingCards) : asWidget ? noteWidgets.length : undefined
    const note: Note = { id: newId(), title: asWidget ? 'Untitled widget' : 'Untitled note', content: plainContent(''), boardId: !asWidget && board ? activeBoardId || undefined : undefined, isWidget: asWidget, widgetStyle: asWidget ? 'cream' : undefined, widgetBoardId: asWidget ? activeBoardId || undefined : undefined, groupId: undefined, widgetOrder, createdAt: timestamp, updatedAt: timestamp }
    await notesRepository.add(note)
    setNotes((current) => [note, ...current])
    navigate(`${basePath}/notes/${note.id}`)
  }, [navigate, basePath, noteWidgets.length, activeBoardId, board])
  useEffect(() => { if (newNoteRequest > 0 && newNoteRequest !== pendingRequest.current) { pendingRequest.current = newNoteRequest; void createNote().finally(() => onNewNoteHandled?.()) } }, [newNoteRequest, onNewNoteHandled, createNote])
  const trashNote = async (note: Note) => { await notesRepository.trash(note.id); navigate(basePath || '/'); setNotes((current) => current.filter((item) => item.id !== note.id)) }
  const restoreNote = async (note: Note) => { await notesRepository.restore(note.id); setNotes((current) => current.filter((item) => item.id !== note.id)) }
  const heading = board ? 'Board' : showTrash ? 'Trash' : 'All notes'
  useEffect(() => {
    if (!board || !selectedCardId) return
    const onLayoutKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey || event.shiftKey) && !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return
      if (event.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return
      const card = boardCards.find((item) => item.id === selectedCardId)
      if (!card) return
      if (!event.shiftKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
        event.preventDefault()
        const items = groupCards(card.groupId)
        const index = items.findIndex((item) => item.id === card.id)
        const next = Math.max(0, Math.min(items.length - 1, index + (event.key === 'ArrowUp' ? -1 : 1)))
        if (index !== next) { const [moved] = items.splice(index, 1); items.splice(next, 0, moved); void saveCardOrder(items, card.groupId) }
        return
      }
      if (!event.shiftKey) return
      event.preventDefault()
      const { width, height } = boardCardLayout(card)
      const maxWidth = card.isWidget ? 8 : 6
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') void updateBoardCard(card, boardCardLayoutPatch(card, { width: Math.max(1, Math.min(maxWidth, width + (event.key === 'ArrowLeft' ? -1 : 1))) }))
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') void updateBoardCard(card, boardCardLayoutPatch(card, { height: Math.max(1, Math.min(5, height + (event.key === 'ArrowUp' ? -1 : 1))) }))
    }
    document.addEventListener('keydown', onLayoutKeyDown)
    return () => document.removeEventListener('keydown', onLayoutKeyDown)
  }, [board, selectedCardId, boardCards, groupCards, noGroupId, saveCardOrder, updateBoardCard])
  const renderBoardCard = (note: Note) => {
    const key = `card:${note.id}`
    const layout = boardCardLayout(note)
    return <BoardCard
      key={note.id}
      note={note}
      notes={notes}
      boards={boards}
      groups={activeGroups}
      selected={selectedCardId === note.id}
      resizing={resizeTarget === key}
      resizeWidth={resizeValue(`${key}:width`, layout.width)}
      resizeHeight={resizeValue(`${key}:height`, layout.height)}
      onSelect={() => { setSelectedCardId(note.id); setSelectedGroupId(''); setResizeTarget((current) => current === key ? '' : key) }}
      onEdit={() => navigate(`/board/notes/${note.id}`)}
      onUpdate={(patch) => void updateBoardCard(note, patch)}
      onTrash={() => void trashNote(note)}
      onDuplicate={() => void duplicateWidget(note)}
      onResize={() => setResizeTarget((current) => current === key ? '' : key)}
      onResizePreview={(axis, value) => previewResize(`${key}:${axis}`, value)}
      onResizeEnd={(axis) => clearResizePreview(`${key}:${axis}`)}
      onRef={(element) => { if (element) cardRefs.current.set(note.id, element); else cardRefs.current.delete(note.id) }}
    />
  }
  const visibleGroupCards = (groupId: string) => cardsForGroup(boardCards, groupId, noGroupId).sort((a, b) => boardCardOrder(a) - boardCardOrder(b) || a.createdAt - b.createdAt)
  if (board) return <section className="board-view">
    {selected ? <div className="board-editor"><NoteEditor key={selected.id} note={selected} onSaved={(updated) => setNotes((current) => current.map((item) => item.id === updated.id ? updated : item))} onClose={() => navigate('/board')} backLabel="Board" /></div> : <>
      <header className="board-header"><div className="board-heading" onDoubleClick={() => openBoardSettings()}><span className="board-star" aria-hidden="true">✦</span><div><p className="eyebrow">Your notebook · Home</p><h1>Dashboard</h1><p className="board-subtitle">A clear view of your notes, widgets, and next ideas.</p></div></div><div className="board-controls"><label className="board-picker"><span className="sr-only">Active board</span><select value={activeBoardId} disabled={!boardsLoaded || boards.length === 0} onChange={(event) => { const nextBoard = boards.find((item) => item.id === event.target.value); if (nextBoard) switchBoard(nextBoard) }}>{boards.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><button className="board-layout-button" type="button" disabled={!boardsLoaded} onClick={startCreatingBoard}>＋ New board</button><label className="board-search"><span className="sr-only">Search board cards</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search cards" /></label><span className="board-layout-hint">Select a card to drag or resize it</span><button ref={boardSettingsTriggerRef} className="board-layout-button" type="button" aria-expanded={boardSettingsOpen} aria-controls="board-settings" onClick={() => openBoardSettings()}>Manage board</button><button className="primary-button" type="button" onClick={() => void createNote(true)}>＋ Add widget</button></div></header>
      {boardSettingsOpen && <section id="board-settings" className="board-settings" role="region" aria-labelledby="board-settings-title"><div><p className="eyebrow">Board settings</p><h2 id="board-settings-title">{boardSettingsMode === 'create' ? 'Create board' : `Manage ${activeBoard?.name ?? 'board'}`}</h2></div><label>Board name<input autoFocus value={boardName} onChange={(event) => setBoardName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && boardSettingsMode === 'create') { event.preventDefault(); void createBoard() } }} /></label><div className="board-settings-actions">{boardSettingsMode === 'create' ? <button className="text-button" type="button" onClick={() => void createBoard()}>Create board</button> : <><button className="text-button" type="button" onClick={() => void renameBoard()}>Save name</button><button className="text-button danger" type="button" onClick={() => void deleteBoard()} disabled={boards.length <= 1}>Delete board</button></>}<button className="text-button" type="button" onClick={closeBoardSettings}>Close</button></div><p className="board-settings-help">{boardSettingsMode === 'create' ? 'Name a new board. It will be stored only in this browser.' : 'Select the active board again, double-click a board name, or use this keyboard-accessible panel to manage it. Deleting moves its cards to another board.'}</p>{boardStatus && <p role="status" className="board-settings-status">{boardStatus}</p>}</section>}
            <section className="board-summary" aria-label="Notebook summary"><article className="summary-card summary-welcome"><div className="summary-card-top"><h2>Good to see you</h2><span className="summary-badge">Local-first</span></div><p>{boardNotes.length ? `You have ${boardNotes.length} ${boardNotes.length === 1 ? 'note' : 'notes'} ready to revisit.` : 'Start with a note and make this space yours.'}</p><button className="summary-action" type="button" onClick={() => void createNote()}>＋ New note</button></article><article className="summary-card"><div className="summary-card-top"><h2>Notes</h2><span className="summary-badge">Library</span></div><strong className="summary-number">{boardNotes.length}</strong><p>Ideas saved in your notebook</p></article><article className="summary-card"><div className="summary-card-top"><h2>Pinned widgets</h2><span className="summary-badge">Focus</span></div><strong className="summary-number">{pinnedNotes.length}</strong><p>Widgets kept close at hand</p></article><article className="summary-card summary-latest"><h2>Latest note</h2>{latestNote ? <button className="summary-note-link" type="button" onClick={() => navigate(`/board/notes/${latestNote.id}`)}><strong>{latestNote.title}</strong><span>{preview(latestNote.content)}</span></button> : <p>No notes yet. Capture an idea to see it here.</p>}</article></section>
      <DndContext sensors={sensors} collisionDetection={boardCollisionDetection} onDragEnd={handleCardDragEnd}>
        <SortableContext items={displayGroups.flatMap((group) => group.collapsed ? [] : visibleGroupCards(group.id)).map((card) => card.id)} strategy={rectSortingStrategy}>
          <section className="board-collection-groups" aria-labelledby="board-groups-heading">
            <div className="board-section-heading">
              <div><p className="eyebrow">Everything assigned to this board</p><h2 id="board-groups-heading">{activeBoard ? `${activeBoard.name} cards` : 'Board cards'}</h2></div>
              <span className="hidden-widget-count">{boardCards.length} {boardCards.length === 1 ? 'card' : 'cards'}</span>
            </div>
            <form className="group-create" onSubmit={(event) => { event.preventDefault(); void createGroup() }}>
              <label>New group<input value={groupName} onChange={(event) => setGroupName(event.target.value)} /></label>
              <button className="text-button" type="submit">Add group</button>
              {groupStatus && <span role="status">{groupStatus}</span>}
            </form>
            {boardCards.length === 0 ? <div className="board-empty"><span>✦</span><h2>{query ? 'No matching cards' : 'No cards on this board'}</h2><p>{query ? 'Try another search.' : 'Create a note or widget to start filling your board.'}</p>{!query && <><button className="primary-button" type="button" onClick={() => void createNote()}>＋ New note</button><button className="text-button" type="button" onClick={() => void createNote(true)}>＋ Add widget</button></>}</div> : <div className="board-widget-groups">
              {displayGroups.map((group) => <section
                ref={(element) => { if (element) groupRefs.current.set(group.id, element); else groupRefs.current.delete(group.id) }}
                className={`board-widget-group group-span-${resizeValue(`group:${group.id}:width`, group.columnSpan)} group-height-${resizeValue(`group:${group.id}:height`, group.verticalSize === 'compact' ? 1 : group.verticalSize === 'tall' ? 3 : 2) === 1 ? 'compact' : resizeValue(`group:${group.id}:height`, group.verticalSize === 'compact' ? 1 : group.verticalSize === 'tall' ? 3 : 2) === 3 ? 'tall' : 'normal'} ${selectedGroupId === group.id ? 'selected' : ''} ${resizeTarget === `group:${group.id}` ? 'resize-mode' : ''}`}
                key={group.id}
                aria-labelledby={`widget-group-${group.id}`}
                tabIndex={0}
                onClick={(event) => { if ((event.target as Element).closest('.board-widget-card, .board-note-card')) return; setSelectedGroupId(group.id); setSelectedCardId(''); setResizeTarget((current) => current === `group:${group.id}` ? '' : `group:${group.id}`) }}
                onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedGroupId(group.id); setSelectedCardId(''); setResizeTarget((current) => current === `group:${group.id}` ? '' : `group:${group.id}`) } }}
              >
                <div className="widget-group-heading"><h3 id={`widget-group-${group.id}`}>{group.name}</h3><span>{visibleGroupCards(group.id).length}</span>{selectedGroupId === group.id && <div className="group-actions">
                  {group.id !== noGroupId && <><button type="button" onClick={() => void updateGroup(group, { collapsed: !group.collapsed })} aria-expanded={!group.collapsed}>{group.collapsed ? 'Expand' : 'Collapse'}</button><button type="button" onClick={() => { const name = window.prompt('Rename group', group.name)?.trim(); if (name) void updateGroup(group, { name }) }}>Rename</button></>}
                  <button type="button" onClick={() => setResizeTarget((current) => current === `group:${group.id}` ? '' : `group:${group.id}`)}>{resizeTarget === `group:${group.id}` ? 'Done resize' : 'Resize'}</button>
                  {resizeTarget === `group:${group.id}` && <label className="group-size-picker">Width<select value={group.columnSpan} onChange={(event) => void updateGroup(group, { columnSpan: Number(event.target.value) as BoardGroup['columnSpan'] })}>{[1, 2, 3, 4].map((span) => <option key={span} value={span}>{span} columns</option>)}</select></label>}
                  <button type="button" onClick={() => void updateGroup(group, { verticalSize: group.verticalSize === 'compact' ? 'normal' : group.verticalSize === 'normal' ? 'tall' : 'compact' })}>Height: {group.verticalSize}</button>
                  {group.id !== noGroupId && <button type="button" className="danger" onClick={() => void deleteGroup(group)}>Delete</button>}
                </div>}</div>
                {!group.collapsed && <><GroupDropTarget groupId={group.id} name={group.name} /><div className="board-widget-grid">{visibleGroupCards(group.id).map(renderBoardCard)}</div></>}
                {resizeTarget === `group:${group.id}` && <><ResizeEdgeHandle container="group" axis="horizontal" label={group.name} value={resizeValue(`group:${group.id}:width`, group.columnSpan)} maximum={4} onPreview={(value) => previewResize(`group:${group.id}:width`, value)} onCommit={(span) => void updateGroup(group, { columnSpan: span as BoardGroup['columnSpan'] })} onEnd={() => clearResizePreview(`group:${group.id}:width`)} /><ResizeEdgeHandle container="group" axis="vertical" label={group.name} value={resizeValue(`group:${group.id}:height`, group.verticalSize === 'compact' ? 1 : group.verticalSize === 'tall' ? 3 : 2)} maximum={3} onPreview={(value) => previewResize(`group:${group.id}:height`, value)} onCommit={(height) => void updateGroup(group, { verticalSize: height === 1 ? 'compact' : height === 2 ? 'normal' : 'tall' })} onEnd={() => clearResizePreview(`group:${group.id}:height`)} /></>}
              </section>)}
            </div>}
          </section>
        </SortableContext>
      </DndContext>
    </>}
  </section>
  const list = <aside className="notes-list" aria-label={`${heading} list`}>
    <div className="notes-list-header"><span className="eyebrow">Your notebook</span><h2>{heading}</h2><span className="note-count">{filtered.length} {filtered.length === 1 ? 'note' : 'notes'}</span></div>
    <label className="search-field"><span className="sr-only">Search notes</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="⌕  Search notes" /></label>
    {!showTrash && collections.length > 0 && <label className="filter-field"><span className="sr-only">Collection</span><select value={collectionId} onChange={(event) => setCollectionId(event.target.value)}><option value="">All collections</option>{collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}</select></label>}
    <div className="notes-list-scroll">{filtered.length === 0 ? <p className="list-empty">{showTrash ? 'Trash is empty.' : query ? 'No matching notes.' : 'No notes yet. Start with a new note.'}</p> : filtered.map((note) => <div className={`note-list-item ${selected?.id === note.id ? 'selected' : ''}`} key={note.id}><button type="button" className="note-list-open" onClick={() => navigate(`${showTrash ? '/trash/notes' : '/notes'}/${note.id}`)}><strong>{note.title}</strong><DocumentPreview document={note.content} notes={notes} maxBlocks={2} className="note-list-preview" /><small>{note.collectionId ? `${collectionNames.get(note.collectionId) ?? 'Collection'} · ` : ''}{new Date(note.updatedAt).toLocaleDateString()}</small></button>{selected?.id === note.id && <button type="button" className={`note-list-action ${showTrash ? '' : 'danger'}`} onClick={() => { void (showTrash ? restoreNote(note) : trashNote(note)) }}>{showTrash ? 'Restore' : 'Trash'}</button>}</div>)}</div>
    {!showTrash && <button type="button" className="list-new" onClick={() => void createNote()}>＋ New note</button>}
  </aside>
  return <section className={`notes-workspace ${selected ? 'has-selection' : ''}`}>{list}<div className="notes-detail">{selected ? <NoteEditor key={selected.id} note={selected} onSaved={(updated) => setNotes((current) => current.map((item) => item.id === updated.id ? updated : item))} onClose={() => navigate(showTrash ? '/trash' : '/')} backLabel={showTrash ? 'Trash' : 'All notes'} /> : <div className="welcome-panel"><span className="welcome-star" aria-hidden="true">✦</span><p className="eyebrow">A space for your thoughts</p><h1>{showTrash ? 'The little things stay here.' : 'Make room for ideas.'}</h1><p className="muted">{showTrash ? 'Select a note to review or restore it.' : 'Select a note on the left, or start with a fresh page.'}</p>{!showTrash && <button className="primary-button" type="button" onClick={() => void createNote()}>＋ Write a note</button>}</div>}</div></section>
}
