# Personal-space product plan

## Product direction

Starkeep should feel like a personal space a person builds over time, not a note app with a dashboard attached. The board is the primary experience: a place to collect thoughts, save interesting discoveries, keep small reminders, display favorite quotes, track what matters, and add playful widgets with no purpose beyond delight.

The product question is **“What do you want to keep close?”** rather than **“What do you want to write?”** Notes, collections, and web references remain important, but are building blocks alongside reminders, quotes, trackers, lists, and other board cards. Prioritize quick capture, a small set of useful and expressive card types, and easy arranging before expanding the advanced widget builder.

### Image library
- [ ] Bundled static library with tags, attribution, and thumbnails.
- [ ] Image import pipeline with downscaling, format selection, and transparency handling.
- [ ] IndexedDB-backed image library, including storage estimates and export.
- [ ] Local folder indexing with explicit permission and missing-file handling.
- [ ] Advanced storage tools, batch compression, duplicate detection, and optional OPFS storage.


### Personal space

- [x] Rework the Board into a personal-space grid with summary cards, prominent actions, and Keep-inspired widget hierarchy.
- [x] Polish the compact sidebar rail and active navigation states to match the reference dashboard.
- [x] Restructure widget creation into a three-column template, customization, and live-preview builder.
- [x] Refine the syntax editor with line-oriented presentation, validation status, preview, and cheat sheet.
- [x] Rework Quill, the Tiptap widget builder, and CodeMirror around a shared draft with reliable saves and confirmed rich-text conversion.
- [x] Show a recovery screen instead of a blank page after an uncaught render error.
- [x] Document the reference visual language and verify responsive layouts, local-first backup/merge safety, and GitHub Pages hash-route refreshes.
- [x] Add persisted flexible dashboard editing with dnd-kit: drag-handle ordering, visibility, duplication, and small/medium/large widget sizing.
- [x] Add structured widget blocks: headings, metrics, progress bars, and inline dynamic values.
- [x] Add board switching, widget groups, and persisted horizontal/vertical widget resizing.
- [ ] Add widget block reordering, duplication, and deletion controls.
- [ ] Add callout, divider, list, and chart blocks with block-level validation.
- [ ] Rework widget editing into a three-pane workspace with a left insert sidebar and contextual right properties sidebar:
  - **Left sidebar — Add:** searchable template cards; block categories for text, callouts, metrics, progress, lists, dividers, and charts; dynamic-value picker grouped by notes, collections, dates, and board values; picture/image-library picker with upload, recent images, tags, attribution, and empty states.
  - **Canvas — Edit:** retain the live widget document as the center editing surface; make blocks selectable; show insertion drop targets, drag handles, duplicate/delete actions, and an accessible selected-block state without coupling persistence to UI components.
  - **Right sidebar — Configure:** render controls from the selected block type (content, dynamic binding, formatting, color, spacing, alignment, image crop/alt text, and chart settings); show widget-level settings when no block is selected; preserve direct inline editing for text and existing token popovers.
  - **State and persistence:** introduce typed selected-block and sidebar state, keep one draft source of truth for visual and syntax modes, and serialize new block attributes through `widgetDocument`/the Tiptap adapter so autosave, import/export, and local-first storage remain compatible.
  - **Responsive/accessibility:** collapse sidebars into labeled drawers on narrow screens, provide keyboard focus management and Escape-to-close behavior, use semantic labels/status announcements, and keep the preview available without requiring pointer interaction.
  - **Delivery phases:** (1) selection model and pane shell, (2) insert catalog and drag/drop insertion, (3) contextual property schemas, (4) image-library integration, (5) responsive/accessibility polish, then run focused tests plus lint/build and verify hash routing and backup/import behavior.
- [ ] add syntax for metric,...
## Board ideas

### High-value next steps
1. **Quick capture bar**  
   Add a prominent input for instantly creating notes or widgets.

2. **Widget grouping**  
   Support sections such as *Today*, *Projects*, *Reference*, and *Personal*.

3. **Board views**  
   Add presets like:
   - Focus
   - All widgets
   - Recently edited
   - Pinned only

4. **Widget filters**  
   Filter by collection, type, color, pinned state, or recently updated.

5. **Resizable dashboard columns**  
   Let users adjust grid density and column count.

6. **Widget collapse controls**  
   Collapse large widgets without hiding them.

7. **Recently edited timeline**  
   Display recent notes and widgets as a chronological activity stream.

8. **Favorites and starred notes**  
   Extend pinning with a separate favorite state for notes.

9. **Empty-state onboarding**  
   Provide starter widgets and suggested layouts for new users.

10. **Keyboard shortcuts**  
   Examples:
   - `N` — new note
   - `W` — new widget
   - `/` — search
   - `L` — toggle layout editing

### Keep-inspired polish
- More varied card sizes and playful rotations.
- Color palette selector for dashboard themes.
- Small status labels such as “Draft”, “Updated today”, or “Needs review”.
- Compact widget headers with icons and metadata.
- Pinned widgets displayed above the general widget grid.
- A “shuffle layout” action for experimentation.

### Longer-term features
- Multi-select cards for bulk hide, delete, or recolor.
- Board layout presets with save/restore.
- Import/export board layouts separately from personal-space data.
- Optional date-based cards such as calendar, countdown, and daily focus.
- Lightweight charts and statistics based on locally stored items.
