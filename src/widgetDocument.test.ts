import { describe, expect, it } from 'vitest'
import { insertTokenAfterBlock, mergeWidgetBlocks, parseInlineParts, parseWidgetDocument, serializeWidgetDocument, splitTextBlock, updateTextPart } from './widgetDocument'

describe('structured widget documents', () => {
  it('round-trips text, tokens, and blocks to template syntax', () => {
    const source = 'Hello {{ notes.total }}\nToday: {{date.today}}'
    expect(serializeWidgetDocument(parseWidgetDocument(source))).toBe(source)
  })

  it('keeps token parts separate from surrounding text', () => {
    expect(parseInlineParts('A {{x}} B')).toEqual([
      { type: 'text', text: 'A ' },
      { type: 'token', key: 'x', source: '{{x}}' },
      { type: 'text', text: ' B' },
    ])
  })

  it('round-trips inline formatting syntax and dynamic tokens', () => {
    const source = '**Bold *and italic***, ~~removed~~, <u>underlined</u>, [link](https://example.com), and **{{notes.total}}**'
    const document = parseWidgetDocument(source)
    expect(serializeWidgetDocument(document)).toBe(source)
    expect(document.blocks[0]).toMatchObject({
      type: 'text',
      parts: expect.arrayContaining([
        { type: 'text', text: 'Bold ', marks: [{ type: 'bold' }] },
        { type: 'text', text: 'and italic', marks: [{ type: 'bold' }, { type: 'italic' }] },
        { type: 'text', text: 'removed', marks: [{ type: 'strike' }] },
        { type: 'text', text: 'underlined', marks: [{ type: 'underline' }] },
        { type: 'text', text: 'link', marks: [{ type: 'link', href: 'https://example.com' }] },
        { type: 'token', key: 'notes.total', source: '{{notes.total}}', marks: [{ type: 'bold' }] },
      ]),
    })
  })

  it('splits and merges blocks without losing inline parts', () => {
    const document = parseWidgetDocument('Hello world')
    const split = splitTextBlock(document, 0, 0, 5)
    expect(serializeWidgetDocument(split)).toBe('Hello\n world')
    expect(serializeWidgetDocument(mergeWidgetBlocks(split, 0, 1))).toBe('Hello world')
  })

  it('round-trips headings, metrics, and progress blocks', () => {
    const source = '# Overview\n[metric: Notes | {{notes.total}}]\n[progress: Goal | 62 | 100]'
    const document = parseWidgetDocument(source)
    expect(document.blocks.map((block) => block.type)).toEqual(['heading', 'metric', 'progress'])
    expect(serializeWidgetDocument(document)).toBe(source)
  })

  it('round-trips locally stored images with safe attribution metadata', () => {
    const dataUrl = 'data:image/webp;base64,AAAA'
    const metadata = encodeURIComponent(JSON.stringify({ title: 'A cat', pageUrl: 'https://commons.wikimedia.org/wiki/File:Cat.jpg', creator: 'A creator', license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/' }))
    const source = `![${encodeURIComponent('A [cat]')}](${dataUrl} "${metadata}")`
    const document = parseWidgetDocument(source)
    expect(document.blocks).toEqual([{
      type: 'image',
      id: 'image-0',
      src: dataUrl,
      alt: 'A [cat]',
      title: 'A cat',
      pageUrl: 'https://commons.wikimedia.org/wiki/File:Cat.jpg',
      creator: 'A creator',
      license: 'CC BY 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    }])
    expect(serializeWidgetDocument(document)).toBe(source)
  })

  it('rejects non-HTTP image attribution links', () => {
    const metadata = encodeURIComponent(JSON.stringify({ pageUrl: 'javascript:alert(1)', creatorUrl: 'data:text/html,unsafe' }))
    const document = parseWidgetDocument(`![cat](data:image/webp;base64,AAAA "${metadata}")`)
    expect(document.blocks[0]).toMatchObject({ type: 'image', pageUrl: undefined, creatorUrl: undefined })
  })

  it('updates text and inserts a token in the selected block', () => {
    let document = parseWidgetDocument('Draft\nSecond')
    document = updateTextPart(document, 1, 0, 'Updated')
    document = insertTokenAfterBlock(document, 1, 'notes.total')
    expect(serializeWidgetDocument(document)).toBe('Draft\nUpdated\n{{notes.total}}')
  })
})
