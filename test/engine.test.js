const { test } = require("node:test");
const assert = require("node:assert/strict");
const { correctOrder, isCorrectPlacement, hintFor } = require("../js/engine.js");

// Test fixtures: minimal books, not the real curated data.
const fiction = (title, cutter) => ({ title, callType: "fiction", dewey: null, cutter });
const dewey = (title, num, cutter) => ({ title, callType: "dewey", dewey: num, cutter });

test("fiction sorts by cutter letters alphabetically", () => {
  const books = [fiction("Roar", "ROW"), fiction("Ant", "ADL"), fiction("Mid", "MOR")];
  const order = correctOrder(books).map((b) => b.cutter);
  assert.deepEqual(order, ["ADL", "MOR", "ROW"]);
});

test("dewey sorts numerically, not as strings (591 before 636 before 921)", () => {
  const books = [dewey("Birds", "921", "AUD"), dewey("Cats", "636", "GAG"), dewey("Wild", "591", "REE")];
  const order = correctOrder(books).map((b) => b.dewey);
  assert.deepEqual(order, ["591", "636", "921"]);
});

test("close decimals order correctly (636.73 before 636.78)", () => {
  const books = [dewey("Pugs", "636.78", "SMI"), dewey("Labs", "636.73", "ADA")];
  const order = correctOrder(books).map((b) => b.dewey);
  assert.deepEqual(order, ["636.73", "636.78"]);
});

test("equal dewey numbers break ties by cutter letters", () => {
  const books = [dewey("Two", "636.7", "WIL"), dewey("One", "636.7", "BAR")];
  const order = correctOrder(books).map((b) => b.cutter);
  assert.deepEqual(order, ["BAR", "WIL"]);
});

test("mixed shelf places all nonfiction before fiction", () => {
  const books = [
    fiction("Story", "LEE"),
    dewey("Dogs", "636.7", "ADA"),
    fiction("Tale", "ABB"),
    dewey("Sky", "520", "ZIM"),
  ];
  const order = correctOrder(books).map((b) => b.callType);
  assert.deepEqual(order, ["dewey", "dewey", "fiction", "fiction"]);
});

test("isCorrectPlacement true only at the book's sorted index", () => {
  const books = [dewey("A", "591", "REE"), dewey("B", "636", "GAG"), dewey("C", "921", "AUD")];
  const middle = books[1];
  assert.equal(isCorrectPlacement(middle, 1, books), true);
  assert.equal(isCorrectPlacement(middle, 0, books), false);
  assert.equal(isCorrectPlacement(middle, 2, books), false);
});

test("hintFor compares numbers for dewey books", () => {
  const dropped = dewey("Pugs", "636.78", "SMI");
  const expected = dewey("Labs", "636.73", "ADA");
  const hint = hintFor(dropped, expected);
  assert.match(hint, /636\.73/);
  assert.match(hint, /number/i);
});

test("hintFor compares letters for fiction books", () => {
  const dropped = fiction("Roar", "ROW");
  const expected = fiction("Ant", "ADL");
  const hint = hintFor(dropped, expected);
  assert.match(hint, /ADL/);
  assert.match(hint, /letter/i);
});

test("hintFor explains the section rule, not letters, for fiction dropped on a number slot", () => {
  const dropped = fiction("Abbie", "ABB");
  const expected = dewey("Wild Animals", "591", "REE");
  const hint = hintFor(dropped, expected);
  // Must not tell the child to "compare the letters" of a cutter vs a number,
  // and must not falsely claim the cutter order is reversed.
  assert.doesNotMatch(hint, /letter/i);
  assert.doesNotMatch(hint, /number.*come.*before.*\d/);
  assert.match(hint, /story books?/i);
});

test("hintFor explains the section rule for a number book dropped on a story slot", () => {
  const dropped = dewey("Wild Animals", "591", "REE");
  const expected = fiction("Abbie", "ABB");
  const hint = hintFor(dropped, expected);
  assert.doesNotMatch(hint, /letter/i);
  assert.match(hint, /number books?/i);
});

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
