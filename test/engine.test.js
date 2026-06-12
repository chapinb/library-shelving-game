import { test } from "node:test";
import assert from "node:assert/strict";
import {
  correctOrder,
  isCorrectPlacement,
  hintFor,
} from "../js/engine.js";

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
