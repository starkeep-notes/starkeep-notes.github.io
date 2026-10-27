# Starkeep

Starkeep is a local-first personal space for the things you want to keep close: passing thoughts, interesting finds, little reminders, favorite quotes, personal trackers, and completely unnecessary widgets that make you smile. Rather than centering a note editor, it centers an editable board where these pieces can live together.

Notes, collections, and optional web references remain useful building blocks, but they support the board rather than defining the product. The compact sticker workspace keeps a searchable library alongside the board and editor on larger screens, then shifts to a single-pane view on phones. Use the theme selector in the navigation rail to switch between Sticker, Quiet minimal, and Dark ink; your choice stays on this device.

## Local development

Requirements: Node.js 22 (see [.nvmrc](./.nvmrc)).

```bash
npm install
npm run dev
```

Run the quality checks before opening a pull request:

```bash
npm run lint
npm run build
```

## Editing cards

Notes and widgets are the same note record with one canonical document AST; the selected mode controls editor tools and board rendering, not note identity. Tiptap visual editing and the syntax editor are views over that document. Formatting marks and dynamic tokens remain structured in storage, while syntax mode exposes Markdown-like formatting and widget block syntax. Changes are saved locally in this browser.

## Boards

Boards are stored locally as one collection of note records, rendered in note or widget mode. Membership, grouping, ordering, dragging, and resizing are shared across both modes; only card rendering and widget-specific actions differ. Shared placement and resize interactions read both current and legacy note/widget layout fields without normalizing existing records or migrating the database. Create named board groups to arrange either kind of card; ungrouped notes and widgets appear together in a shared “No group” area, which is a view rather than a persisted group. Existing widget labels migrate safely to matching groups. Select a note, widget, or group on a board to reveal its actions, including an accessible board picker for moving it. Use **Resize** on a selected card or group to reveal visual right- and bottom-edge drag handles: notes support six width steps and five height steps; widgets support eight width steps (including legacy `wide` cards) and five height steps; groups support 1–4 columns and compact, normal, or tall height. The visible select and button controls remain available when dragging is not practical. Click the board background or press Escape to close board selections. Select the active board again, double-click its name, or use the board settings panel to rename or delete it without relying on a pointer gesture. A board cannot be deleted when it is the last board; when another board exists, deleting a board moves its notes and widgets to that board.

## Visual language

The designs in [`references/`](./references/) are inspiration, not runtime assets. The [dashboard](./references/note-widget/keep-dashboard.html), [widget builder](./references/note-widget/keep-widget-builder.html), and [syntax editor](./references/note-widget/keep-widget-syntax.html) illustrate the compact notebook rail, expressive widget cards, and side-by-side editing. The sample screens also show [tablet](./references/1keep%20%E2%80%94%20note%20app%20sample%20screens_files/tablet-two-pane.html) and [mobile](./references/1keep%20%E2%80%94%20note%20app%20sample%20screens_files/mobile-editor.html) layouts.

- **Sticker (default):** warm paper, yellow accents, dark outlines and offset shadows; Inter for controls and Caveat for display headings. **Quiet minimal** softens borders and shadows; **Dark ink** uses dark surfaces with the same yellow accent. Theme tokens live in [`src/Notebook.css`](./src/Notebook.css).
- **Layout:** the desktop icon rail keeps the board and notes close at hand. At 760px the rail moves above the content; at 580px the note list and editor become separate panes and board widgets stack in one column. Widget template layouts collapse from three columns to two and then one.
- **Interaction:** use labeled controls and visible focus states; show save/validation status in text, not color alone. Keep the widget preview adjacent to its editor when space permits. Respect reduced-motion preferences.

## Verification

Build and preview the static site with `npm run build` and `npm run preview`. Check the board, notes, widget editor, templates, and backup at desktop, tablet, and phone widths; refresh a `/#/board/notes/<note-id>` URL to test static hosting. In a disposable local origin, create a note, wait for “Saved locally,” and refresh it; export a backup, merge it to check collision handling, and confirm an invalid backup is rejected. Only test **Replace notebook** on disposable data, since it clears local records after confirmation. The deployed GitHub Pages site also serves `/#/backup` after a refresh.

## GitHub Pages

The `main` branch deploys through [GitHub Actions](./.github/workflows/deploy.yml) to [starkeep-notes.github.io](https://starkeep-notes.github.io/). The app uses hash routing, so notebook routes remain available when refreshed on GitHub Pages.

## Local-first storage

The notebook will store data in IndexedDB in the browser. Storage belongs to the exact origin, so localhost, the deployed site, and any future custom domain have separate notebooks. Use **Backup & recovery** in the navigation to export a versioned JSON backup or import one from another origin/device. Imports are validated before writing; merge assigns new IDs when needed, while replace clears the current notebook only after confirmation. Backups preserve notes, collections, web references, boards, named board groups, and card layout settings; “No group” is not stored as a group.  Version 1 backups remain importable.
