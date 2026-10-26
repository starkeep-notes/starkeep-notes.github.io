import { describe, expect, it } from 'vitest'
import { plainContent, plainText } from './editorDraft'

describe('note/widget draft conversion', () => {
  it('parses raw markdown-like syntax into structured marks and tokens', () => {
    const note = plainContent('Hello **bold** and {{ notes.total }}')
    expect(note.blocks[0]).toMatchObject({ type: 'text', parts: [
      { type: 'text', text: 'Hello ' },
      { type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
      { type: 'text', text: ' and ' },
      { type: 'token', key: 'notes.total', source: '{{ notes.total }}' },
    ] })
    expect(plainText(note)).toBe('Hello **bold** and {{ notes.total }}')
  })

  it('keeps widget syntax when switching back to Note', () => {
    const widgetText = 'First line\n[metric: Total | {{ notes.total }}]'
    const note = plainContent(widgetText)
    expect(note.blocks).toHaveLength(2)
    expect(plainText(note)).toBe(widgetText)
    expect(note.type).toBe('document')
  })

  it('preserves actual line breaks, not literal backslash-n, in both directions', () => {
    const syntax = '# Heading\n{{ notes.total }}\n'
    const content = plainContent(syntax)
    expect(content.blocks).toHaveLength(3)
    expect(plainText(content)).toBe('# Heading\n{{ notes.total }}\n')
    expect(plainText(plainContent(''))).toBe('')
  })
})
