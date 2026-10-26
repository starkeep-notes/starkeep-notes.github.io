import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Node, mergeAttributes } from '@tiptap/core'
import { NodeViewWrapper, ReactNodeViewRenderer, useEditor, EditorContent } from '@tiptap/react'
import type { ReactNodeViewProps } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import './RichTextEditor.css'
import { parseWidgetDocument, serializeWidgetDocument } from './widgetDocument'
import { documentToTiptap, tiptapToDocument } from './widgetDocumentAdapter'
import type { EmbeddedImage } from './imageSearch'

const tokenSource = (key: string) => `{{${key}}}`

type TokenViewProps = Pick<ReactNodeViewProps, 'node' | 'updateAttributes'>
type BlockViewProps = Pick<ReactNodeViewProps, 'node' | 'updateAttributes'>
function WidgetMetricView({ node, updateAttributes }: BlockViewProps) {
  const label = String(node.attrs.label ?? '')
  const value = String(node.attrs.value ?? '')
  return <NodeViewWrapper className="widget-block-node" contentEditable={false}><label>Metric label<input aria-label="Metric label" value={label} onChange={(event) => updateAttributes({ label: event.target.value, source: `[metric: ${event.target.value} | ${value}]` })} /></label><label>Value<input aria-label="Metric value" value={value} onChange={(event) => updateAttributes({ value: event.target.value, source: `[metric: ${label} | ${event.target.value}]` })} /></label></NodeViewWrapper>
}
function WidgetProgressView({ node, updateAttributes }: BlockViewProps) {
  const label = String(node.attrs.label ?? '')
  const value = String(node.attrs.value ?? '')
  const maximum = String(node.attrs.maximum ?? '100')
  return <NodeViewWrapper className="widget-block-node" contentEditable={false}><label>Progress label<input aria-label="Progress label" value={label} onChange={(event) => updateAttributes({ label: event.target.value, source: `[progress: ${event.target.value} | ${value} | ${maximum}]` })} /></label><label>Value<input aria-label="Progress value" value={value} onChange={(event) => updateAttributes({ value: event.target.value, source: `[progress: ${label} | ${event.target.value} | ${maximum}]` })} /></label><label>Maximum<input aria-label="Progress maximum" value={maximum} onChange={(event) => updateAttributes({ maximum: event.target.value, source: `[progress: ${label} | ${value} | ${event.target.value}]` })} /></label></NodeViewWrapper>
}
function WidgetImageView({ node }: BlockViewProps) {
  const src = String(node.attrs.src ?? '')
  const alt = String(node.attrs.alt ?? '')
  const creator = String(node.attrs.creator ?? '')
  const license = String(node.attrs.license ?? '')
  const pageUrl = String(node.attrs.pageUrl ?? '')
  return <NodeViewWrapper as="figure" className="widget-image-block" contentEditable={false}><img src={src} alt={alt} /><figcaption>{creator && <span>{creator}</span>}{license && <span>{license}</span>}{pageUrl && <a href={pageUrl} target="_blank" rel="noreferrer">Source</a>}</figcaption></NodeViewWrapper>
}

const WidgetMetric = Node.create({ name: 'widgetMetric', group: 'block', atom: true, selectable: true, addAttributes: () => ({ label: { default: 'Metric' }, value: { default: '0' }, source: { default: '' } }), parseHTML: () => [{ tag: 'div[data-widget-metric]' }], renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { 'data-widget-metric': '' })], addNodeView: () => ReactNodeViewRenderer(WidgetMetricView) })
const WidgetProgress = Node.create({ name: 'widgetProgress', group: 'block', atom: true, selectable: true, addAttributes: () => ({ label: { default: 'Progress' }, value: { default: '0' }, maximum: { default: '100' }, source: { default: '' } }), parseHTML: () => [{ tag: 'div[data-widget-progress]' }], renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { 'data-widget-progress': '' })], addNodeView: () => ReactNodeViewRenderer(WidgetProgressView) })
const WidgetImage = Node.create({ name: 'widgetImage', group: 'block', atom: true, selectable: true, addAttributes: () => ({ src: { default: '' }, alt: { default: '' }, title: { default: '' }, pageUrl: { default: '' }, creator: { default: '' }, creatorUrl: { default: '' }, license: { default: '' }, licenseUrl: { default: '' } }), parseHTML: () => [{ tag: 'figure[data-widget-image]' }], renderHTML: ({ HTMLAttributes }) => ['figure', mergeAttributes({ 'data-widget-image': '' }, { 'data-src': HTMLAttributes.src, 'data-alt': HTMLAttributes.alt, 'data-title': HTMLAttributes.title, 'data-page-url': HTMLAttributes.pageUrl, 'data-creator': HTMLAttributes.creator, 'data-creator-url': HTMLAttributes.creatorUrl, 'data-license': HTMLAttributes.license, 'data-license-url': HTMLAttributes.licenseUrl })], addNodeView: () => ReactNodeViewRenderer(WidgetImageView) })
function WidgetTokenView({ node, updateAttributes }: TokenViewProps) {
  const key = String(node.attrs.key ?? '')
  const source = String(node.attrs.source ?? '')
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(tokenSource(key))
  const popoverRef = useRef<HTMLSpanElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || !popoverRef.current?.contains(event.target)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setOpen(false)
      requestAnimationFrame(() => triggerRef.current?.focus())
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer)
    document.addEventListener('keydown', closeOnEscape)
    return () => { document.removeEventListener('pointerdown', closeOnOutsidePointer); document.removeEventListener('keydown', closeOnEscape) }
  }, [open])
  const save = () => {
    const match = draft.trim().match(/^\{\{\s*([\w.]+)(?:\s*\|[^}]+)?\s*\}\}$/)
    if (match) { updateAttributes({ key: match[1], source: draft.trim() }); setOpen(false) }
  }
  return <NodeViewWrapper ref={popoverRef} as="span" className="builder-token-wrap" data-widget-token={key} contentEditable={false}>
    <button ref={triggerRef} type="button" className="builder-token" onClick={() => { setDraft(source || tokenSource(key)); setOpen(true) }} aria-label={`Dynamic value ${key}. Edit token`}>{key}</button>
    {open && <span className="token-popover" role="dialog" aria-label="Edit token syntax"><label>Token syntax<input autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') save() }} /></label><span className="token-popover-actions"><button type="button" onClick={save}>Save</button><button type="button" className="text-button" onClick={() => { setOpen(false); requestAnimationFrame(() => triggerRef.current?.focus()) }}>Cancel</button></span></span>}
  </NodeViewWrapper>
}

const WidgetToken = Node.create({
  name: 'widgetToken',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  marks: '_',
  addAttributes: () => ({ key: { default: '' }, source: { default: '' } }),
  parseHTML: () => [{ tag: 'span[data-widget-token]' }],
  renderHTML: ({ HTMLAttributes }) => ['span', mergeAttributes(HTMLAttributes, { 'data-widget-token': HTMLAttributes.key }), 0],
  addNodeView: () => ReactNodeViewRenderer(WidgetTokenView),
})

export type WidgetBlockSelection = { type: 'heading' | 'paragraph' | 'widgetMetric' | 'widgetProgress' | 'widgetImage'; attrs: Record<string, unknown> }
export type WidgetVisualEditorHandle = { setValue: (value: string) => void; insertToken: (key: string) => void; insertBlock: (type: 'heading' | 'metric' | 'progress') => void; insertImage: (image: EmbeddedImage) => void; updateSelectedBlock: (attrs: Record<string, unknown>) => void }
type Props = { value: string; onChange: (value: string) => void; onSelectionChange?: (selection: WidgetBlockSelection | null) => void }

export const WidgetVisualEditor = forwardRef<WidgetVisualEditorHandle, Props>(function WidgetVisualEditor({ value, onChange, onSelectionChange }, ref) {
  const valueRef = useRef(value)
  const onChangeRef = useRef(onChange)
  const [selectionVersion, setSelectionVersion] = useState(0)
  useEffect(() => { onChangeRef.current = onChange }, [onChange])
  const editor = useEditor({ extensions: [StarterKit.configure({ blockquote: false, codeBlock: false, horizontalRule: false }), WidgetToken, WidgetMetric, WidgetProgress, WidgetImage], content: documentToTiptap(parseWidgetDocument(value)), onUpdate: ({ editor: current }) => { const next = serializeWidgetDocument(tiptapToDocument(current.getJSON())); if (next !== valueRef.current) { valueRef.current = next; onChangeRef.current(next) } }, onSelectionUpdate: ({ editor: current }) => { setSelectionVersion((version) => version + 1); const selection = current.state.selection; const node = ('node' in selection && selection.node ? selection.node : selection.$from.parent) as { type: { name: string }; attrs: Record<string, unknown> }; const supported = ['heading', 'paragraph', 'widgetMetric', 'widgetProgress', 'widgetImage'].includes(node.type.name); onSelectionChange?.(supported ? { type: node.type.name as WidgetBlockSelection['type'], attrs: { ...node.attrs } } : null) }, editorProps: { attributes: { class: 'widget-tiptap-content', 'aria-label': 'Your text' } } })
  useEffect(() => { if (editor && value !== valueRef.current) { valueRef.current = value; editor.commands.setContent(documentToTiptap(parseWidgetDocument(value)), { emitUpdate: false }) } }, [editor, value])
  useImperativeHandle(ref, () => ({ setValue: (next) => { valueRef.current = next; editor?.commands.setContent(documentToTiptap(parseWidgetDocument(next)), { emitUpdate: false }) }, insertToken: (key) => { if (!editor) return; editor.chain().focus().insertContent({ type: 'widgetToken', attrs: { key, source: tokenSource(key) } }).run() }, insertBlock: (type) => { if (!editor) return; const content = type === 'heading' ? { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'New heading' }] } : type === 'metric' ? { type: 'widgetMetric', attrs: { label: 'Metric', value: '0', source: '[metric: Metric | 0]' } } : { type: 'widgetProgress', attrs: { label: 'Progress', value: '0', maximum: '100', source: '[progress: Progress | 0 | 100]' } }; editor.chain().focus().insertContent(content).run() }, insertImage: (image) => { if (!editor) return; editor.chain().focus().insertContent({ type: 'widgetImage', attrs: { src: image.dataUrl, alt: image.alt, title: image.title, pageUrl: image.pageUrl, creator: image.creator, creatorUrl: image.creatorUrl, license: image.license, licenseUrl: image.licenseUrl } }).run() }, updateSelectedBlock: (attrs) => { if (!editor) return; const selection = editor.state.selection; if ('node' in selection && selection.node) editor.commands.updateAttributes((selection.node as { type: { name: string } }).type.name, attrs); else if (selection.$from.parent.type.name === 'heading') editor.commands.updateAttributes('heading', attrs) } }), [editor])
  const format = (label: string, active: boolean, run: () => void) => <button type="button" key={label} className={active ? 'active' : ''} aria-label={label} aria-pressed={active} onMouseDown={(event) => event.preventDefault()} onClick={run}>{label}</button>
  const insertLink = () => {
    if (!editor) return
    const current = editor.getAttributes('link').href as string | undefined
    const href = window.prompt('Link URL', current ?? 'https://')
    if (href === null) return
    if (!href.trim()) editor.chain().focus().unsetLink().run()
    else editor.chain().focus().extendMarkRange('link').setLink({ href: href.trim() }).run()
  }
  return <div className="builder-text">
    <div className="rich-format-toolbar" role="toolbar" aria-label="Text formatting" data-selection-version={selectionVersion}>
      {format('Bold', editor?.isActive('bold') ?? false, () => editor?.chain().focus().toggleBold().run())}
      {format('Italic', editor?.isActive('italic') ?? false, () => editor?.chain().focus().toggleItalic().run())}
      {format('Underline', editor?.isActive('underline') ?? false, () => editor?.chain().focus().toggleUnderline().run())}
      {format('Strikethrough', editor?.isActive('strike') ?? false, () => editor?.chain().focus().toggleStrike().run())}
      {format('Heading 1', editor?.isActive('heading', { level: 1 }) ?? false, () => editor?.chain().focus().toggleHeading({ level: 1 }).run())}
      {format('Heading 2', editor?.isActive('heading', { level: 2 }) ?? false, () => editor?.chain().focus().toggleHeading({ level: 2 }).run())}
      {format('Bullet list', editor?.isActive('bulletList') ?? false, () => editor?.chain().focus().toggleBulletList().run())}
      {format('Numbered list', editor?.isActive('orderedList') ?? false, () => editor?.chain().focus().toggleOrderedList().run())}
      {format('Link', editor?.isActive('link') ?? false, insertLink)}
    </div>
    <EditorContent editor={editor} />
  </div>
})
