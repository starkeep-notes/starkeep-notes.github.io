import { describe, expect, it } from 'vitest'
import Delta from 'quill-delta'
import { deltaToDocument, plainContent, plainText } from './editorDraft'

describe('note/widget draft conversion', () => {
  it('flattens formatted notes and embeds to widget syntax only as plain text', () => {
    const note = deltaToDocument(new Delta().insert('Hello ', { bold: true }).insert({ image: 'data:image/png;base64,x' }).insert('{{ notes.total }}\n'))
        expect(plainText(note)).toBe('\nHello {{ notes.total }}')
        expect(plainContent('{{ notes.total }}').blocks[0]).toMatchObject({ type: 'text', parts: [{ type: 'token', key: 'notes.total', source: '{{ notes.total }}' }] })
  })

  it('keeps a widget draft as plain Quill content when switching back to Note', () => {
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
