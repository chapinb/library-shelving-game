# Book Pool & Criteria-Based Sampling — Design

## Problem

Each level currently uses a fixed, hand-tuned list of books in `js/books.js`. Every
player sees the same titles and the same solution on every load (only the unsorted
pile's left-to-right order is shuffled). There is no replay variety, and a child can
memorize the answer rather than learn the shelving rule.

## Goal

Give each level genuine replay variety using **real, recognizable, grade-appropriate
books** (Vermont Golden Dome / former DCF award list, classics, and real children's
nonfiction), while preserving each level's teaching goal and the guarantee that every
playable set has exactly one correct order.

## Decisions (locked during brainstorming)

1. **Hand-curated real books**, not procedurally generated.
2. **Sources:** Golden Dome (DCF) award list + classics + grade-appropriate titles.
3. **Criteria-based sampling:** one shared tagged book database; each level defines
   sampling *rules*, not a fixed book list.
4. **Nonfiction Dewey:** a modest, carefully verified set (~40–60 books); large fiction
   pools (~100+). Nonfiction variety is smaller but accurate.

## Non-goals

- Audio narration, progress/score persistence, sound effects (explicitly deferred).
- Procedurally generated or approximate Dewey numbers.
- Changing the drag/keyboard/hint/win interactions, or the `file://` classic-script
  loading model.

## Source notes

The Vermont Golden Dome Book Award (formerly the Dorothy Canfield Fisher Children's
Book Award) covers **grades 4–8** with ~30 mostly-fiction chapter books per year. It is
therefore used for the **upper-grade fiction** (levels 4–6) only. Grades 2–3 fiction
(levels 1–2) comes from classics / early readers. All **nonfiction** comes from real
children's nonfiction with verified Dewey numbers, independent of the award list.

## Architecture

Three layers and the dependency direction are unchanged: pure logic in `engine.js`,
data in `books.js`, DOM in `ui.js`. Sampling is pure logic and lives in `engine.js`
(keeps the classic-script count at three; no new global).

### A. Data model (`js/books.js`)

Replace the five fixed `LEVELS[].books` arrays with one shared database plus level
definitions that carry sampling criteria.

**Book record:**

```js
// Fiction: shelved by cutter; dewey is null.
{ title, author, callType: "fiction", dewey: null, cutter, grades: [min, max], source }
// Nonfiction: shelved by dewey, ties broken by cutter.
{ title, author, callType: "dewey", dewey: "523", cutter, grades: [min, max], source }
```

- `cutter` — stored explicitly (uppercase author-letters, e.g. `"SEU"` for Dr. Seuss),
  so edge cases are controlled rather than derived.
- `grades` — `[min, max]` grade band the book suits, used to filter by level grade.
- `source` — `"golden-dome" | "classic" | "nonfiction"` (provenance tag).
- Decimal depth of a Dewey number is derived at sample time (digits after `"."`), not
  stored. `color` is assigned at sample time, not stored.

**Level definition:**

```js
{ id, grade, name, instructions, count, mode, preplaced, criteria }
```

- `count` — number of books in a play of this level.
- `mode` — `"fixed"` (all slots empty) or `"preplaced"` (some sorted positions locked).
- `preplaced` — integer count of locked anchor positions (0 for `"fixed"`).
- `criteria` — sampling rule (see B).

Level criteria:

| Level | grade | count | mode | preplaced | criteria |
|-------|-------|-------|------|-----------|----------|
| 1 | 2 | 5 | fixed | 0 | `{ type:"fiction", maxGrade:3, firstLetters:"distinct" }` |
| 2 | 3 | 6 | fixed | 0 | `{ type:"fiction", maxGrade:4, firstLetters:"shared" }` |
| 3 | 4 | 7 | fixed | 0 | `{ type:"mixed", ficCount:2, deweyDecimals:0 }` |
| 4 | 5 | 8 | preplaced | 2 | `{ type:"dewey", deweyDecimals:1 }` |
| 5 | 6 | 10 | preplaced | 3 | `{ type:"mixed", ficCount:2, deweyDecimals:2 }` |

`maxGrade` filters fiction to books whose grade band is at or below the cutoff so young
players see age-appropriate titles. `deweyDecimals` filters nonfiction by decimal depth
(0 = whole numbers like `523`; 1 = `597.9`; 2 = `636.78`).

### B. Sampling engine (`js/engine.js`, pure + seeded)

New pure function:

```js
sampleLevel(level, books, rng) -> Book[]   // rng: () => number in [0,1)
```

`rng` is injected so tests are deterministic. Returns a validated set of `level.count`
books. Strategy by criteria:

- **`firstLetters:"distinct"`** (L1): group fiction candidates by author first letter,
  choose `count` distinct letters, take one book per letter. Guarantees the "first
  letter" lesson always holds and sort keys are distinct.
- **`firstLetters:"shared"`** (L2): choose a first-letter cluster with at least `count`
  books, sample `count` from it. All share a first letter; ties break on later letters.
- **`type:"dewey"`** (L4): filter nonfiction to the required decimal depth and grade,
  sample `count`.
- **`type:"mixed"`** (L3, L5): sample `ficCount` fiction + `count - ficCount` nonfiction
  at the required decimal depth. Engine ordering already shelves all nonfiction before
  fiction.

**Validation:** every candidate set is checked to have **distinct sort keys** (no two
books tie under `compareBooks`). On failure the sampler resamples (bounded retries).
The pool-feasibility tests (C) guarantee a valid sample always exists, so the bounded
retry never exhausts in practice; if it ever does, `sampleLevel` throws rather than
returning an ambiguous set.

`compareBooks`, `correctOrder`, `isCorrectPlacement`, and `hintFor` are unchanged.

### C. Tests

**Sampler tests** (`test/engine.test.js`, seeded `rng`):

- L1 sample: `count` books, all fiction, all distinct author first letters.
- L2 sample: `count` books, all fiction, all sharing one first letter.
- L4 sample: all nonfiction at the right decimal depth.
- L3/L5 mixed: correct fiction/nonfiction counts; all nonfiction sort before all fiction.
- Every sample is unambiguous (no tied sort keys) and matches `level.count`.
- Sampling is deterministic for a fixed seed.

**Pool-feasibility tests** (`test/books.test.js`) — the safety net that prevents a
"can't sample" runtime failure:

- Every fiction record: `dewey === null`, cutter matches `/^[A-Z]{3}$/`, valid `grades`.
- Every nonfiction record: parseable `dewey`, cutter present, valid `grades`.
- For each level, the DB contains enough qualifying books to satisfy its criteria:
  - L1: ≥ `count` distinct first letters among fiction with `grades` ≤ `maxGrade`.
  - L2: ≥ one first-letter cluster with ≥ `count` fiction books (≤ `maxGrade`).
  - L3/L4/L5: ≥ the required nonfiction count at each decimal depth, and ≥ `ficCount`
    qualifying fiction for mixed levels.
- Existing data checks (unambiguous solutions, unique titles, nonfiction-before-fiction)
  are re-expressed against sampled sets or the pool as appropriate.

### D. Data volume & sourcing

- **Fiction (~100+):** early-readers/classics tagged `grades:[1,3]` for L1/L2; Golden
  Dome + classics tagged `grades:[4,6]` for upper levels. Includes at least one or two
  **same-first-letter clusters of ≥6 books** so L2 always has a cluster to sample.
- **Nonfiction (~40–60):** real children's nonfiction with verified Dewey, spread across:
  - whole numbers for L3 (≥7 books, e.g. 398.2 folklore, 523 astronomy, 591 zoology,
    636 pets, 745 crafts, 793/795 games);
  - one decimal for L4 (≥8 books, e.g. 567.9, 595.7, 597.3, 597.9, 636.1, 636.7, 636.8,
    639.3);
  - two decimals for L5 (≥8 books, e.g. 523.43, 523.45, 599.x, 636.72–636.78).
  - Real-world long Dewey numbers are truncated to kid-friendly lengths.

### E. UI (`js/ui.js`) — minimal change

`startLevel(level)` calls `engine.sampleLevel(level, BOOKS, Math.random)`, assigns spine
colors to the sampled set (the `withColors` step moves here from the data file), then
proceeds exactly as today: `correctOrder` → build slots → lock `preplaced` anchor
positions (evenly spaced across the sorted order) → shuffle the pile. Drag, keyboard,
tap-to-place, hints, and the win flow are untouched.

## Implementation order (for the plan)

1. Sampler + sampler tests in `engine.js` / `engine.test.js`, exercised against a small
   fixture DB (small, pure, fully testable first).
2. Pool-feasibility tests in `books.test.js` (define the contract the data must meet).
3. Populate `BOOKS` and `LEVELS` until the feasibility tests pass (bulk data entry).
4. Wire `startLevel` to the sampler and move color assignment into the UI.

Steps 1–2 are small logic/test work; step 3 is bulk data that must satisfy the
contract from step 2. They are separated so the data effort is validated automatically.
