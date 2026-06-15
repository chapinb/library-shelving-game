# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"Shelf It!" — a zero-dependency, zero-build browser game that teaches grades 2–6 to
shelve library books by Dewey call number and author cutter. Runs by double-clicking
`index.html` (no server). Tests run in Node.

## Commands

- `npm test` — run all tests (`node --test`).
- Run a single test file: `node --test test/engine.test.js`.
- Run by name: `node --test --test-name-pattern "sorts by cutter"`.
- No build, lint, or install step. There are no third-party dependencies.

## Architecture

Three layers with a strict dependency direction; respect the boundaries when editing:

- `js/engine.js` — **pure** ordering/comparison logic, no DOM. The single source of
  truth for shelf order. Tested directly.
- `js/books.js` — **data only**, no logic: curated books and the 5 level definitions.
- `js/ui.js` — DOM rendering and pointer drag-and-drop. Wires the engine to the page;
  contains no ordering rules. New correctness logic belongs in `engine.js`, not here.

### The classic-script / `file://` constraint (do not break)

All three JS files are UMD-style: a `(root, factory)` wrapper that exports via
`module.exports` under Node and assigns a global (`window.ShelfEngine`, `window.ShelfBooks`)
in the browser. `index.html` loads them as **classic** `<script>` tags in order:
`engine.js` → `books.js` → `ui.js` (ui depends on the other two globals).

This is deliberate: ES modules are blocked by CORS when opening the page from a
`file://` URL. **Do not convert to ESM `import`/`export`** or the double-click-to-play
workflow breaks. Keep the load order intact when adding scripts.

### Shelf ordering rule

Canonical order is lexicographic over `[section, dewey, cutter]`: all nonfiction
(`callType: "dewey"`) before fiction (`callType: "fiction"`); within nonfiction by
numeric Dewey value, ties broken by uppercased cutter letters; within fiction by cutter.
Dewey is compared as a parsed number, never as a string. A book is correct at a slot
when its sort key matches the expected book there, so equal-key books are interchangeable.

### Levels

Each level: `{ id, grade, name, instructions, mode, preplaced, books }`.
`mode: "fixed"` starts all slots empty; `mode: "preplaced"` locks the slot indices in
`preplaced` as anchors. `test/books.test.js` enforces data integrity: book counts,
that every level has an **unambiguous** solution (no tied books), valid preplaced
indices, spine colors, and no fiction/nonfiction interleaving. Adding or editing a
level means keeping those invariants true.

## Specs

Design notes: `docs/superpowers/specs/2026-06-11-library-shelving-game-design.md`.
