import type { NoteContent } from './types'
import { parseWidgetDocument, serializeWidgetDocument } from './widgetDocument'

/** Text rendering is intentionally a view choice; tokens remain structured in storage. */
export function plainText(content: NoteContent): string {
  return serializeWidgetDocument(content)
}

export function plainContent(text: string): NoteContent {
  return parseWidgetDocument(text)
}
