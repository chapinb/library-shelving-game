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
    // Different sections: the rule that matters is "number books before story
    // books," not the letters/numbers within a section. Compare letters or
    // numbers only when both books live in the same section.
    if (sectionRank(droppedBook) !== sectionRank(expectedBook)) {
      return droppedBook.callType === "fiction"
        ? "Story books go after the number books — this spot is for a number book."
        : "Number books go before the story books — this spot is for a story book.";
    }
    const [first, second] =
      compareBooks(droppedBook, expectedBook) < 0
        ? [droppedBook, expectedBook]
        : [expectedBook, droppedBook];
    if (droppedBook.callType === "fiction") {
      return `${first.cutter} comes before ${second.cutter} — compare the letters.`;
    }
    return `${first.dewey} comes before ${second.dewey} — compare the numbers.`;
  }

  const firstLetter = (b) => b.cutter.charAt(0).toUpperCase();
  const gradeOk = (b, maxGrade) => maxGrade == null || b.grades[0] <= maxGrade;

  // Digits after the decimal point: "636" -> 0, "597.9" -> 1, "636.78" -> 2.
  const deweyDepth = (b) => {
    const dot = b.dewey.indexOf(".");
    return dot === -1 ? 0 : b.dewey.length - dot - 1;
  };

  // Fisher-Yates over a copy using the injected rng; returns the first n.
  function sampleN(arr, n, rng) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(0, n);
  }

  // No two books may share a sort key (otherwise the puzzle is ambiguous).
  function unambiguous(books) {
    const ordered = correctOrder(books);
    for (let i = 1; i < ordered.length; i++) {
      if (compareBooks(ordered[i - 1], ordered[i]) === 0) return false;
    }
    return true;
  }

  // Group fiction candidates by first letter into { letter: Book[] }.
  function byFirstLetter(books) {
    return books.reduce((map, b) => {
      (map[firstLetter(b)] ||= []).push(b);
      return map;
    }, {});
  }

  function sampleLevel(level, books, rng) {
    const c = level.criteria;
    for (let attempt = 0; attempt < 100; attempt++) {
      let picked;
      if (c.type === "fiction" && c.firstLetters === "distinct") {
        const groups = byFirstLetter(books.filter((b) => b.callType === "fiction" && gradeOk(b, c.maxGrade)));
        const letters = sampleN(Object.keys(groups), level.count, rng);
        if (letters.length === level.count) {
          picked = letters.map((l) => sampleN(groups[l], 1, rng)[0]);
        }
      } else if (c.type === "fiction" && c.firstLetters === "shared") {
        const groups = byFirstLetter(books.filter((b) => b.callType === "fiction" && gradeOk(b, c.maxGrade)));
        const clusters = Object.values(groups).filter((g) => g.length >= level.count);
        if (clusters.length) {
          picked = sampleN(sampleN(clusters, 1, rng)[0], level.count, rng);
        }
      } else if (c.type === "dewey") {
        const pool = books.filter((b) => b.callType === "dewey"
          && gradeOk(b, c.maxGrade) && deweyDepth(b) === c.deweyDecimals);
        picked = sampleN(pool, level.count, rng);
      } else if (c.type === "mixed") {
        const nf = books.filter((b) => b.callType === "dewey"
          && gradeOk(b, c.maxGrade) && deweyDepth(b) === c.deweyDecimals);
        const fc = books.filter((b) => b.callType === "fiction" && gradeOk(b, c.maxGrade));
        picked = sampleN(nf, level.count - c.ficCount, rng).concat(sampleN(fc, c.ficCount, rng));
      }
      if (picked && picked.length === level.count && unambiguous(picked)) return picked;
    }
    throw new Error(`could not sample level ${level.id}`);
  }

  // n positions spread evenly over [0, total-1]; [] for n<=0, [0] for n===1.
  function anchorIndices(n, total) {
    if (n <= 0) return [];
    if (n === 1) return [0];
    return Array.from({ length: n }, (_, i) => Math.round((i * (total - 1)) / (n - 1)));
  }

  return { compareBooks, correctOrder, isCorrectPlacement, hintFor, sampleLevel, anchorIndices };
});
