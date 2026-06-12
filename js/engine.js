// Pure shelving logic — no DOM. Shared by the browser UI and the test suite.
//
// Loaded as a classic <script> in the browser (exposes window.ShelfEngine) and
// via require() in Node tests (module.exports). Classic scripts avoid the CORS
// restriction that blocks ES modules when the game is opened from a file:// URL.
//
// A book: { title, author?, callType: "dewey"|"fiction", dewey: string|null, cutter, color? }
//
// Canonical shelf order: nonfiction (Dewey) before fiction. Within nonfiction,
// ascending Dewey number, ties broken by author cutter letters. Within fiction,
// by cutter letters.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ShelfEngine = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const sectionRank = (book) => (book.callType === "fiction" ? 1 : 0);
  const deweyValue = (book) => (book.dewey == null ? 0 : Number.parseFloat(book.dewey));
  const cutterKey = (book) => book.cutter.toUpperCase();

  // Lexicographic comparison over [section, dewey, cutter].
  function compareBooks(a, b) {
    if (sectionRank(a) !== sectionRank(b)) return sectionRank(a) - sectionRank(b);
    if (deweyValue(a) !== deweyValue(b)) return deweyValue(a) - deweyValue(b);
    return cutterKey(a) < cutterKey(b) ? -1 : cutterKey(a) > cutterKey(b) ? 1 : 0;
  }

  // The books sorted into canonical shelf order (does not mutate input).
  function correctOrder(books) {
    return [...books].sort(compareBooks);
  }

  // True when `book` belongs at `positionIndex` in the level's correct order.
  // Compares by sort key so identical-key books are interchangeable.
  function isCorrectPlacement(book, positionIndex, levelBooks) {
    const expected = correctOrder(levelBooks)[positionIndex];
    return expected !== undefined && compareBooks(book, expected) === 0;
  }

  // A short, kid-friendly hint explaining why the dropped book was wrong,
  // relative to the book that actually belongs in that spot. The "before/after"
  // wording follows the real shelf order so the hint is always factually correct.
  function hintFor(droppedBook, expectedBook) {
    const [first, second] =
      compareBooks(droppedBook, expectedBook) < 0
        ? [droppedBook, expectedBook]
        : [expectedBook, droppedBook];
    if (droppedBook.callType === "fiction" || expectedBook.callType === "fiction") {
      return `${first.cutter} comes before ${second.cutter} — compare the letters.`;
    }
    return `${first.dewey} comes before ${second.dewey} — compare the numbers.`;
  }

  return { compareBooks, correctOrder, isCorrectPlacement, hintFor };
});
