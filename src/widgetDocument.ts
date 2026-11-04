export type InlineMark = { type: 'bold' | 'italic' | 'underline' | 'strike' | 'code' | 'link'; href?: string }
export type TextPart = { type: 'text'; text: string; marks?: InlineMark[] }
export type TokenPart = { type: 'token'; key: string; source?: string; marks?: InlineMark[] }
export type InlinePart = TextPart | TokenPart
export type TextBlock = { type: 'text'; id: string; parts: InlinePart[] }
export type HeadingBlock = { type: 'heading'; id: string; level: 1 | 2 | 3; parts: InlinePart[] }
export type ListBlock = { type: 'list'; id: string; ordered: boolean; items: InlinePart[][] }
export type MetricBlock = { type: 'metric'; id: string; label: string; value: string; source?: string }
export type ProgressBlock = { type: 'progress'; id: string; label: string; value: string; maximum: string; source?: string }
export type ImageBlock = { type: 'image'; id: string; src: string; alt: string; title?: string; pageUrl?: string; creator?: string; creatorUrl?: string; license?: string; licenseUrl?: string }
export type DocumentBlock = TextBlock | HeadingBlock | ListBlock | MetricBlock | ProgressBlock | ImageBlock
/** Canonical, editor-neutral document AST persisted for every note and widget. */
export type DocumentAst = { type: 'document'; blocks: DocumentBlock[] }

const imagePattern = /^!\[([^\]]*)\]\((data:image\/(?:png|jpeg|webp|gif|avif);base64,[A-Za-z0-9+/=]+)(?:\s+"([^"]*)")?\)$/i

const safeHttpUrl = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : undefined
  } catch {
    return undefined
  }
}

function parseImageLine(line: string, id: string): ImageBlock | undefined {
  const match = line.match(imagePattern)
  if (!match) return undefined
  let rawMetadata: Record<string, unknown> = {}
  try {
    const value: unknown = JSON.parse(decodeURIComponent(match[3] ?? ''))
    if (typeof value === 'object' && value !== null) rawMetadata = value as Record<string, unknown>
  } catch {
    rawMetadata = {}
  }
  let alt = match[1]
  try { alt = decodeURIComponent(alt) } catch { /* Keep malformed encoded alt text readable. */ }
  const textValue = (key: string) => typeof rawMetadata[key] === 'string' ? (rawMetadata[key] as string).slice(0, 500) : undefined
  return { type: 'image', id, src: match[2], alt, title: textValue('title'), pageUrl: safeHttpUrl(rawMetadata.pageUrl), creator: textValue('creator'), creatorUrl: safeHttpUrl(rawMetadata.creatorUrl), license: textValue('license'), licenseUrl: safeHttpUrl(rawMetadata.licenseUrl) }
}

export function parseInlineParts(template: string, marks: InlineMark[] = []): InlinePart[] {
  const parts: InlinePart[] = []
  const appendText = (text: string) => {
    if (!text) return
    const previous = parts.at(-1)
    if (previous?.type === 'text' && JSON.stringify(previous.marks ?? []) === JSON.stringify(marks)) previous.text += text
    else parts.push({ type: 'text', text, ...(marks.length ? { marks: [...marks] } : {}) })
  }
  let cursor = 0
  while (cursor < template.length) {
    const rest = template.slice(cursor)
    const token = rest.match(/^\{\{\s*([\w.]+)(?:\s*\|[^}]+)?\s*\}\}/)
    if (token) {
      const key = token[1]
      parts.push({ type: 'token', key, source: token[0], ...(marks.length ? { marks: [...marks] } : {}) })
      cursor += token[0].length
      continue
    }
    const link = rest.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/)
    if (link) {
      parts.push(...parseInlineParts(link[1], [...marks, { type: 'link', href: link[2] }]))
      cursor += link[0].length
      continue
    }
    const delimiter = ['**', '~~', '*', '_', '`', '++', '<u>'].find((item) => rest.startsWith(item))
    if (delimiter) {
      const closing = delimiter === '<u>' ? '</u>' : delimiter
      let closingIndex = rest.indexOf(closing, delimiter.length)
      if (delimiter === '**' && rest[closingIndex + 2] === '*') closingIndex++
      if (closingIndex > delimiter.length) {
        const mark: InlineMark = { type: delimiter === '**' ? 'bold' : delimiter === '~~' ? 'strike' : delimiter === '`' ? 'code' : delimiter === '<u>' || delimiter === '++' ? 'underline' : 'italic' }
        parts.push(...parseInlineParts(rest.slice(delimiter.length, closingIndex), [...marks, mark]))
        cursor += closingIndex + closing.length
        continue
      }
    }
    const special = rest.search(/{{|\[|\*\*|~~|\*|_|`|\+\+|<u>/)
    const length = special < 0 ? rest.length : Math.max(1, special)
    appendText(rest.slice(0, length))
    cursor += length
  }
  if (!parts.length) parts.push({ type: 'text', text: '', ...(marks.length ? { marks: [...marks] } : {}) })
  return parts
}

export function parseWidgetDocument(template: string): DocumentAst {
  const lines = template.split('\n')
  const blocks: DocumentBlock[] = []
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    const image = parseImageLine(line, `image-${index}`)
    if (image) { blocks.push(image); continue }
    const heading = line.match(/^(#{1,3})\s+(.*)$/)
    const metric = line.match(/^\[metric:\s*(.*?)\s*\|\s*(.*?)\]$/i)
    const progress = line.match(/^\[progress:\s*(.*?)\s*\|\s*(.*?)\s*\|\s*(.*?)\]$/i)
    const bullet = line.match(/^\s*[-*]\s+(.*)$/)
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/)
    if (bullet || numbered) {
      const ordered = Boolean(numbered)
      const items = [(bullet ?? numbered)![1]]
      while (index + 1 < lines.length) {
        const next = lines[index + 1].match(ordered ? /^\s*\d+[.)]\s+(.*)$/ : /^\s*[-*]\s+(.*)$/)
        if (!next) break
        items.push(next[1])
        index++
      }
      blocks.push({ type: 'list', id: `list-${index - items.length + 1}`, ordered, items: items.map((item) => parseInlineParts(item)) })
      continue
    }
    if (heading) blocks.push({ type: 'heading', id: `heading-${index}`, level: heading[1].length as 1 | 2 | 3, parts: parseInlineParts(heading[2]) })
    else if (metric) blocks.push({ type: 'metric', id: `metric-${index}`, label: metric[1], value: metric[2], source: line })
    else if (progress) blocks.push({ type: 'progress', id: `progress-${index}`, label: progress[1], value: progress[2], maximum: progress[3], source: line })
    else blocks.push({ type: 'text', id: `text-${index}`, parts: parseInlineParts(line) })
  }
  return { type: 'document', blocks }
}

export function serializeInlineParts(parts: InlinePart[]): string {
  const openMark = (mark: InlineMark) => mark.type === 'link' ? '[' : mark.type === 'bold' ? '**' : mark.type === 'italic' ? '*' : mark.type === 'underline' ? '<u>' : mark.type === 'strike' ? '~~' : '`'
  const closeMark = (mark: InlineMark) => mark.type === 'link' ? `](${mark.href ?? ''})` : mark.type === 'bold' ? '**' : mark.type === 'italic' ? '*' : mark.type === 'underline' ? '</u>' : mark.type === 'strike' ? '~~' : '`'
  let previous: InlineMark[] = []
  let output = ''
  for (const part of parts) {
    const current = part.marks ?? []
    let common = 0
    while (common < previous.length && common < current.length && previous[common].type === current[common].type && previous[common].href === current[common].href) common++
    for (let index = previous.length - 1; index >= common; index--) output += closeMark(previous[index])
    for (let index = common; index < current.length; index++) output += openMark(current[index])
    output += part.type === 'token' ? part.source ?? `{{${part.key}}}` : part.text
    previous = current
  }
  for (let index = previous.length - 1; index >= 0; index--) output += closeMark(previous[index])
  return output
}

export function serializeWidgetDocument(document: DocumentAst): string {
  return document.blocks.map((block) => {
    if (block.type === 'text') return serializeInlineParts(block.parts)
    if (block.type === 'heading') return `${'#'.repeat(block.level)} ${serializeInlineParts(block.parts)}`
    if (block.type === 'list') return block.items.map((parts, index) => `${block.ordered ? `${index + 1}.` : '-'} ${serializeInlineParts(parts)}`).join('\n')
    if (block.type === 'metric') return block.source ?? `[metric: ${block.label} | ${block.value}]`
    if (block.type === 'progress') return block.source ?? `[progress: ${block.label} | ${block.value} | ${block.maximum}]`
    const metadata = encodeURIComponent(JSON.stringify({ title: block.title, pageUrl: block.pageUrl, creator: block.creator, creatorUrl: block.creatorUrl, license: block.license, licenseUrl: block.licenseUrl }))
    return `![${encodeURIComponent(block.alt)}](${block.src} "${metadata}")`
  }).join('\n')
}

export function logicalLength(parts: InlinePart[]): number {
  return serializeInlineParts(parts).length
}

export function replaceToken(parts: InlinePart[], index: number, key: string): InlinePart[] {
  return parts.map((part, partIndex) => partIndex === index && part.type === 'token' ? { type: 'token', key } : part)
}

function textPart(text: string): TextPart { return { type: 'text', text } }
function copyBlock(block: TextBlock | HeadingBlock, parts: InlinePart[], id = block.id): TextBlock | HeadingBlock { return block.type === 'heading' ? { ...block, id, parts } : { ...block, id, parts } }

export function updateTextPart(document: DocumentAst, blockIndex: number, partIndex: number, text: string): DocumentAst {
  return { type: 'document', blocks: document.blocks.map((block, index) => index !== blockIndex || !('parts' in block) ? block : copyBlock(block, block.parts.map((part, partIndexToUpdate) => partIndexToUpdate === partIndex && part.type === 'text' ? textPart(text) : part))) }
}

export function splitTextBlock(document: DocumentAst, blockIndex: number, partIndex: number, offset: number): DocumentAst {
  const block = document.blocks[blockIndex]
  const part = block && 'parts' in block ? block.parts[partIndex] : undefined
  if (!block || !('parts' in block) || !part || part.type !== 'text') return document
  const before = [...block.parts.slice(0, partIndex), textPart(part.text.slice(0, offset))]
  const after = [textPart(part.text.slice(offset)), ...block.parts.slice(partIndex + 1)]
  const blocks = [...document.blocks]
  blocks.splice(blockIndex, 1, copyBlock(block, before), copyBlock(block, after, `${block.id}-next`))
  return { type: 'document', blocks }
}

export function mergeWidgetBlocks(document: DocumentAst, firstIndex: number, secondIndex: number): DocumentAst {
  const first = document.blocks[firstIndex]
  const second = document.blocks[secondIndex]
  if (!first || !second || secondIndex !== firstIndex + 1 || !('parts' in first) || !('parts' in second)) return document
  const parts = [...first.parts]
  if (parts.at(-1)?.type === 'text' && second.parts[0]?.type === 'text') {
    const left = parts.pop() as TextPart
    const right = second.parts[0] as TextPart
    parts.push(textPart(left.text + right.text), ...second.parts.slice(1))
  } else parts.push(...second.parts)
  const blocks = document.blocks.filter((_, index) => index !== secondIndex).map((block, index) => index === firstIndex ? copyBlock(first, parts) : block)
  return { type: 'document', blocks: blocks.length ? blocks : [{ type: 'text', id: 'text-0', parts: [textPart('')] }] }
}

export function insertTokenAfterBlock(document: DocumentAst, blockIndex: number, key: string): DocumentAst {
  const block = document.blocks[blockIndex] ?? document.blocks.at(-1)
  if (!block) return { type: 'document', blocks: [{ type: 'text', id: 'text-0', parts: [{ type: 'token', key }] }] }
  if (!('parts' in block)) return document
  const index = document.blocks.indexOf(block)
  const tokenBlock = { type: 'text' as const, id: `${block.id}-value-${document.blocks.length}`, parts: [{ type: 'token' as const, key }, textPart('')] }
  const blocks = [...document.blocks]
  blocks.splice(index + 1, 0, tokenBlock)
  return { type: 'document', blocks }
}
