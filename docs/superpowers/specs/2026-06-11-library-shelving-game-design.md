# Library Shelving Game — Design

## Summary

A browser-based educational game where US students in grades 2–6 shelve books
in correct library order by **call number and author cutter**. Students drag
books from an unsorted pile onto a bookshelf. Feedback is instant: correct
placements snap in with a positive cue; wrong placements bounce back to the pile
with a short hint teaching the sorting rule. The game has 5 difficulty levels,
one per grade band, ramping from fiction (sort by author) to Dewey decimals with
close decimal places.

## Goals

- Teach real library shelving order (Dewey Decimal numbers + author "cutter"
  letters, plus fiction-by-author).
- Provide instant, encouraging feedback with rule-teaching hints.
- Run fully locally in a browser with no install, build step, or internet —
  suitable for school Chromebooks.

## Non-Goals (YAGNI)

- No scoring, stars, timers, or accounts.
- No backend, persistence, or network calls.
- No procedurally generated content (books are curated).
- No accessibility-beyond-basics work in this first version (keyboard-only play
  is out of scope; pointer/touch is the supported input).

## Platform & Architecture

A single dependency-free web app that opens by double-clicking `index.html`.

- `index.html` — page shell and styles.
- `js/books.js` — curated book pool and the 5 level definitions (data only).
- `js/engine.js` — **pure logic** (no DOM): computes sort keys, the correct
  order for a set of books, and whether a placement is correct. Unit-tested.
- `js/ui.js` — rendering the shelf and pile, pointer-based drag handling,
  feedback and hint display, level menu and success flow.

**Input:** pointer events (`pointerdown`/`pointermove`/`pointerup`) so the same
code path works for mouse and touchscreen Chromebooks. The legacy HTML5
drag-and-drop API is intentionally avoided because it does not work on touch.

## Screen Layout

Layout "A": the **bookshelf sits on top**, the **unsorted pile sits below it**.

- The shelf is a wooden-styled horizontal strip holding book "spines" (vertical
  colored rectangles) with a readable call-number label and short title.
- The pile is a loosely-scattered group of draggable spines.
- A title/instruction line and a hint line sit near the top.

## The Five Levels

| Level | Grade | Book count | Sort rule | Shelf mode |
|-------|-------|-----------|-----------|------------|
| 1 | 2 | 5 | Fiction, by author's **first letter** (all different) | Fixed empty slots |
| 2 | 3 | 6 | Fiction, by author — **same first letter**, compare 2nd/3rd | Fixed empty slots |
| 3 | 4 | 7 | Dewey **whole numbers** (e.g. 591, 636, 921) + a little fiction | Insert into sorted row |
| 4 | 5 | 8 | Dewey **one decimal** (e.g. 636.1 vs 636.7) | A few pre-placed + insert |
| 5 | 6 | 10 | Dewey **two close decimals** (e.g. 636.73 vs 636.78) + fiction mixed | A few pre-placed + insert |

Difficulty rises through (1) more books, (2) closer decimal places, and (3) a
more demanding shelf-interaction mode.

### Shelf interaction modes

All three modes share one ordering engine (an ordered list of positions, each
with a single correct book). They differ only in presentation:

- **Fixed empty slots** (Levels 1–2): every position renders as a visible empty
  slot. Dropping a book on a slot checks whether that book belongs in that
  position.
- **Insert into sorted row** (Level 3): only placed books and the gaps between
  them are shown; dropping a book into a gap assigns it that ordered position
  and checks correctness against its neighbors.
- **Pre-placed + insert** (Levels 4–5): the shelf starts with a few books
  already correctly placed and locked; the student inserts the rest.

## Sorting Rule

- **Nonfiction (Dewey):** compare the Dewey number as a left-to-right numeric
  value (e.g. 636.73 < 636.78). Ties on the Dewey number are broken by the
  author **cutter** letters, compared alphabetically.
- **Fiction:** compare the author cutter letters alphabetically (e.g. ADL < ROW).
- **Mixed shelf (Level 5):** the shelf is divided into two labeled sections —
  the **nonfiction section (numbers) shelves first**, then the **fiction
  section** — with a small visual divider so the two-part order reads clearly.
  Within each section the rules above apply.

## Interaction & Feedback

- Student drags a book spine from the pile to a shelf position.
- **Correct placement** → the book snaps into place with a green flash and a
  short positive chime; it stays on the shelf.
- **Wrong placement** → the book bounces back to the pile, and a short hint
  appears automatically, teaching the rule for that comparison, e.g.:
  - Dewey: *"636.7 comes before 636.8 — compare the numbers."*
  - Fiction: *"ADL comes before ROW — compare the letters."*
- Hints appear **only automatically on a wrong drop** — there is no on-demand
  hint button.
- When every position is filled correctly → a celebration/success message →
  return to the level menu.

## Data Model

Each book:

```
{
  title:    string,   // e.g. "Dogs"
  author:   string,   // full author name, for display
  callType: "dewey" | "fiction",
  dewey:    string | null,  // e.g. "636.73" (null for fiction)
  cutter:   string,   // author letters, e.g. "ROW"
  color:    string    // spine color
}
```

Books are curated, recognizable children's titles with plausible Dewey numbers
and author cutters. A level definition references a set of books plus its shelf
mode and (for pre-placed modes) which positions start filled.

## Engine (pure, testable)

`js/engine.js` exposes pure functions, e.g.:

- `sortKey(book)` — comparable key encoding section, Dewey value, and cutter.
- `correctOrder(books)` — the books sorted into canonical shelf order.
- `isCorrectPlacement(book, positionIndex, levelBooks)` — whether `book` belongs
  at `positionIndex` in the level's correct order.

These have **no DOM dependencies** and are unit-tested with Node's built-in
`node:test` runner (no third-party test dependency).

## Testing Strategy

- **Engine:** unit tests for sort key ordering, full-level correct order, and
  placement checks — including the close-decimal cases (636.73 vs 636.78), the
  cutter tie-breaks, and the Level 5 nonfiction-then-fiction division.
- **UI:** verified manually in the browser (drag, snap, bounce-back, hint text,
  success flow) across all 5 levels.

## Open Questions

None outstanding; design approved.
