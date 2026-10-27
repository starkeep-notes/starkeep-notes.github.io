import type { CSSProperties } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Board, BoardGroup, Note } from './types'
import { DocumentPreview } from './DocumentPreview'
import { ResizeEdgeHandle } from './ResizeEdgeHandle'
import { boardCardBoardId, boardCardLayoutPatch } from './boardPlacement'
import { fineSizeValue, HEIGHT_STEPS, NOTE_WIDTH_STEPS, WIDGET_WIDTH_STEPS } from './boardLayout'

type Props = {
  note: Note
  notes: Note[]
  boards: Board[]
  groups: BoardGroup[]
  selected: boolean
  resizing: boolean
  resizeWidth: number
  resizeHeight: number
  onSelect: () => void
  onEdit: () => void
  onUpdate: (patch: Partial<Note>) => void
  onTrash: () => void
  onDuplicate: () => void
  onResize: () => void
  onResizePreview: (axis: 'width' | 'height', value: number) => void
  onResizeEnd: (axis: 'width' | 'height') => void
  onRef: (element: HTMLElement | null) => void
}

export function BoardCard({ note, notes, boards, groups, selected, resizing, resizeWidth, resizeHeight, onSelect, onEdit, onUpdate, onTrash, onDuplicate, onResize, onResizePreview, onResizeEnd, onRef }: Props) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: note.id, disabled: !selected })
  const isWidget = Boolean(note.isWidget)
  const key = isWidget ? 'widget' : 'note'
  const widthSteps = isWidget ? WIDGET_WIDTH_STEPS : NOTE_WIDTH_STEPS
  const setCardRef = (element: HTMLElement | null) => { setNodeRef(element); onRef(element) }
  const style: CSSProperties = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 1 : undefined }
  const classes = isWidget
    ? `board-widget-card widget-size-step-${resizeWidth} widget-height-step-${resizeHeight} preview-${note.widgetStyle ?? 'cream'}`
    : `board-card board-note-card note-size-step-${resizeWidth} note-height-step-${resizeHeight}`
  const sharedActions = <>
    <button ref={setActivatorNodeRef} type="button" className="widget-drag-handle" aria-label={`Drag ${note.title}`} {...attributes} {...listeners}>↕ Drag</button>
    <button type="button" className="board-widget-edit" onClick={onEdit}>Edit</button>
    {isWidget && <button type="button" className="board-widget-action" onClick={() => onUpdate({ widgetPinned: !note.widgetPinned })}>{note.widgetPinned ? 'Unpin' : 'Pin'}</button>}
    <button type="button" className="board-widget-action" onClick={onResize}>{resizing ? 'Done resize' : 'Resize'}</button>
    {resizing && <>
      <label className={isWidget ? 'widget-size-picker' : 'note-size-picker'}><span>Width</span><select value={fineSizeValue(resizeWidth)} onChange={(event) => onUpdate(boardCardLayoutPatch(note, { width: Number(event.target.value.slice(5)) }))}>{widthSteps.map((step) => <option key={step} value={fineSizeValue(step)}>Step {step} of {widthSteps.length}</option>)}</select></label>
      <label className={isWidget ? 'widget-size-picker' : 'note-size-picker'}><span>Height</span><select value={fineSizeValue(resizeHeight)} onChange={(event) => onUpdate(boardCardLayoutPatch(note, { height: Number(event.target.value.slice(5)) }))}>{HEIGHT_STEPS.map((step) => <option key={step} value={fineSizeValue(step)}>Step {step} of 5</option>)}</select></label>
    </>}
    <label className="widget-group-picker"><span className="sr-only">Move {note.title} to board</span><select value={boardCardBoardId(note) ?? ''} onChange={(event) => onUpdate({ ...boardCardLayoutPatch(note, { boardId: event.target.value || undefined }), groupId: undefined })}>{boards.map((board) => <option key={board.id} value={board.id}>{board.name}</option>)}</select></label>
    <label className="widget-group-picker"><span className="sr-only">Group for {note.title}</span><select value={note.groupId ?? ''} onChange={(event) => onUpdate({ groupId: event.target.value || undefined })}><option value="">No group</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
    {isWidget ? <><button type="button" className="board-widget-action" onClick={onDuplicate}>Duplicate</button><button type="button" className="board-widget-action danger" onClick={() => onUpdate({ widgetHidden: true })}>Hide</button></> : <button type="button" className="board-widget-action danger" onClick={onTrash}>Trash</button>}
  </>
  const actionPanel = selected && <div className={isWidget ? 'board-widget-actions' : 'board-note-actions'} aria-label={`${note.title} actions`} onClick={(event) => event.stopPropagation()}>{sharedActions}</div>
  return <article ref={setCardRef} data-board-card-id={note.id} style={style} tabIndex={0} aria-label={`${note.title} ${key}${selected ? ', selected' : ''}`} onClick={onSelect} onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect() } }} className={`${classes} ${selected ? 'selected layout-editing' : ''} ${resizing ? 'resize-mode' : ''} ${isDragging ? 'is-dragging' : ''}`}>
    {isWidget ? <>
      {actionPanel}
      <span className="widget-card-label">{note.widgetPinned ? 'Custom widget' : 'Note widget'} {note.content.blocks.some((block) => 'parts' in block && block.parts.some((part) => part.type === 'token')) ? ' · {{ }}' : ' · Template'}</span>
      <div className="widget-card-content"><DocumentPreview document={note.content} notes={notes} maxBlocks={3} excludeImages className="widget-card-document" />{note.content.blocks.filter((block) => block.type === 'image').map((image) => <figure className="widget-card-image" key={image.id}><img src={image.src} alt={image.alt} /><figcaption>{image.creator}{image.creator && image.license ? ' · ' : ''}{image.license}{image.pageUrl && <> · <a href={image.pageUrl} target="_blank" rel="noreferrer">Source</a></>}</figcaption></figure>)}</div>
    </> : <>
      <button type="button" className="board-card-open" onClick={(event) => { event.stopPropagation(); onEdit() }}><strong>{note.title}</strong><DocumentPreview document={note.content} notes={notes} maxBlocks={2} className="board-note-preview" /></button>
      <div className="board-card-footer"><small>{new Date(note.updatedAt).toLocaleDateString()}</small>{actionPanel}</div>
    </>}
    {resizing && <><ResizeEdgeHandle axis="horizontal" label={note.title} value={resizeWidth} maximum={widthSteps.length} onPreview={(value) => onResizePreview('width', value)} onCommit={(value) => onUpdate(boardCardLayoutPatch(note, { width: value }))} onEnd={() => onResizeEnd('width')} /><ResizeEdgeHandle axis="vertical" label={note.title} value={resizeHeight} maximum={HEIGHT_STEPS.length} onPreview={(value) => onResizePreview('height', value)} onCommit={(value) => onUpdate(boardCardLayoutPatch(note, { height: value }))} onEnd={() => onResizeEnd('height')} /></>}
  </article>
}
