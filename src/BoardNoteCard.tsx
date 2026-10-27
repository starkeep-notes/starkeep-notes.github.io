import type { CSSProperties } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Board, BoardGroup, Note } from './types'
import { DocumentPreview } from './DocumentPreview'
import { ResizeEdgeHandle } from './ResizeEdgeHandle'

type Props = {
  note: Note
  selected: boolean
  resizing: boolean
  resizeWidth: number
  resizeHeight: number
  notes: Note[]
  boards: Board[]
  groups: BoardGroup[]
  onSelect: () => void
  onEdit: () => void
  onUpdate: (patch: Partial<Note>) => void
  onTrash: () => void
  onResize: () => void
  onResizePreview: (axis: 'width' | 'height', value: number) => void
  onResizeCommit: (axis: 'width' | 'height', value: number) => void
  onResizeEnd: (axis: 'width' | 'height') => void
  onRef: (element: HTMLElement | null) => void
}

export function BoardNoteCard({ note, selected, resizing, resizeWidth, resizeHeight, notes, boards, groups, onSelect, onEdit, onUpdate, onTrash, onResize, onResizePreview, onResizeCommit, onResizeEnd, onRef }: Props) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: note.id, disabled: !selected })
  const style: CSSProperties = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 1 : undefined }
  const width = resizeWidth
  const height = resizeHeight
  const setCardRef = (element: HTMLElement | null) => { setNodeRef(element); onRef(element) }
  return <article ref={setCardRef} style={style} data-board-note-id={note.id} className={`board-card board-note-card note-size-step-${width} note-height-step-${height} ${selected ? 'selected' : ''} ${resizing ? 'resize-mode' : ''} ${isDragging ? 'is-dragging' : ''}`} tabIndex={0} aria-label={`${note.title} note${selected ? ', selected' : ''}`} onClick={onSelect} onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect() } }}>
    <button type="button" className="board-card-open" onClick={(event) => { event.stopPropagation(); onEdit() }}><strong>{note.title}</strong><DocumentPreview document={note.content} notes={notes} maxBlocks={2} className="board-note-preview" /></button>
    <div className="board-card-footer"><small>{new Date(note.updatedAt).toLocaleDateString()}</small>{selected && <div className="board-note-actions" onClick={(event) => event.stopPropagation()}>
      <button ref={setActivatorNodeRef} type="button" className="widget-drag-handle" aria-label={`Drag ${note.title}`} {...attributes} {...listeners}>↕ Drag</button>
      <button type="button" className="board-widget-edit" onClick={onEdit}>Edit</button>
      <button type="button" className="board-widget-action" onClick={onResize}>{resizing ? 'Done resize' : 'Resize'}</button>
      {resizing && <><label className="note-size-picker">Width<select value={`step-${width}`} onChange={(event) => onUpdate({ boardSize: event.target.value as NonNullable<Note['boardSize']> })}>{[1, 2, 3, 4, 5, 6].map((step) => <option key={step} value={`step-${step}`}>Step {step} of 6</option>)}</select></label><label className="note-size-picker">Height<select value={`step-${height}`} onChange={(event) => onUpdate({ boardHeight: event.target.value as NonNullable<Note['boardHeight']> })}>{[1, 2, 3, 4, 5].map((step) => <option key={step} value={`step-${step}`}>Step {step} of 5</option>)}</select></label></>}
      <label><span className="sr-only">Move {note.title} to board</span><select value={note.boardId ?? ''} onChange={(event) => onUpdate({ boardId: event.target.value || undefined })}>{boards.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label><span className="sr-only">Group for {note.title}</span><select value={note.groupId ?? ''} onChange={(event) => onUpdate({ groupId: event.target.value || undefined })}><option value="">No group</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
      <button type="button" className="board-widget-action danger" onClick={onTrash}>Trash</button>
    </div>}</div>
    {resizing && <><ResizeEdgeHandle axis="horizontal" label={note.title} value={width} maximum={6} onPreview={(value) => onResizePreview('width', value)} onCommit={(value) => onResizeCommit('width', value)} onEnd={() => onResizeEnd('width')} /><ResizeEdgeHandle axis="vertical" label={note.title} value={height} maximum={5} onPreview={(value) => onResizePreview('height', value)} onCommit={(value) => onResizeCommit('height', value)} onEnd={() => onResizeEnd('height')} /></>}
  </article>
}
