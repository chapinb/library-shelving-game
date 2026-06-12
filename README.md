# 📚 Shelf It! — Library Sorting Game

A drag-and-drop game that teaches US students in grades 2–6 how to shelve library
books in order by **call number** (Dewey Decimal) and **author cutter** letters.

## How to play

Just **double-click `index.html`** — it opens in any web browser. No install, no
internet, no setup. Works with a mouse or a touchscreen (e.g. Chromebooks).

1. Pick a level (Grade 2 → Grade 6).
2. Drag each book from the unsorted pile onto the shelf, in order.
3. **Correct** spot → the book snaps in. **Wrong** spot → it bounces back with a
   hint that teaches the rule.
4. Fill the whole shelf to win, then choose another level.

## Levels

| Level | Grade | What it teaches |
|-------|-------|-----------------|
| 1 | 2 | Fiction, by author's first letter |
| 2 | 3 | Fiction, same first letter — compare the next letters |
| 3 | 4 | Dewey whole numbers (+ a little fiction), fill left-to-right |
| 4 | 5 | Dewey with one decimal place |
| 5 | 6 | Dewey with two close decimals + a fiction section |

## For developers

- `index.html` — page shell and styles
- `js/engine.js` — pure ordering/checking logic (no DOM)
- `js/books.js` — curated book data and level definitions
- `js/ui.js` — rendering and pointer drag-and-drop
- `test/` — unit tests for the engine and data integrity

Run the tests with:

```bash
npm test
```

Design notes live in `docs/superpowers/specs/`.
