import type { ReactNode } from 'react'
import { createTemplateValues, renderWidgetTemplate } from './widgetTemplates'
import type { Note } from './types'
import type { DocumentAst, InlinePart } from './widgetDocument'

function renderInline(parts: InlinePart[], values: Record<string, string>): ReactNode[] {
  return parts.map((part, index) => {
    const value = renderWidgetTemplate(part.type === 'token' ? part.source ?? `{{${part.key}}}` : part.text, values)
    const content = (part.marks ?? []).reduceRight<ReactNode>((child, mark) => {
      if (mark.type === 'link') {
        try {
          const url = new URL(mark.href ?? '')
          return url.protocol === 'http:' || url.protocol === 'https:' ? <a href={url.toString()} key={`${index}-link`}>{child}</a> : child
        } catch { return child }
      }
      if (mark.type === 'bold') return <strong key={`${index}-bold`}>{child}</strong>
      if (mark.type === 'italic') return <em key={`${index}-italic`}>{child}</em>
      if (mark.type === 'underline') return <u key={`${index}-underline`}>{child}</u>
      if (mark.type === 'strike') return <s key={`${index}-strike`}>{child}</s>
      return <code key={`${index}-code`}>{child}</code>
    }, value)
    return <span key={`${part.type}-${index}`}>{content}</span>
  })
}

export function DocumentPreview({ document, notes, maxBlocks, excludeImages = false, className = '' }: { document: DocumentAst; notes: Note[]; maxBlocks?: number; excludeImages?: boolean; className?: string }) {
  const values = createTemplateValues(notes)
  const blocks = document.blocks.filter((block) => !excludeImages || block.type !== 'image').slice(0, maxBlocks)
  return <div className={`document-preview ${className}`.trim()}>{blocks.map((block) => {
    if (block.type === 'heading') { const Heading = `h${block.level}` as 'h1' | 'h2' | 'h3'; return <Heading key={block.id}>{renderInline(block.parts, values)}</Heading> }
    if (block.type === 'list') { const List = block.ordered ? 'ol' : 'ul'; return <List key={block.id}>{block.items.map((item, index) => <li key={`${block.id}-${index}`}>{renderInline(item, values)}</li>)}</List> }
    if (block.type === 'metric') return <div className="document-preview-metric" key={block.id}><span>{renderWidgetTemplate(block.label, values)}</span><strong>{renderWidgetTemplate(block.value, values)}</strong></div>
    if (block.type === 'progress') return <div className="document-preview-progress" key={block.id}><span>{renderWidgetTemplate(block.label, values)}</span><strong>{renderWidgetTemplate(block.value, values)} / {renderWidgetTemplate(block.maximum, values)}</strong></div>
    if (block.type === 'image') return <figure key={block.id}><img src={block.src} alt={block.alt} /><figcaption>{block.creator}{block.creator && block.license ? ' · ' : ''}{block.license}</figcaption></figure>
    return <p key={block.id}>{renderInline(block.parts, values)}</p>
  })}</div>
}
