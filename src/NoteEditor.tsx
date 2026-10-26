import { useEffect, useRef, useState } from 'react'
import Quill from 'quill'
import { deltaToDocument, documentToDelta, plainText } from './editorDraft'
import type { Board, Collection, Note } from './types'
import { database } from './db'
import { notesRepository } from './notesRepository'
import { loadSavedTemplates, renderWidgetTemplate, createTemplateValues, widgetPresets, type WidgetStyle } from './widgetTemplates'
import { parseWidgetDocument, type DocumentAst } from './widgetDocument'
import { WidgetVisualEditor, type WidgetBlockSelection, type WidgetVisualEditorHandle } from './WidgetVisualEditor'
import { SyntaxCodeEditor } from './SyntaxCodeEditor'
import { validateWidgetSyntax, type SyntaxIssue } from './widgetSyntax'
import { ImagePicker } from './ImagePicker'
import type { EmbeddedImage } from './imageSearch'

const previewContent = (content: string) => content.trim() || 'Start writing your widget'

function WidgetPreview({ content, notes }: { content: string; notes: Note[] }) {
 const values = createTemplateValues(notes)
 let document: DocumentAst
 try { document = parseWidgetDocument(content) } catch { return <div className="preview-content"><p>{content || 'Start writing your widget'}</p></div> }
 return <div className="preview-content">{document.blocks.filter((block) => block.type !== 'text' || block.parts.some((part) => part.type === 'text' ? part.text.trim() : true)).slice(0, 6).map((block) => {
   if (block.type === 'heading') { const text = renderWidgetTemplate(block.parts.map((part) => part.type === 'token' ? part.source ?? `{{${part.key}}}` : part.text).join(''), values); return <div className={`preview-heading preview-heading-${block.level}`} key={block.id}>{text}</div> }
   if (block.type === 'metric') return <div className="preview-metric" key={block.id}><span>{renderWidgetTemplate(block.label, values)}</span><strong>{renderWidgetTemplate(block.value, values)}</strong></div>
   if (block.type === 'progress') { const current = Number(renderWidgetTemplate(block.value, values)) || 0; const maximum = Number(renderWidgetTemplate(block.maximum, values)) || 100; return <div className="preview-progress" key={block.id}><span>{renderWidgetTemplate(block.label, values)}</span><strong>{renderWidgetTemplate(block.value, values)} / {renderWidgetTemplate(block.maximum, values)}</strong><div className="preview-progress-track"><i style={{ width: `${Math.min(100, Math.max(0, current / maximum * 100))}%` }} /></div></div> }
   if (block.type === 'image') return <figure className="preview-image-block" key={block.id}><img src={block.src} alt={block.alt} /><figcaption>{block.creator}{block.creator && block.license ? ' · ' : ''}{block.license}{block.pageUrl && <> · <a href={block.pageUrl} target="_blank" rel="noreferrer">Source</a></>}</figcaption></figure>
   return <p key={block.id}>{renderWidgetTemplate(block.parts.map((part) => part.type === 'token' ? part.source ?? `{{${part.key}}}` : part.text).join(''), values)}</p>
 })}</div>
}

function SyntaxEditorPanel({ content, notes, onChange, widgetStyle }: { content: string; notes: Note[]; onChange: (content: string) => void; widgetStyle: WidgetStyle }) {
  const issues: SyntaxIssue[] = validateWidgetSyntax(content)
  return <div className="syntax-workbench">
    <div className="syntax-editor-panel">
      <div className="syntax-editor-heading"><span className="syntax-badge">syntax</span><span className={`syntax-status ${issues.length ? 'has-errors' : ''}`}>{issues.length ? `⚠ ${issues.length} ${issues.length === 1 ? 'issue' : 'issues'}` : '✓ No errors'}</span></div>
      <SyntaxCodeEditor value={content} issues={issues} onChange={onChange} />
      {issues.length > 0 ? <div className="syntax-issues" role="alert">{issues.map((issue) => <div key={`${issue.line}-${issue.message}`}><strong>Line {issue.line}</strong>{issue.message}</div>)}</div> : <div className="syntax-hint"><strong>Hint</strong> Use <code>{'{{ notes.total }}'}</code> for a live value, or <code>{'{{ note("title") }}'}</code> to read a note.</div>}
    </div>
    <aside className="syntax-reference"><div className="syntax-preview-heading">Live preview</div><div className={`syntax-preview-card preview-${widgetStyle}`}><WidgetPreview content={previewContent(content)} notes={notes} /></div><div className="syntax-preview-heading">Cheat sheet</div><div className="syntax-cheat-sheet"><p><code>{'{{ note("title") }}'}</code><span>Read one note</span></p><p><code>{'{{ notes where tag = "x" }}'}</code><span>Filter notes</span></p><p><code>{'{{ value | ago }}'}</code><span>Format a value</span></p><p><code>{'[metric: Label | value]'}</code><span>Show a metric</span></p><p><code>{'[progress: Label | value | max]'}</code><span>Show progress</span></p></div></aside>
  </div>
}

type Props = { note: Note; onSaved: (note: Note) => void; onClose: () => void; backLabel?: string }

export function NoteEditor({ note, onSaved, onClose, backLabel = 'All notes' }: Props) {
  const editorRef = useRef<HTMLDivElement>(null)
  const quillRef = useRef<Quill | null>(null)
  const widgetEditorRef = useRef<WidgetVisualEditorHandle>(null)
  const noteRef = useRef(note)
  const titleRef = useRef(note.title)
  const collectionIdRef = useRef(note.collectionId ?? '')
  const boardIdRef = useRef(note.boardId ?? '')
  const modeRef = useRef(note.isWidget ?? false)
  const widgetStyleRef = useRef(note.widgetStyle ?? 'cream')
  const onSavedRef = useRef(onSaved)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve())
  const revisionRef = useRef(0)
  const queuedRef = useRef(0)
  const mountedRef = useRef(true)
  const contentRef = useRef(note.content)
  const [title, setTitle] = useState(note.title)
  const [collectionId, setCollectionId] = useState(note.collectionId ?? '')
  const [boardId, setBoardId] = useState(note.boardId ?? '')
  const [boards, setBoards] = useState<Board[]>([])
  const [isWidget, setIsWidget] = useState(note.isWidget ?? false)
  const [widgetStyle, setWidgetStyle] = useState<WidgetStyle>(note.widgetStyle ?? 'cream')
  const [templateChoice, setTemplateChoice] = useState('')
  const [editorMode, setEditorMode] = useState<'builder' | 'syntax'>(() => validateWidgetSyntax(plainText(note.content)).length ? 'syntax' : 'builder')
  const [savedTemplates] = useState(() => loadSavedTemplates())
  const initialWidgetText = plainText(note.content)
  const [previewText, setPreviewText] = useState(initialWidgetText)
  const previewTextRef = useRef(initialWidgetText)
  const [collections, setCollections] = useState<Collection[]>([])
  const [allNotes, setAllNotes] = useState<Note[]>([note])
  const [saveState, setSaveState] = useState('Saved locally')
  const [selectedBlock, setSelectedBlock] = useState<WidgetBlockSelection | null>(null)
  const [openInsertCategory, setOpenInsertCategory] = useState<'templates' | 'elements' | 'pictures' | null>('elements')
  const [imagePickerOpen, setImagePickerOpen] = useState(false)

  function queueSave() {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = undefined }
    const revision = revisionRef.current
    if (queuedRef.current === revision) return
    queuedRef.current = revision
    if (mountedRef.current) setSaveState('Saving…')
    saveQueueRef.current = saveQueueRef.current.then(async () => {
      // Skip superseded requests; a debounce or newer queued write owns that draft.
      if (revision !== revisionRef.current) return
      const savingRevision = revision
      const updated: Note = { ...noteRef.current, title: titleRef.current.trim() || 'Untitled note', collectionId: collectionIdRef.current || undefined, boardId: boardIdRef.current || undefined, isWidget: modeRef.current, widgetStyle: modeRef.current ? widgetStyleRef.current : undefined, content: contentRef.current, updatedAt: Date.now() }
      try {
        await notesRepository.save(updated)
        noteRef.current = updated
        onSavedRef.current(updated)
        if (mountedRef.current) setSaveState(savingRevision === revisionRef.current ? 'Saved locally' : queuedRef.current === revisionRef.current ? 'Saving…' : 'Unsaved changes')
      } catch {
        if (mountedRef.current && savingRevision === revisionRef.current) setSaveState('Save failed — retrying on next change')
      }
    })
  }
  function changed(immediate = false) {
    revisionRef.current++
    setSaveState('Unsaved changes')
    if (immediate) queueSave()
    else {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(queueSave, 500)
    }
  }

  useEffect(() => { onSavedRef.current = onSaved }, [onSaved])
  useEffect(() => { void database.collections.toArray().then(setCollections); void database.boards.toArray().then((items) => setBoards(items.sort((a, b) => a.createdAt - b.createdAt))); void notesRepository.list().then(setAllNotes) }, [])
  useEffect(() => {
    if (isWidget || !editorRef.current) return
    const editorElement = editorRef.current
    const quill = new Quill(editorElement, { theme: 'snow', modules: { toolbar: { container: [['bold', 'italic', 'underline'], [{ header: [1, 2, false] }], [{ list: 'ordered' }, { list: 'bullet' }], ['link', 'image']], handlers: { image: () => setImagePickerOpen(true) } } } })
    quill.setContents(documentToDelta(contentRef.current))
    quillRef.current = quill
    const save = () => {
      contentRef.current = deltaToDocument(quill.getContents())
      previewTextRef.current = plainText(contentRef.current)
      changed()
    }
    quill.on('text-change', save)
    return () => { quill.off('text-change', save); quill.disable(); quillRef.current = null; const toolbar = editorElement.previousElementSibling; if (toolbar?.classList.contains('ql-toolbar')) toolbar.remove(); editorElement.replaceChildren(); editorElement.className = 'quill-editor' }
  }, [note.id, isWidget])
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; if (timerRef.current) queueSave() } }, [])

  const saveTitle = () => queueSave()
  const changeMode = (next: boolean) => {
    if (next === modeRef.current) return
    if (next) {
      if (quillRef.current) contentRef.current = deltaToDocument(quillRef.current.getContents())
      const text = plainText(contentRef.current)
      previewTextRef.current = text
      setPreviewText(text)
      if (validateWidgetSyntax(text).length) setEditorMode('syntax')
    } else contentRef.current = parseWidgetDocument(previewTextRef.current)
    modeRef.current = next
    setIsWidget(next)
    changed(true)
  }
  const changeStyle = (next: WidgetStyle) => { setWidgetStyle(next); widgetStyleRef.current = next; changed(true) }
  const templateOptions = [...widgetPresets.map((item) => ({ ...item, source: 'Built-in' })), ...savedTemplates.filter((item) => !widgetPresets.some((preset) => preset.id === item.id)).map((item) => ({ ...item, source: 'Saved' }))]
  const applyTemplate = (template: string, style?: WidgetStyle) => {
    if (style) { widgetStyleRef.current = style; setWidgetStyle(style) }
    commitWidgetText(template, true)
    setTemplateChoice('')
  }
  const commitWidgetText = (next: string, immediate = false) => {
    previewTextRef.current = next
      contentRef.current = parseWidgetDocument(next)
    setPreviewText(next)
    changed(immediate)
  }
  const updateSelectedBlock = (attrs: Record<string, unknown>) => {
    widgetEditorRef.current?.updateSelectedBlock(attrs)
    setSelectedBlock((current) => current ? { ...current, attrs: { ...current.attrs, ...attrs } } : current)
  }
  const insertImage = (image: EmbeddedImage) => {
    if (isWidget) {
      widgetEditorRef.current?.insertImage(image)
      return
    }
    const quill = quillRef.current
    if (!quill) return
    const selection = quill.getSelection(true)
    const index = selection?.index ?? Math.max(0, quill.getLength() - 1)
    if (selection?.length) quill.deleteText(index, selection.length, 'user')
    quill.insertEmbed(index, 'image', image.dataUrl, 'user')
    if (image.alt) quill.formatText(index, 1, 'alt', image.alt, 'user')
    const attribution = [
      image.creator && { text: image.creator, url: image.creatorUrl ?? image.pageUrl },
      image.license && { text: image.license, url: image.licenseUrl ?? image.pageUrl },
      image.pageUrl && { text: 'Source', url: image.pageUrl },
    ].filter((part): part is { text: string; url: string | undefined } => Boolean(part))
    if (attribution.length) {
      quill.insertText(index + 1, '\n', 'user')
      let cursor = index + 2
      attribution.forEach((part, partIndex) => {
        if (partIndex) {
          quill.insertText(cursor, ' · ', 'user')
          cursor += 3
        }
        quill.insertText(cursor, part.text, part.url ? { link: part.url } : {}, 'user')
        cursor += part.text.length
      })
      quill.insertText(cursor, '\n', 'user')
      quill.setSelection(cursor + 1, 0, 'silent')
    } else quill.setSelection(index + 1, 0, 'silent')
    contentRef.current = deltaToDocument(quill.getContents())
    changed()
  }

  return <div className="editor-modal" role="dialog" aria-modal="true" aria-label={isWidget ? 'Edit widget' : 'Edit note'} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><div className={`editor-panel ${isWidget ? 'widget-mode' : 'note-mode'}`}><div className="editor-header"><button type="button" className="text-button editor-back" onClick={onClose}>← {backLabel}</button><span className={`editor-mode-label ${isWidget ? 'active' : ''}`}>{isWidget ? 'Widget' : 'Note'}</span><span role="status" aria-live="polite" className={`save-state ${saveState.startsWith('Save failed') ? 'save-failed' : ''}`}><span className="status-dot" />{saveState}</span><button type="button" className="editor-close" aria-label="Close editor" onClick={onClose}>× Close</button></div><div className="editor-mode-toggle" role="group" aria-label="Content mode"><button type="button" className={!isWidget ? 'active' : ''} onClick={() => changeMode(false)}>Note</button><button type="button" className={isWidget ? 'active' : ''} onClick={() => changeMode(true)}>Widget</button></div><input className="title-input" value={title} onChange={(event) => { setTitle(event.target.value); titleRef.current = event.target.value; changed() }} onBlur={saveTitle} aria-label={isWidget ? 'Widget title' : 'Note title'} placeholder={isWidget ? 'Widget name' : 'Untitled note'} />{isWidget && <><div className="widget-builder-toolbar"><span className="eyebrow">Widget editor</span><button type="button" className="builder-switch" disabled={editorMode === 'syntax' && validateWidgetSyntax(previewText).length > 0} title={editorMode === 'syntax' && validateWidgetSyntax(previewText).length ? 'Fix syntax issues before opening the visual builder' : undefined} onClick={() => setEditorMode((mode) => mode === 'builder' ? 'syntax' : 'builder')}>{editorMode === 'builder' ? '</> Switch to syntax editor' : '← Back to visual builder'}</button></div>{editorMode === 'builder' && <div className="builder-panel"><aside className="builder-insert-sidebar" aria-label="Insert into widget">
  <h3>Insert</h3>
  <section className="builder-insert-category">
    <button type="button" className="builder-insert-category-toggle" aria-expanded={openInsertCategory === 'templates'} aria-controls="widget-insert-templates" onClick={() => setOpenInsertCategory((category) => category === 'templates' ? null : 'templates')}>
      <span>Templates</span><span aria-hidden="true">{openInsertCategory === 'templates' ? '▾' : '▸'}</span>
    </button>
    {openInsertCategory === 'templates' && <div className="builder-insert-category-content" id="widget-insert-templates"><div className="preset-list">{templateOptions.map((item) => <button type="button" key={`${item.source}-${item.id}`} className={`preset-card ${templateChoice === item.id ? 'selected' : ''}`} onClick={() => { setTemplateChoice(item.id); applyTemplate(item.template, item.accent) }}><span className={`preset-swatch swatch-${item.accent}`} /><span><strong>{item.name}</strong><small>{item.source}</small></span></button>)}</div></div>}
  </section>
  <section className="builder-insert-category">
    <button type="button" className="builder-insert-category-toggle" aria-expanded={openInsertCategory === 'elements'} aria-controls="widget-insert-elements" onClick={() => setOpenInsertCategory((category) => category === 'elements' ? null : 'elements')}>
      <span>Elements</span><span aria-hidden="true">{openInsertCategory === 'elements' ? '▾' : '▸'}</span>
    </button>
    {openInsertCategory === 'elements' && <div className="builder-insert-category-content" id="widget-insert-elements">
      <section className="builder-insert-subcategory"><h4>Blocks</h4><div className="builder-insert-options" role="group" aria-label="Insert widget block"><button type="button" className="builder-insert-option" aria-label="Insert heading block" onClick={() => widgetEditorRef.current?.insertBlock('heading')}><span className="insert-option-preview insert-option-preview-heading" aria-hidden="true"><i /><i className="insert-preview-medium" /><i className="insert-preview-short" /></span><span>Heading</span></button><button type="button" className="builder-insert-option" aria-label="Insert metric block" onClick={() => widgetEditorRef.current?.insertBlock('metric')}><span className="insert-option-preview insert-option-preview-metric" aria-hidden="true"><i /><i /></span><span>Metric</span></button><button type="button" className="builder-insert-option" aria-label="Insert progress block" onClick={() => widgetEditorRef.current?.insertBlock('progress')}><span className="insert-option-preview insert-option-preview-progress" aria-hidden="true"><i /><i /></span><span>Progress</span></button></div></section>
      <section className="builder-insert-subcategory"><h4>Dynamic values</h4><div className="builder-insert-options">{['notes.total', 'notes.latest_title', 'date.today'].map((key) => <button type="button" className="builder-insert-option" key={key} aria-label={`Insert ${key} dynamic value`} onClick={() => widgetEditorRef.current?.insertToken(key)}><span className={`insert-option-preview ${key === 'notes.total' ? 'insert-option-preview-token' : key === 'notes.latest_title' ? 'insert-option-preview-title' : 'insert-option-preview-date'}`} aria-hidden="true">{key === 'notes.total' ? '12' : key === 'notes.latest_title' ? <><i className="insert-preview-long" /><i className="insert-preview-medium" /></> : <><i /><i /><i /><i /><i /></>}</span><span>{key}</span></button>)}</div></section>
    </div>}
  </section>
  <section className="builder-insert-category">
    <button type="button" className="builder-insert-category-toggle" aria-expanded={openInsertCategory === 'pictures'} aria-controls="widget-insert-pictures" onClick={() => setOpenInsertCategory((category) => category === 'pictures' ? null : 'pictures')}>
      <span>Pictures</span><span aria-hidden="true">{openInsertCategory === 'pictures' ? '▾' : '▸'}</span>
    </button>
    {openInsertCategory === 'pictures' && <div className="builder-insert-category-content" id="widget-insert-pictures"><button type="button" className="builder-entry" onClick={() => setImagePickerOpen(true)}>＋ Search or upload image</button><small className="builder-muted builder-picture-note">Images are stored with this widget for offline use.</small></div>}
  </section>
</aside><div className="builder-canvas"><span className="tool-label">Your text</span><WidgetVisualEditor ref={widgetEditorRef} value={previewText} onChange={commitWidgetText} onSelectionChange={setSelectedBlock} /><p className="builder-help">Type directly in this area. Select a block to edit its properties.</p></div><aside className="builder-properties" aria-label="Selected block properties"><h3>Properties</h3>{selectedBlock ? selectedBlock.type === 'heading' ? <label>Level<select value={String(selectedBlock.attrs.level ?? 2)} onChange={(event) => updateSelectedBlock({ level: Number(event.target.value) })}><option value="1">Heading 1</option><option value="2">Heading 2</option><option value="3">Heading 3</option></select></label> : selectedBlock.type === 'widgetMetric' ? <><label>Label<input value={String(selectedBlock.attrs.label ?? '')} onChange={(event) => updateSelectedBlock({ label: event.target.value, source: `[metric: ${event.target.value} | ${String(selectedBlock.attrs.value ?? '')}]` })} /></label><label>Value<input value={String(selectedBlock.attrs.value ?? '')} onChange={(event) => updateSelectedBlock({ value: event.target.value, source: `[metric: ${String(selectedBlock.attrs.label ?? '')} | ${event.target.value}]` })} /></label></> : selectedBlock.type === 'widgetProgress' ? <><label>Label<input value={String(selectedBlock.attrs.label ?? '')} onChange={(event) => updateSelectedBlock({ label: event.target.value, source: `[progress: ${event.target.value} | ${String(selectedBlock.attrs.value ?? '')} | ${String(selectedBlock.attrs.maximum ?? '')}]` })} /></label><label>Value<input value={String(selectedBlock.attrs.value ?? '')} onChange={(event) => updateSelectedBlock({ value: event.target.value, source: `[progress: ${String(selectedBlock.attrs.label ?? '')} | ${event.target.value} | ${String(selectedBlock.attrs.maximum ?? '')}]` })} /></label><label>Maximum<input value={String(selectedBlock.attrs.maximum ?? '')} onChange={(event) => updateSelectedBlock({ maximum: event.target.value, source: `[progress: ${String(selectedBlock.attrs.label ?? '')} | ${String(selectedBlock.attrs.value ?? '')} | ${event.target.value}]` })} /></label></> : selectedBlock.type === 'widgetImage' ? <label>Alt text<input value={String(selectedBlock.attrs.alt ?? '')} onChange={(event) => updateSelectedBlock({ alt: event.target.value })} /></label> : <p className="builder-muted">Text block selected. Type in the canvas to edit it.</p> : <p className="builder-muted">Select a block in the canvas to edit its properties.</p>}</aside><div className={`builder-live-preview preview-${widgetStyle}`}><span>LIVE PREVIEW · Updates as you type</span><WidgetPreview content={previewContent(previewText)} notes={allNotes} /></div></div>}<div className={editorMode === 'syntax' ? '' : 'builder-hidden'}><SyntaxEditorPanel content={previewText} notes={allNotes} onChange={commitWidgetText} widgetStyle={widgetStyle} /></div><div className={`widget-template-picker ${editorMode === 'syntax' ? 'syntax-editor-mode builder-hidden' : 'builder-hidden'}`}><label>Start from template<select aria-label="Pick an existing widget template" value={templateChoice} onChange={(event) => { setTemplateChoice(event.target.value); const option = templateOptions.find((item) => item.id === event.target.value); if (option) applyTemplate(option.template, option.accent) }}><option value="">Keep current content</option>{templateOptions.map((item) => <option key={`${item.source}-${item.id}`} value={item.id}>{item.name} · {item.source}</option>)}</select></label><div className={`widget-inline-preview preview-${widgetStyle}`} aria-label="Widget preview"><span>Preview</span>{renderWidgetTemplate(previewContent(previewText), createTemplateValues(allNotes)).replace(/[*#>“”]/g, '').split('\n').filter(Boolean).slice(0, 3).map((line) => <p key={line}>{line}</p>)}</div></div><div className="widget-editor-options"><span>Widget style</span>{(['cream', 'yellow', 'blue', 'green', 'ink'] as const).map((item) => <button type="button" key={item} className={`style-dot dot-${item} ${widgetStyle === item ? 'active' : ''}`} aria-label={`${item} widget style`} onClick={() => changeStyle(item)} />)}</div></>}{collections.length > 0 && <label className="editor-collection"><span>Collection</span><select value={collectionId} onChange={(event) => { setCollectionId(event.target.value); collectionIdRef.current = event.target.value; changed(true) }}><option value="">No collection</option>{collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}</select></label>}{!isWidget && boards.length > 0 && <label className="editor-collection"><span>Board</span><select value={boardId} onChange={(event) => { setBoardId(event.target.value); boardIdRef.current = event.target.value; changed(true) }}><option value="">No board</option>{boards.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}  {!isWidget && <><button type="button" className="note-image-picker-button" onClick={() => setImagePickerOpen(true)}>＋ Search or upload image</button><div ref={editorRef} className="quill-editor" /></>}{imagePickerOpen && <ImagePicker onSelect={insertImage} onClose={() => setImagePickerOpen(false)} />}</div></div>
}
