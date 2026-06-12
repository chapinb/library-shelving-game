// Curated book data and the 5 level definitions. Data only — no logic.
//
// callType "fiction": shelved by `cutter` (author letters); `dewey` is null.
// callType "dewey":   shelved by `dewey` number, ties broken by `cutter`.
//
// Each level: { id, grade, name, instructions, mode, preplaced, books }
//   mode "fixed"     — all slots empty; place books in any order.
//   mode "insert"    — fill the shelf left-to-right in ascending order.
//   mode "preplaced" — some slots start locked; fill the rest in any order.
//   preplaced        — slot indices that start filled (only used by "preplaced").

const COLORS = [
  "#3b6ea5", "#a5453b", "#4a8a5c", "#8a5ca5", "#c0852a",
  "#2a8a8a", "#a53b6e", "#6e7a2a", "#5c5ca5", "#a56e3b",
];

// Helper builders keep the level tables readable.
const fic = (title, author, cutter) => ({ title, author, callType: "fiction", dewey: null, cutter });
const dew = (title, author, dewey, cutter) => ({ title, author, callType: "dewey", dewey, cutter });

// Assign a stable spine color per book within a level.
const withColors = (books) => books.map((b, i) => ({ ...b, color: COLORS[i % COLORS.length] }));

export const LEVELS = [
  {
    id: 1,
    grade: 2,
    name: "Level 1 · Grade 2",
    instructions: "Put the storybooks in order by the author's last name. Look at the first letter!",
    mode: "fixed",
    preplaced: [],
    books: withColors([
      fic("Clifford the Big Red Dog", "Norman Bridwell", "BRI"),
      fic("Matilda", "Roald Dahl", "DAH"),
      fic("Frog and Toad Are Friends", "Arnold Lobel", "LOB"),
      fic("Amelia Bedelia", "Peggy Parish", "PAR"),
      fic("The Cat in the Hat", "Dr. Seuss", "SEU"),
    ]),
  },
  {
    id: 2,
    grade: 3,
    name: "Level 2 · Grade 3",
    instructions: "These authors all start with B! Use the 2nd and 3rd letters to put them in order.",
    mode: "fixed",
    preplaced: [],
    books: withColors([
      fic("Ivy and Bean", "Annie Barrows", "BAR"),
      fic("Tales of a Fourth Grade Nothing", "Judy Blume", "BLU"),
      fic("Clifford the Big Red Dog", "Norman Bridwell", "BRI"),
      fic("Arthur's Eyes", "Marc Brown", "BRO"),
      fic("The Wednesday Surprise", "Eve Bunting", "BUN"),
      fic("The Summer of the Swans", "Betsy Byars", "BYA"),
    ]),
  },
  {
    id: 3,
    grade: 4,
    name: "Level 3 · Grade 4",
    instructions: "Shelve the number books from smallest to biggest, then the storybooks. Fill the shelf left to right.",
    mode: "insert",
    preplaced: [],
    books: withColors([
      dew("Grimm's Fairy Tales", "Jacob Grimm", "398.2", "GRI"),
      dew("The Planets", "Gail Gibbons", "523", "GIB"),
      dew("Wild Animals", "Anna Reed", "591", "REE"),
      dew("All About Dogs", "Wendy Gaglio", "636", "GAG"),
      dew("Fun Card Games", "Ray Hoyle", "793", "HOY"),
      fic("Matilda", "Roald Dahl", "DAH"),
      fic("Charlotte's Web", "E.B. White", "WHI"),
    ]),
  },
  {
    id: 4,
    grade: 5,
    name: "Level 4 · Grade 5",
    instructions: "These animal books use one decimal place. A few are already shelved — fit the rest in the right spots.",
    mode: "preplaced",
    preplaced: [0, 4],
    books: withColors([
      dew("Dinosaur Days", "Dougal Dixon", "567.9", "DIX"),
      dew("Bug World", "Patricia Pye", "595.7", "PYE"),
      dew("Sharks!", "Mara Muston", "597.3", "MUS"),
      dew("Reptiles Up Close", "Leo Vance", "598.1", "VAN"),
      dew("Horses and Ponies", "Beth Budd", "636.1", "BUD"),
      dew("All About Dogs", "Wendy Gaglio", "636.7", "GAG"),
      dew("Caring for Cats", "Ella White", "636.8", "WHI"),
      dew("Your First Fish Tank", "Finn Carr", "639.3", "CAR"),
    ]),
  },
  {
    id: 5,
    grade: 6,
    name: "Level 5 · Grade 6",
    instructions: "Two decimal places — read carefully! Number books first, then storybooks. Some are already placed.",
    mode: "preplaced",
    preplaced: [0, 4, 8],
    books: withColors([
      dew("Exploring Mars", "Iris Zimmer", "523.42", "ZIM"),
      dew("Journey to Jupiter", "Cara Bradley", "523.43", "BRA"),
      dew("Whales of the Deep", "Anna Reed", "599.65", "REE"),
      dew("Wild Wolves", "Mia Marsh", "599.66", "MAR"),
      dew("Puppy Training", "Dan Adams", "636.72", "ADA"),
      dew("Labrador Love", "Bea Barr", "636.73", "BAR"),
      dew("Show Dogs", "Cole Cole", "636.75", "COL"),
      dew("Pugs and Bulldogs", "Sam Smith", "636.78", "SMI"),
      fic("The Adventures of Abbie", "Jo Abbott", "ABB"),
      fic("Charlotte's Web", "E.B. White", "WHI"),
    ]),
  },
];
