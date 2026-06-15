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
