// Pure shelving logic — no DOM. Shared by the browser UI and the test suite.
//
// A book: { title, author?, callType: "dewey"|"fiction", dewey: string|null, cutter, color? }
//
// Canonical shelf order: nonfiction (Dewey) before fiction. Within nonfiction,
// ascending Dewey number, ties broken by author cutter letters. Within fiction,
// by cutter letters.

const sectionRank = (book) => (book.callType === "fiction" ? 1 : 0);

const deweyValue = (book) => (book.dewey == null ? 0 : Number.parseFloat(book.dewey));

const cutterKey = (book) => book.cutter.toUpperCase();

// Lexicographic comparison over [section, dewey, cutter].
export function compareBooks(a, b) {
  if (sectionRank(a) !== sectionRank(b)) return sectionRank(a) - sectionRank(b);
  if (deweyValue(a) !== deweyValue(b)) return deweyValue(a) - deweyValue(b);
  return cutterKey(a) < cutterKey(b) ? -1 : cutterKey(a) > cutterKey(b) ? 1 : 0;
}

// The books sorted into canonical shelf order (does not mutate input).
export function correctOrder(books) {
  return [...books].sort(compareBooks);
}

// True when `book` belongs at `positionIndex` in the level's correct order.
// Compares by sort key so identical-key books are interchangeable.
export function isCorrectPlacement(book, positionIndex, levelBooks) {
  const expected = correctOrder(levelBooks)[positionIndex];
  return expected !== undefined && compareBooks(book, expected) === 0;
}

// A short, kid-friendly hint explaining why the dropped book was wrong,
// relative to the book that actually belongs in that spot. The "before/after"
// wording follows the real shelf order so the hint is always factually correct.
export function hintFor(droppedBook, expectedBook) {
  const [first, second] =
    compareBooks(droppedBook, expectedBook) < 0
      ? [droppedBook, expectedBook]
      : [expectedBook, droppedBook];
  if (droppedBook.callType === "fiction" || expectedBook.callType === "fiction") {
    return `${first.cutter} comes before ${second.cutter} — compare the letters.`;
  }
  return `${first.dewey} comes before ${second.dewey} — compare the numbers.`;
}
