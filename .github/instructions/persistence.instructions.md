---
description: "Use when changing Starkeep domain types, Dexie schema, note and board persistence, backup/import/export, or local-first data behavior."
name: "Starkeep Persistence"
applyTo:
  - "src/types.ts"
  - "src/db.ts"
  - "src/notesRepository.ts"
  - "src/portability.ts"
---

# Persistence and domain changes

- `Note.content` is the canonical document AST. Keep serialization and Tiptap/editor conversion in their dedicated helpers, not in Dexie access or UI components.
- IndexedDB is local to the current browser origin. Do not introduce remote storage or bypass `notesRepository` for routine note writes.
- Coordinate schema changes with `src/db.ts` and backup format validation in `src/portability.ts`.
- Preserve transactional behavior for multi-record updates and validate imported data before writing.
- Test repository, migration, and backup behavior at the smallest relevant scope; never test replace/import against valuable local data.
