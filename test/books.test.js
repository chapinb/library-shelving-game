import { test } from "node:test";
import assert from "node:assert/strict";
import { LEVELS } from "../js/books.js";
import { correctOrder, compareBooks } from "../js/engine.js";

const expectedCounts = { 1: 5, 2: 6, 3: 7, 4: 8, 5: 10 };

test("there are exactly 5 levels for grades 2-6", () => {
  assert.equal(LEVELS.length, 5);
  assert.deepEqual(LEVELS.map((l) => l.grade), [2, 3, 4, 5, 6]);
});

for (const level of LEVELS) {
  test(`level ${level.id} has the right book count`, () => {
    assert.equal(level.books.length, expectedCounts[level.id]);
  });

  test(`level ${level.id} has an unambiguous solution (no tied books)`, () => {
    const ordered = correctOrder(level.books);
    for (let i = 1; i < ordered.length; i++) {
      assert.notEqual(
        compareBooks(ordered[i - 1], ordered[i]),
        0,
        `tie between ${ordered[i - 1].title} and ${ordered[i].title}`,
      );
    }
  });

  test(`level ${level.id} preplaced indices are valid`, () => {
    for (const idx of level.preplaced) {
      assert.ok(idx >= 0 && idx < level.books.length, `bad preplaced index ${idx}`);
    }
    if (level.mode !== "preplaced") assert.deepEqual(level.preplaced, []);
  });

  test(`level ${level.id} every book has a spine color`, () => {
    for (const b of level.books) assert.match(b.color, /^#[0-9a-f]{6}$/i);
  });
}

test("mixed levels shelve all nonfiction before any fiction", () => {
  for (const level of LEVELS) {
    const types = correctOrder(level.books).map((b) => b.callType);
    const firstFiction = types.indexOf("fiction");
    if (firstFiction !== -1) {
      assert.ok(
        types.slice(firstFiction).every((t) => t === "fiction"),
        `level ${level.id} interleaves fiction and nonfiction`,
      );
    }
  }
});
