import Delta from 'quill-delta'
import type { NoteContent } from './types'
import { parseInlineParts, serializeInlineParts, type DocumentBlock, type InlinePart } from './widgetDocument'

/** Text rendering is intentionally a view choice; tokens remain structured in storage. */
export function plainText(content: NoteContent): string {
  return content.blocks.map((block) => {
    if (block.type === 'text') return serializeInlineParts(block.parts)
    if (block.type === 'heading') return `${'#'.repeat(block.level)} ${serializeInlineParts(block.parts)}`
    if (block.type === 'metric') return `[metric: ${block.label} | ${block.value}]`
    if (block.type === 'progress') return `[progress: ${block.label} | ${block.value} | ${block.maximum}]`
    return ''
  }).join('\n')
}

export function plainContent(text: string): NoteContent {
  return { type: 'document', blocks: text.split('\n').map((line, index) => ({ type: 'text', id: `text-${index}`, parts: parseInlineParts(line) })) }
}

export function deltaToDocument(delta: Delta): NoteContent {
  const blocks: DocumentBlock[] = []
  let parts: InlinePart[] = []
  let blockIndex = 0
  const flush = (attributes?: Record<string, unknown>) => {
    const text = serializeInlineParts(parts)
    const id = `text-${blockIndex++}`
    const level = attributes?.header
    blocks.push(level ? { type: 'heading', id, level: Math.min(3, Number(level)) as 1 | 2 | 3, parts } : { type: 'text', id, parts })
    parts = []
    return text
  }
  for (const op of delta.ops) {
    if (typeof op.insert !== 'string') {
      if (typeof op.insert === 'object' && op.insert && 'image' in op.insert) blocks.push({ type: 'image', id: `image-${blockIndex++}`, src: String(op.insert.image), alt: '', })
      continue
    }
    const lines = op.insert.split('\n')
    lines.forEach((line, index) => { if (line) parts.push(...parseInlineParts(line)); if (index < lines.length - 1) flush(op.attributes as Record<string, unknown> | undefined) })
  }
  if (parts.length || blocks.length === 0) flush()
  return { type: 'document', blocks }
}

export function documentToDelta(content: NoteContent): Delta {
  const delta = new Delta()
  content.blocks.forEach((block) => {
    if (block.type === 'image') delta.insert({ image: block.src }).insert('\\n')
    else if (block.type === 'text') delta.insert(serializeInlineParts(block.parts)).insert('\\n')
    else if (block.type === 'heading') delta.insert(serializeInlineParts(block.parts)).insert('\\n', { header: block.level })
    else if (block.type === 'metric') delta.insert(`[metric: ${block.label} | ${block.value}]\\n`)
    else if (block.type === 'progress') delta.insert(`[progress: ${block.label} | ${block.value} | ${block.maximum}]\\n`)
  })
  return delta
}
