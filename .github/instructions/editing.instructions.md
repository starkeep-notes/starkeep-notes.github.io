---
description: "Use when changing note or widget editors, Tiptap formatting, syntax editing, document parsing/serialization, or widget editor behavior."
name: "Starkeep Editing"
applyTo:
  - "src/NoteEditor.tsx"
  - "src/WidgetVisualEditor.tsx"
  - "src/SyntaxCodeEditor.tsx"
  - "src/widgetDocument.ts"
  - "src/widgetDocumentAdapter.ts"
  - "src/editorDraft.ts"
  - "src/widgetSyntax.ts"
---

# Note and widget editing

- The canonical document AST lives in `src/widgetDocument.ts`; visual editing uses Tiptap, while syntax editing exposes the text form.
- Keep one draft source of truth when switching editor views. Avoid converting through a lossy intermediate format.
- Keep token identity and formatting marks structured in the AST; use the parser/serializer and adapter for conversions.
- Keep autosave and IndexedDB writes in the existing editor/repository flow. Report save failures through the existing status UI.
- Preserve keyboard access, accessible control names, focus behavior, and responsive layouts.
- Update the focused document/parser/editor tests when changing syntax, AST shapes, or toolbar commands.
