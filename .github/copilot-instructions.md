# Starkeep Project Guidelines

## Project shape
- Starkeep is a local-first React notebook built with Vite and TypeScript.
- The app stores notebook data in IndexedDB through Dexie; keep persistence origin-local and preserve backup/import behavior.
- Routing uses `HashRouter` for GitHub Pages compatibility. Keep routes refreshable under the deployed static site.
- Start with this source map; follow imports only when the task crosses a module boundary:
  - `src/App.tsx`: application shell, hash routes, global navigation and backup screen.
  - `src/NotesPage.tsx`: board, notes library, collections, trash and board interactions.
  - `src/NoteEditor.tsx`: note/widget editor orchestration, autosave, templates and image picker.
  - `src/WidgetVisualEditor.tsx`: shared Tiptap canvas and formatting toolbar; `src/SyntaxCodeEditor.tsx` is the raw syntax view.
  - `src/widgetDocument.ts`: canonical document AST plus syntax parsing/serialization; `src/widgetDocumentAdapter.ts` maps the AST to Tiptap JSON.
  - `src/types.ts`, `src/db.ts`, `src/notesRepository.ts`: domain records, Dexie schema and note persistence.
  - `src/portability.ts`: backup validation, export and import/merge behavior.
  - `src/Notebook.css`, `src/Widgets.css`, `src/BoardGroups.css`, `src/App.css`: UI styling by surface.
  - `src/*.test.ts`: Vitest unit tests next to the domain/editor modules.
- Treat `references/` as design/reference material, not application runtime code.
- Notes and widgets share the canonical editor-neutral document AST; Tiptap visual editing and the syntax editor are views over that document. Keep dynamic tokens and formatting marks structured in storage and serialize them only at the syntax/export boundary.
- Don’t broadly scan the repository by default. Read the mapped owner and its directly related tests first; expand the search only when a dependency or behavior crosses that boundary.

## Novelty widgets
- Treat “unnecessary” widgets as optional, playful micro-tools (for example, a moon-phase card, a cloud counter, a weekday countdown, or a silly-response generator). Keep them self-contained, useful at a glance, and honest about their data sources; don’t imply live weather, astronomy, or other external data without an explicit source.
- When proposing one, describe the visual template and behavior before implementation: compact card vs. interactive form, hierarchy, accent, inputs, action/result, and empty or unavailable states. Use the existing widget styles, readable contrast, responsive sizing, and accessible labels; don’t make a static metric look interactive.
- The current widget syntax supports Markdown-like headings, paragraphs, lists and inline marks, `[metric: label | value]`, `[progress: label | value | maximum]`, images, and `{{...}}` data tokens. Tokens only resolve values implemented by the renderer; do not assume a token or action exists because it appears in example text.
- A counter button, date calculation, editable form, or generated result needs behavior the current syntax cannot express. Before implementing such a widget, propose its exact declarative syntax and visual mapping for approval. For example, a conceptual `[counter: Clouds spotted | initial=0 | action=+1]` or `[countdown: Days until Friday | day=friday]` would require new parsing and runtime behavior—not just a template string.
- Keep any new syntax declarative and safe (never executable JavaScript or arbitrary HTML), and map it through the canonical document AST so syntax and visual editing stay in sync. Add parse/serialize round-trip tests and visual-editor coverage; if state persists, define its local-first storage and backup/import behavior before implementation.

## Code style
- Use the existing TypeScript, React, and CSS patterns in `src/`.
- Prefer small, typed React components and repository/helper functions over duplicating IndexedDB or browser-storage logic in components.
- Preserve accessible labels, button semantics, status/alert roles, and responsive behavior when changing UI.
- Avoid adding comments unless they clarify non-obvious behavior.

## Build and validation
- Use Node.js 22 as specified by [.nvmrc](../.nvmrc).
- Install with `npm install`; use `npm ci` in CI-like validation.
- Run `npm run lint`, `npm run build`, and focused `npm run test` checks relevant to the change.
- Do not edit generated `dist/` output; regenerate it with the build when needed.

## Delivery
- Keep changes focused and update directly related documentation when behavior changes.
- Before completing a change, verify local-first storage, import/export safety, responsive layouts, and GitHub Pages routing are not regressed.
