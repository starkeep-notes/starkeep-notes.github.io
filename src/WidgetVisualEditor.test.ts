import { describe, expect, it } from 'vitest'
import { documentToTiptap, tiptapToDocument } from './widgetDocumentAdapter'
import { parseWidgetDocument, serializeWidgetDocument } from './widgetDocument'

describe('Tiptap widget document adapter', () => {
  it('represents template tokens as inline atomic nodes and round-trips syntax', () => {
    const document = parseWidgetDocument('Hello {{ notes.total }}\nToday')
    const json = documentToTiptap(document)
    expect(json.content?.[0]?.content?.[1]).toMatchObject({ type: 'widgetToken', attrs: { key: 'notes.total', source: '{{ notes.total }}' } })
    expect(serializeWidgetDocument(tiptapToDocument(json as { content: Array<{ type: string; content: Array<{ type: string; text?: string; attrs?: { key?: string; source?: string } }> }> }))).toBe('Hello {{ notes.total }}\nToday')
  })

  it('omits empty text nodes while preserving empty paragraphs', () => {
    const json = documentToTiptap(parseWidgetDocument(''))
    expect(json.content).toEqual([{ type: 'paragraph', content: [] }])
  })

  it('preserves inline formatting marks through the editor adapter', () => {
    const document = parseWidgetDocument('**Bold *and italic*** <u>underlined</u> ~~removed~~')
    const json = documentToTiptap(document)
    expect(json.content?.[0]?.content?.[0]).toMatchObject({ type: 'text', text: 'Bold ', marks: [{ type: 'bold' }] })
    expect(serializeWidgetDocument(tiptapToDocument(json as never))).toBe('**Bold *and italic*** <u>underlined</u> ~~removed~~')
  })

  it('preserves ordered and unordered lists through the editor adapter', () => {
    const source = '- first\n- **second**\n1. numbered\n2. next'
    const json = documentToTiptap(parseWidgetDocument(source))
    expect(json.content?.map((block) => block.type)).toEqual(['bulletList', 'orderedList'])
    expect(serializeWidgetDocument(tiptapToDocument(json as never))).toBe(source)
  })

  it('round-trips locally stored widget image blocks and attribution', () => {
    const imageSource = 'data:image/webp;base64,AAAA'
    const syntax = `![Cat](${imageSource} "${encodeURIComponent(JSON.stringify({ creator: 'Photographer', license: 'CC BY 4.0', pageUrl: 'https://example.com/photo' }))}")`
    const json = documentToTiptap(parseWidgetDocument(syntax))
    expect(json.content?.[0]).toMatchObject({ type: 'widgetImage', attrs: { src: imageSource, alt: 'Cat', creator: 'Photographer', license: 'CC BY 4.0' } })
    expect(parseWidgetDocument(serializeWidgetDocument(tiptapToDocument(json as never)))).toEqual(parseWidgetDocument(syntax))
  })
})
