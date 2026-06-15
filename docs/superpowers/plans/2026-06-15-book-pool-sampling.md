# Book Pool & Criteria-Based Sampling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace fixed per-level book lists with a shared tagged book database that each level samples from by criteria, giving real replay variety.

**Architecture:** Pure sampling logic in `js/engine.js` (seeded, testable); a tagged book pool + criteria-only level definitions in `js/books.js`; `js/ui.js` samples a fresh set per play and assigns colors. The three classic-script files and their load order are unchanged.

**Tech Stack:** Vanilla JS (classic scripts / UMD factory), `node --test`, no dependencies.

**Spec:** `docs/superpowers/specs/2026-06-15-book-pool-sampling-design.md`

---

### Task 1: Sampling helpers + fiction sampling (`sampleLevel`)

**Files:**
- Modify: `js/engine.js` (add helpers + `sampleLevel`; extend the returned API object at line 64)
- Test: `test/engine.test.js` (append)

- [ ] **Step 1: Write failing tests for fiction sampling**

Append to `test/engine.test.js`:

```js
const { sampleLevel } = require("../js/engine.js");

// Deterministic RNG (mulberry32) so samples are reproducible in tests.
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const fic = (cutter, grades = [2, 3]) =>
  ({ title: cutter, author: cutter, callType: "fiction", dewey: null, cutter, grades });

const FIC_DB = ["ADL","BAR","BLU","BRO","BUN","BYA","COL","DAH","LOB","MOR","PAR","SEU","WHI","ZIM"]
  .map((c) => fic(c));

test("fiction 'distinct' sample has the right count and all distinct first letters", () => {
  const level = { count: 5, criteria: { type: "fiction", maxGrade: 3, firstLetters: "distinct" } };
  const picked = sampleLevel(level, FIC_DB, seeded(1));
  assert.equal(picked.length, 5);
  const firsts = picked.map((b) => b.cutter[0]);
  assert.equal(new Set(firsts).size, 5);
});

test("fiction 'shared' sample has the right count and one shared first letter", () => {
  const cluster = ["BAR","BLU","BRO","BUN","BYA","BEE","BOO"].map((c) => fic(c));
  const level = { count: 6, criteria: { type: "fiction", maxGrade: 4, firstLetters: "shared" } };
  const picked = sampleLevel(level, cluster.concat(FIC_DB), seeded(3));
  assert.equal(picked.length, 6);
  assert.equal(new Set(picked.map((b) => b.cutter[0])).size, 1);
});

test("sampleLevel respects maxGrade", () => {
  const db = [fic("AAA", [5, 6]), fic("BBB", [2, 3]), fic("CCC", [2, 3]), fic("DDD", [2, 3])];
  const level = { count: 3, criteria: { type: "fiction", maxGrade: 3, firstLetters: "distinct" } };
  const picked = sampleLevel(level, db, seeded(2));
  assert.ok(picked.every((b) => b.grades[0] <= 3));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test --test-name-pattern "fiction|maxGrade" 2>&1 | grep -E "not ok|# fail"`
Expected: failures — `sampleLevel` is not exported / not a function.

- [ ] **Step 3: Implement helpers + fiction sampling**

In `js/engine.js`, before the `return { ... }` line, add (minimal bodies):

```js
const firstLetter = (b) => b.cutter.charAt(0).toUpperCase();
const gradeOk = (b, maxGrade) => maxGrade == null || b.grades[0] <= maxGrade;

// Fisher-Yates over a copy using the injected rng; returns the first n.
function sampleN(arr, n, rng) { /* shuffle copy with rng, slice(0, n) */ }

// No two books may share a sort key (otherwise the puzzle is ambiguous).
function unambiguous(books) { /* correctOrder, scan adjacent compareBooks !== 0 */ }

// Group fiction candidates by first letter into { letter: Book[] }.
function byFirstLetter(books) { /* reduce into a map */ }

function sampleLevel(level, books, rng) {
  const c = level.criteria;
  for (let attempt = 0; attempt < 100; attempt++) {
    let picked;
    if (c.type === "fiction" && c.firstLetters === "distinct") {
      // pick `count` distinct letters, one book each
    } else if (c.type === "fiction" && c.firstLetters === "shared") {
      // pick a letter cluster with >= count books, sampleN from it
    }
    if (picked && picked.length === level.count && unambiguous(picked)) return picked;
  }
  throw new Error(`could not sample level ${level.id}`);
}
```

Extend the API object (currently `js/engine.js:64`):

```js
return { compareBooks, correctOrder, isCorrectPlacement, hintFor, sampleLevel };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test --test-name-pattern "fiction|maxGrade" 2>&1 | grep -E "# (pass|fail)"`
Expected: all pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add js/engine.js test/engine.test.js
git commit -F - <<'EOF'
FFF Add criteria-based fiction sampling to the engine

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
```

---

### Task 2: Dewey and mixed sampling

**Files:**
- Modify: `js/engine.js` (`sampleLevel` branches + a `deweyDepth` helper)
- Test: `test/engine.test.js` (append)

- [ ] **Step 1: Write failing tests for dewey + mixed sampling**

Append to `test/engine.test.js`:

```js
const dew = (dewey, cutter, grades = [4, 6]) =>
  ({ title: cutter, author: cutter, callType: "dewey", dewey, cutter, grades });

const NONFIC = [
  dew("523", "GIB"), dew("591", "REE"), dew("398.2", "GRI"), dew("636", "GAG"),
  dew("567.9", "DIX"), dew("595.7", "PYE"), dew("597.3", "MUS"), dew("636.1", "BUD"),
  dew("523.43", "ZIM"), dew("523.45", "BRA"), dew("636.72", "ADA"), dew("636.73", "BAR"),
];

test("dewey sample matches the requested decimal depth", () => {
  const level = { count: 3, criteria: { type: "dewey", deweyDecimals: 1 } };
  const picked = sampleLevel(level, NONFIC, seeded(5));
  assert.equal(picked.length, 3);
  assert.ok(picked.every((b) => /^\d+\.\d$/.test(b.dewey)));
});

test("mixed sample has the right fiction/nonfiction split, nonfiction sorts first", () => {
  const db = NONFIC.concat(FIC_DB);
  const level = { count: 5, criteria: { type: "mixed", ficCount: 2, deweyDecimals: 0 } };
  const picked = sampleLevel(level, db, seeded(7));
  assert.equal(picked.filter((b) => b.callType === "fiction").length, 2);
  assert.equal(picked.filter((b) => b.callType === "dewey").length, 3);
  const order = correctOrder(picked).map((b) => b.callType);
  assert.equal(order.indexOf("fiction"), order.lastIndexOf("dewey") + 1);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test --test-name-pattern "decimal depth|mixed sample" 2>&1 | grep -E "not ok|# fail"`
Expected: failures (no dewey/mixed branch yet).

- [ ] **Step 3: Implement dewey + mixed branches**

Add the depth helper near the other helpers in `js/engine.js`:

```js
// Digits after the decimal point: "636" -> 0, "597.9" -> 1, "636.78" -> 2.
const deweyDepth = (b) => {
  const dot = b.dewey.indexOf(".");
  return dot === -1 ? 0 : b.dewey.length - dot - 1;
};
```

Add branches inside the `sampleLevel` attempt loop:

```js
} else if (c.type === "dewey") {
  const pool = books.filter((b) => b.callType === "dewey"
    && gradeOk(b, c.maxGrade) && deweyDepth(b) === c.deweyDecimals);
  picked = sampleN(pool, level.count, rng);
} else if (c.type === "mixed") {
  const nf = books.filter((b) => b.callType === "dewey" && deweyDepth(b) === c.deweyDecimals);
  const fc = books.filter((b) => b.callType === "fiction");
  picked = sampleN(nf, level.count - c.ficCount, rng).concat(sampleN(fc, c.ficCount, rng));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test 2>&1 | grep -E "# (pass|fail)"`
Expected: all pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add js/engine.js test/engine.test.js
git commit -F - <<'EOF'
FFF Add dewey and mixed criteria sampling to the engine

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
```

---

### Task 3: Evenly-spaced preplaced anchor indices

**Files:**
- Modify: `js/engine.js` (`anchorIndices` + export)
- Test: `test/engine.test.js` (append)

- [ ] **Step 1: Write failing test**

```js
const { anchorIndices } = require("../js/engine.js");

test("anchorIndices spaces n locked positions across the shelf", () => {
  assert.deepEqual(anchorIndices(0, 8), []);
  assert.deepEqual(anchorIndices(1, 8), [0]);
  assert.deepEqual(anchorIndices(2, 8), [0, 7]);
  assert.deepEqual(anchorIndices(3, 10), [0, 5, 9]);
  const idx = anchorIndices(3, 10);
  assert.equal(new Set(idx).size, idx.length); // no duplicates
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --test-name-pattern "anchorIndices" 2>&1 | grep -E "not ok|# fail"`
Expected: failure — `anchorIndices` not exported.

- [ ] **Step 3: Implement**

```js
// n positions spread evenly over [0, total-1]; [] for n<=0, [0] for n===1.
function anchorIndices(n, total) {
  if (n <= 0) return [];
  if (n === 1) return [0];
  return Array.from({ length: n }, (_, i) => Math.round((i * (total - 1)) / (n - 1)));
}
```

Add `anchorIndices` to the returned API object.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test --test-name-pattern "anchorIndices" 2>&1 | grep -E "# (pass|fail)"`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add js/engine.js test/engine.test.js
git commit -F - <<'EOF'
FFF Add evenly-spaced preplaced anchor index helper

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
```

---

### Task 4: Convert `books.js` to a pool + criteria, with feasibility tests

**Files:**
- Modify: `js/books.js` (replace `LEVELS` body and `withColors`/`COLORS` usage; export `BOOKS` + `LEVELS`)
- Rewrite: `test/books.test.js`

This task replaces the data SHAPE and the tests that guard it. The pool starts with the
books migrated from the current levels; Task 5 expands it until feasibility passes.

- [ ] **Step 1: Rewrite `test/books.test.js` as feasibility + sampling-integration tests**

```js
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { BOOKS, LEVELS } = require("../js/books.js");
const { sampleLevel, correctOrder, compareBooks } = require("../js/engine.js");

const fiction = BOOKS.filter((b) => b.callType === "fiction");
const nonfiction = BOOKS.filter((b) => b.callType === "dewey");
const depth = (b) => { const d = b.dewey.indexOf("."); return d === -1 ? 0 : b.dewey.length - d - 1; };

test("there are 5 levels for grades 2-6", () => {
  assert.deepEqual(LEVELS.map((l) => l.grade), [2, 3, 4, 5, 6]);
});

test("every fiction record is well formed", () => {
  for (const b of fiction) {
    assert.equal(b.dewey, null);
    assert.match(b.cutter, /^[A-Z]{3}$/);
    assert.ok(Array.isArray(b.grades) && b.grades.length === 2);
  }
});

test("every nonfiction record has a parseable dewey and a cutter", () => {
  for (const b of nonfiction) {
    assert.match(b.dewey, /^\d+(\.\d+)?$/);
    assert.match(b.cutter, /^[A-Z]{3}$/);
  }
});

// Feasibility: the pool can satisfy each level's criteria.
test("L1 has enough distinct first letters (fiction, grade <= 3)", () => {
  const letters = new Set(fiction.filter((b) => b.grades[0] <= 3).map((b) => b.cutter[0]));
  assert.ok(letters.size >= 5, `only ${letters.size} first letters`);
});

test("L2 has a first-letter cluster of >= 6 fiction books (grade <= 4)", () => {
  const groups = {};
  for (const b of fiction.filter((b) => b.grades[0] <= 4)) (groups[b.cutter[0]] ||= []).push(b);
  assert.ok(Object.values(groups).some((g) => g.length >= 6), "no cluster of 6");
});

for (const [decimals, need] of [[0, 5], [1, 8], [2, 8]]) {
  test(`nonfiction has >= ${need} books at ${decimals} decimal places`, () => {
    assert.ok(nonfiction.filter((b) => depth(b) === decimals).length >= need);
  });
}

// Integration: many random plays of each level stay valid.
test("every sampled play is the right size and unambiguous", () => {
  for (const level of LEVELS) {
    for (let i = 0; i < 50; i++) {
      const picked = sampleLevel(level, BOOKS, Math.random);
      assert.equal(picked.length, level.count);
      const ordered = correctOrder(picked);
      for (let j = 1; j < ordered.length; j++) {
        assert.notEqual(compareBooks(ordered[j - 1], ordered[j]), 0, `tie in level ${level.id}`);
      }
      const types = ordered.map((b) => b.callType);
      const firstFic = types.indexOf("fiction");
      if (firstFic !== -1) assert.ok(types.slice(firstFic).every((t) => t === "fiction"));
    }
  }
});

test("book titles are unique within any sampled play (UI identifies by title)", () => {
  for (const level of LEVELS) {
    const titles = sampleLevel(level, BOOKS, Math.random).map((b) => b.title);
    assert.equal(new Set(titles).size, titles.length);
  }
});
```

- [ ] **Step 2: Convert `js/books.js` data shape**

Replace the `LEVELS` array (`js/books.js:35-122`) and the factory return. Keep the UMD
wrapper. Remove `withColors`/`COLORS` (color now lives in `ui.js`). New structure:

```js
// Tagged pool. Migrate the existing curated books here as the starting set, adding
// `grades` and `source` to each. Fiction: dewey null. Nonfiction: real dewey.
const BOOKS = [
  { title: "Frog and Toad Are Friends", author: "Arnold Lobel",
    callType: "fiction", dewey: null, cutter: "LOB", grades: [1, 3], source: "classic" },
  { title: "The Planets", author: "Gail Gibbons",
    callType: "dewey", dewey: "523", cutter: "GIB", grades: [3, 5], source: "nonfiction" },
  // ... (Task 5 expands this pool)
];

const LEVELS = [
  { id: 1, grade: 2, name: "Level 1 · Grade 2",
    instructions: "Put the storybooks in order by the author's last name. Look at the first letter!",
    count: 5, mode: "fixed", preplaced: 0,
    criteria: { type: "fiction", maxGrade: 3, firstLetters: "distinct" } },
  { id: 2, grade: 3, name: "Level 2 · Grade 3",
    instructions: "These authors share a first letter! Use the next letters to put them in order.",
    count: 6, mode: "fixed", preplaced: 0,
    criteria: { type: "fiction", maxGrade: 4, firstLetters: "shared" } },
  { id: 3, grade: 4, name: "Level 3 · Grade 4",
    instructions: "Shelve the number books from smallest to biggest, then the storybooks.",
    count: 7, mode: "fixed", preplaced: 0,
    criteria: { type: "mixed", ficCount: 2, deweyDecimals: 0 } },
  { id: 4, grade: 5, name: "Level 4 · Grade 5",
    instructions: "These books use one decimal place. A few are already shelved — fit the rest in.",
    count: 8, mode: "preplaced", preplaced: 2,
    criteria: { type: "dewey", deweyDecimals: 1 } },
  { id: 5, grade: 6, name: "Level 5 · Grade 6",
    instructions: "Two decimal places — read carefully! Number books first, then storybooks.",
    count: 10, mode: "preplaced", preplaced: 3,
    criteria: { type: "mixed", ficCount: 2, deweyDecimals: 2 } },
];

return { BOOKS, LEVELS };
```

- [ ] **Step 3: Run tests**

Run: `node --test 2>&1 | grep -E "# (pass|fail)|not ok"`
Expected: feasibility tests likely FAIL until Task 5 populates enough books. Sampler/engine
tests pass. This is expected; do not force-pass by weakening tests.

- [ ] **Step 4: Commit (tests + shape)**

```bash
git add js/books.js test/engine.test.js test/books.test.js
git commit -F - <<'EOF'
FFF Convert level data to a tagged pool with criteria-based selection

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
```

---

### Task 5: Populate the book pool until feasibility passes

**Files:**
- Modify: `js/books.js` (`BOOKS` array)

The feasibility tests from Task 4 are the contract. Add real, grade-appropriate books
until they pass. Sourcing per the spec (Section D):

- **Fiction grades 1–3 (~40+):** classics / early readers spanning many first letters, with
  **at least one first-letter cluster of ≥6 authors** (e.g. B: Barrows, Blume, Bridwell,
  Brown, Bunting, Byars, …) for Level 2.
- **Fiction grades 4–6 (~60+):** Vermont Golden Dome list titles + classics.
- **Nonfiction (~40–60), verified real Dewey, truncated to kid lengths:**
  - 0 decimals (≥5): e.g. 398.2, 523, 591, 636, 745, 793.
  - 1 decimal (≥8): e.g. 567.9, 595.7, 597.3, 597.9, 636.1, 636.7, 636.8, 639.3.
  - 2 decimals (≥8): e.g. 523.43, 523.45, 599.51, 636.72, 636.73, 636.75, 636.78, 599.77.

Record format (every field required):

```js
{ title, author, callType, dewey, cutter, grades: [min, max], source }
```

`cutter` = first three letters of the author's last name, uppercased.

- [ ] **Step 1: Add fiction and nonfiction records to `BOOKS`** until counts satisfy the feasibility tests.

- [ ] **Step 2: Run tests**

Run: `node --test 2>&1 | grep -E "# (pass|fail)|not ok"`
Expected: all pass, 0 fail (feasibility + 50× sampling integration green).

- [ ] **Step 3: Commit**

```bash
git add js/books.js
git commit -F - <<'EOF'
FFF Populate book pool with Golden Dome, classics, and verified nonfiction

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
```

---

### Task 6: Wire the UI to sample a fresh set per play

**Files:**
- Modify: `js/ui.js` (`startLevel` at `js/ui.js:171-177`; the globals line `js/ui.js:8`; add `COLORS`/`withColors`)

- [ ] **Step 1: Update the globals destructure and add color assignment**

Change `js/ui.js:8` from `const { LEVELS } = window.ShelfBooks;` to:

```js
const { BOOKS, LEVELS } = window.ShelfBooks;
const { correctOrder, isCorrectPlacement, hintFor, sampleLevel, anchorIndices } = window.ShelfEngine;
```

Add near the top of the IIFE (moved from `books.js`):

```js
const COLORS = ["#3b6ea5","#a5453b","#3f7a4f","#8a5ca5","#946012","#1f7a7a","#a53b6e","#566021","#5c5ca5","#7a4f24"];
const withColors = (books) => books.map((b, i) => ({ ...b, color: COLORS[i % COLORS.length] }));
```

- [ ] **Step 2: Rewrite `startLevel` to sample**

Replace `js/ui.js:171-177` body so it samples, colors, sorts, and locks evenly-spaced anchors:

```js
function startLevel(level) {
  const books = withColors(sampleLevel(level, BOOKS, Math.random));
  const order = correctOrder(books);
  const slots = order.map(() => null);
  for (const i of anchorIndices(level.preplaced, order.length)) slots[i] = order[i];
  state = { level, books, order, slots, pileOrder: shuffled(books), selected: null };
  // ... unchanged: set title/instructions, show/hide panels, renderShelf, renderPile, focus
}
```

Note: any later reference to `level.books` (e.g. in `tryPlace`'s `isCorrectPlacement(book, i, state.level.books)`) must use `state.books` instead, since the level no longer owns a book list. Update those references.

- [ ] **Step 3: Run tests**

Run: `node --test 2>&1 | grep -E "# (pass|fail)"`
Expected: all pass.

- [ ] **Step 4: Manual browser verification**

Open `index.html` in a browser (or via the firefox-devtools tools). For each level:
play through once, confirm books render with colors, correct placement snaps in, wrong
placement bounces with a hint, and finishing shows the win overlay. Reload a level twice
and confirm the book set differs.

- [ ] **Step 5: Commit**

```bash
git add js/ui.js
git commit -F - <<'EOF'
FFF Sample a fresh book set per play for replay variety

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
```

---

## Notes for the executor

- `isCorrectPlacement(book, i, levelBooks)` compares against `correctOrder(levelBooks)[i]`,
  so it must receive the **sampled** set (`state.books`), not `level` (which has no books).
- Keep `sampleLevel` pure: all randomness comes from the injected `rng`. The UI passes
  `Math.random`; tests pass a seeded generator.
- Do not weaken a failing feasibility test to make it pass — add data instead.
