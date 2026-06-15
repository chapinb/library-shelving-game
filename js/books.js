// Tagged book pool and the 5 level definitions. Data only — no logic.
//
// Loaded as a classic <script> in the browser (exposes window.ShelfBooks) and
// via require() in Node tests (module.exports).
//
// A pool record: { title, author, callType, dewey, cutter, grades: [min, max], source }
//   callType "fiction": shelved by `cutter` (author letters); `dewey` is null.
//   callType "dewey":   shelved by `dewey` number, ties broken by `cutter`.
//   grades:             [min, max] grade band the book suits.
//   cutter:             first three letters of the author's last name, uppercased.
//
// Levels carry no book list. Each level samples from the pool by `criteria` at
// play time (see js/engine.js#sampleLevel). Color is assigned in the UI.
//
// Each level: { id, grade, name, instructions, count, mode, preplaced, criteria }
//   mode "fixed"     — all slots empty; place books in any order.
//   mode "preplaced" — `preplaced` slots start locked (evenly spaced) as anchors.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ShelfBooks = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const fic = (title, author, cutter, grades) =>
    ({ title, author, callType: "fiction", dewey: null, cutter, grades, source: "classic" });
  const dew = (title, author, dewey, cutter, grades) =>
    ({ title, author, callType: "dewey", dewey, cutter, grades, source: "nonfiction" });

  // Tagged pool. Starting set migrated from the original per-level lists;
  // expanded with grade-appropriate titles for replay variety.
  const BOOKS = [
    // Fiction, grades 1-3
    fic("Clifford the Big Red Dog", "Norman Bridwell", "BRI", [1, 3]),
    fic("Matilda", "Roald Dahl", "DAH", [2, 5]),
    fic("Frog and Toad Are Friends", "Arnold Lobel", "LOB", [1, 3]),
    fic("Amelia Bedelia", "Peggy Parish", "PAR", [1, 3]),
    fic("The Cat in the Hat", "Dr. Seuss", "SEU", [1, 2]),
    fic("Ivy and Bean", "Annie Barrows", "BAR", [2, 4]),
    fic("Tales of a Fourth Grade Nothing", "Judy Blume", "BLU", [3, 5]),
    fic("Arthur's Eyes", "Marc Brown", "BRO", [1, 3]),
    fic("The Wednesday Surprise", "Eve Bunting", "BUN", [2, 4]),
    fic("The Summer of the Swans", "Betsy Byars", "BYA", [4, 6]),
    fic("Charlotte's Web", "E.B. White", "WHI", [3, 5]),
    // Nonfiction, 0 decimals
    dew("Grimm's Fairy Tales", "Jacob Grimm", "398.2", "GRI", [3, 6]),
    dew("The Planets", "Gail Gibbons", "523", "GIB", [3, 5]),
    dew("Wild Animals", "Anna Reed", "591", "REE", [3, 5]),
    dew("All About Dogs", "Wendy Gaglio", "636", "GAG", [3, 5]),
    dew("Fun Card Games", "Ray Hoyle", "795", "HOY", [3, 6]),
    dew("Crafts for Kids", "Tessa Quill", "745", "QUI", [3, 6]),
    dew("Party Games", "Polly Day", "793", "DAY", [3, 6]),
    dew("Mammals of the World", "Owen Fox", "599", "FOX", [3, 6]),
    dew("The Human Body", "Hana Lin", "612", "LIN", [3, 6]),
    dew("Weather Watch", "Nora Skye", "551", "SKY", [3, 6]),
    // Nonfiction, 1 decimal
    dew("Dinosaur Days", "Dougal Dixon", "567.9", "DIX", [4, 6]),
    dew("Bug World", "Patricia Pye", "595.7", "PYE", [4, 6]),
    dew("Sharks!", "Mara Muston", "597.3", "MUS", [4, 6]),
    dew("Reptiles Up Close", "Leo Vance", "597.9", "VAN", [4, 6]),
    dew("Frogs and Toads", "Tina Webb", "597.8", "WEB", [4, 6]),
    dew("All About Birds", "Robin Hale", "598.0", "HAL", [4, 6]),
    dew("Horses and Ponies", "Beth Budd", "636.1", "BUD", [4, 6]),
    dew("Backyard Chickens", "Hen Poole", "636.5", "POO", [4, 6]),
    dew("Caring for Dogs", "Wendy Gaglio", "636.7", "GAG", [4, 6]),
    dew("Caring for Cats", "Ella White", "636.8", "WHI", [4, 6]),
    dew("Your First Fish Tank", "Finn Carr", "639.3", "CAR", [4, 6]),
    // Nonfiction, 2 decimals
    dew("Exploring Mars", "Iris Zimmer", "523.43", "ZIM", [5, 6]),
    dew("Journey to Jupiter", "Cara Bradley", "523.45", "BRA", [5, 6]),
    dew("Whales of the Deep", "Anna Reed", "599.51", "REE", [5, 6]),
    dew("Dolphin Friends", "Della Pike", "599.53", "PIK", [5, 6]),
    dew("Grizzly Bears", "Ursula Penn", "599.78", "PEN", [5, 6]),
    dew("Wild Wolves", "Mia Marsh", "599.77", "MAR", [5, 6]),
    dew("Puppy Training", "Dan Adams", "636.72", "ADA", [5, 6]),
    dew("Labrador Love", "Bea Barr", "636.73", "BAR", [5, 6]),
    dew("Show Dogs", "Cole Coleman", "636.75", "COL", [5, 6]),
    dew("Pugs and Bulldogs", "Sam Smith", "636.78", "SMI", [5, 6]),
  ];

  const LEVELS = [
    {
      id: 1, grade: 2, name: "Level 1 · Grade 2",
      instructions: "Put the storybooks in order by the author's last name. Look at the first letter!",
      count: 5, mode: "fixed", preplaced: 0,
      criteria: { type: "fiction", maxGrade: 3, firstLetters: "distinct" },
    },
    {
      id: 2, grade: 3, name: "Level 2 · Grade 3",
      instructions: "These authors share a first letter! Use the next letters to put them in order.",
      count: 6, mode: "fixed", preplaced: 0,
      criteria: { type: "fiction", maxGrade: 4, firstLetters: "shared" },
    },
    {
      id: 3, grade: 4, name: "Level 3 · Grade 4",
      instructions: "Shelve the number books from smallest to biggest, then the storybooks.",
      count: 7, mode: "fixed", preplaced: 0,
      criteria: { type: "mixed", ficCount: 2, deweyDecimals: 0 },
    },
    {
      id: 4, grade: 5, name: "Level 4 · Grade 5",
      instructions: "These books use one decimal place. A few are already shelved — fit the rest in.",
      count: 8, mode: "preplaced", preplaced: 2,
      criteria: { type: "dewey", deweyDecimals: 1 },
    },
    {
      id: 5, grade: 6, name: "Level 5 · Grade 6",
      instructions: "Two decimal places — read carefully! Number books first, then storybooks.",
      count: 10, mode: "preplaced", preplaced: 3,
      criteria: { type: "mixed", ficCount: 2, deweyDecimals: 2 },
    },
  ];

  return { BOOKS, LEVELS };
});
