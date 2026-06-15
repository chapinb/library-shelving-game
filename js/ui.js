// DOM rendering, pointer drag-and-drop, and the per-level game flow.
// All ordering correctness lives in engine.js; this file only wires it to the page.
// Classic script: reads ShelfBooks/ShelfEngine globals set by the earlier <script>
// tags. This lets the game run by double-clicking index.html (file:// URL), where
// ES module imports would be blocked by CORS.
(function () {
  "use strict";
  const { BOOKS, LEVELS } = window.ShelfBooks;
  const { correctOrder, isCorrectPlacement, hintFor, sampleLevel, anchorIndices } = window.ShelfEngine;

  const $ = (id) => document.getElementById(id);

  // Spine colors. All dark enough that white spine text clears WCAG 4.5:1 for
  // small text. Assigned per sampled book at play time (was per-level in books.js).
  const COLORS = [
    "#3b6ea5", "#a5453b", "#3f7a4f", "#8a5ca5", "#946012",
    "#1f7a7a", "#a53b6e", "#566021", "#5c5ca5", "#7a4f24",
  ];
  const withColors = (books) => books.map((b, i) => ({ ...b, color: COLORS[i % COLORS.length] }));

// ---- Current-level state ------------------------------------------------
let state = null; // { level, order, slots: (book|null)[], locked: bool[] }

// The call-number text shown on a spine.
const callLabel = (book) => (book.callType === "fiction" ? "FIC" : book.dewey);

// How a book's call number reads aloud, e.g. "fiction, Seuss" or "Dewey 591, Reed".
const spokenCall = (book) =>
  book.callType === "fiction"
    ? `fiction, ${book.cutter}`
    : `Dewey ${book.dewey}, ${book.cutter}`;

// Build a spine element for a book. `draggable` controls whether it can be picked up.
function spineEl(book, { draggable }) {
  const el = document.createElement("div");
  el.className = "spine";
  el.style.background = book.color;
  el.dataset.title = book.title;
  el.innerHTML = `
    <span class="cn">${callLabel(book)}</span>
    <span class="title">${book.title}</span>
    <span class="cutter">${book.cutter}</span>`;
  if (draggable) {
    el.tabIndex = 0;
    el.setAttribute("role", "button");
    el.setAttribute("aria-pressed", "false");
    el.setAttribute("aria-label", `${book.title}, ${spokenCall(book)}. Press Enter to pick up.`);
    el.addEventListener("pointerdown", (e) => startDrag(e, book, el));
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        selectBook(book);
      }
    });
  } else {
    el.classList.add("locked");
    el.setAttribute("aria-label", `${book.title}, ${spokenCall(book)}, already shelved.`);
  }
  return el;
}

// ---- Rendering ----------------------------------------------------------
function renderMenu() {
  const grid = $("levelGrid");
  grid.innerHTML = "";
  for (const level of LEVELS) {
    const card = document.createElement("div");
    card.className = "level-card";
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `${level.name}, ${level.count} books`);
    card.innerHTML = `<h3>${level.name}</h3><p>${level.count} books</p>`;
    card.addEventListener("click", () => startLevel(level));
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        startLevel(level);
      }
    });
    grid.appendChild(card);
  }
}

// Index in the sorted order where fiction begins, so we can draw a section divider.
function fictionBoundary(order) {
  const idx = order.findIndex((b) => b.callType === "fiction");
  return idx;
}

function renderShelf() {
  const shelf = $("shelf");
  shelf.innerHTML = "";
  const boundary = fictionBoundary(state.order);

  state.slots.forEach((book, i) => {
    if (i === boundary && boundary > 0) {
      const div = document.createElement("div");
      div.className = "divider";
      div.innerHTML = "<span>Stories</span>";
      shelf.appendChild(div);
    }
    if (book) {
      shelf.appendChild(spineEl(book, { draggable: false }));
    } else {
      const slot = document.createElement("div");
      slot.className = "slot";
      slot.dataset.index = i;
      slot.tabIndex = 0;
      slot.setAttribute("role", "button");
      slot.setAttribute("aria-label", `Empty spot ${i + 1} of ${state.slots.length}. Pick a book, then choose this spot.`);
      slot.addEventListener("click", () => placeSelected(i));
      slot.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          placeSelected(i);
        }
      });
      shelf.appendChild(slot);
    }
  });
}

// ---- Select-then-place (keyboard + tap; an alternative to dragging) -----
function announce(text) {
  $("live").textContent = text;
}

// Pick up / put down a book from the pile. Toggling the same book deselects it.
function selectBook(book) {
  state.selected = state.selected && state.selected.title === book.title ? null : book;
  updateSelectionUI();
  announce(state.selected ? `${book.title} picked up. Now choose a spot.` : `${book.title} put down.`);
}

// Reflect the current selection on the pile spines (highlight + aria-pressed).
function updateSelectionUI() {
  const sel = state.selected;
  $("pile").querySelectorAll(".spine").forEach((el) => {
    const on = sel != null && el.dataset.title === sel.title;
    el.classList.toggle("selected", on);
    el.setAttribute("aria-pressed", on ? "true" : "false");
  });
}

// Place the currently selected book into slot `i`, if one is selected.
function placeSelected(i) {
  if (!state.selected) {
    announce("Pick a book from the pile first.");
    return;
  }
  const book = state.selected;
  state.selected = null;
  tryPlace(book, i);
}

function renderPile() {
  const pile = $("pile");
  pile.innerHTML = "";
  for (const book of pileBooks()) pile.appendChild(spineEl(book, { draggable: true }));
}

// Books not yet placed on the shelf, kept in their shuffled pile order.
function pileBooks() {
  const placedTitles = new Set(state.slots.filter(Boolean).map((b) => b.title));
  return state.pileOrder.filter((b) => !placedTitles.has(b.title));
}

// Fisher-Yates shuffle on a copy, so the pile never hands out the answer in order.
function shuffled(books) {
  const a = [...books];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---- Level lifecycle ----------------------------------------------------
function startLevel(level) {
  const books = withColors(sampleLevel(level, BOOKS, Math.random));
  const order = correctOrder(books);
  const slots = order.map(() => null);
  // Pre-place locked anchor books at evenly-spaced positions as anchors.
  for (const i of anchorIndices(level.preplaced, order.length)) slots[i] = order[i];
  state = { level, books, order, slots, pileOrder: shuffled(books), selected: null };
  $("levelTitle").textContent = level.name;
  $("instructions").textContent = level.instructions;
  $("menu").style.display = "none";
  $("game").style.display = "block";
  $("success").style.display = "none";
  hideHint();
  renderShelf();
  renderPile();
  const firstBook = $("pile").querySelector(".spine");
  if (firstBook) firstBook.focus();
}

function backToMenu() {
  state = null;
  $("game").style.display = "none";
  $("success").style.display = "none";
  $("menu").style.display = "block";
  const firstCard = $("levelGrid").querySelector(".level-card");
  if (firstCard) firstCard.focus();
}

// ---- Drag and drop (pointer events: mouse + touch) ----------------------
let drag = null; // { book, origin, clone }

function startDrag(e, book, originEl) {
  e.preventDefault();
  const rect = originEl.getBoundingClientRect();
  const clone = originEl.cloneNode(true);
  clone.classList.add("clone");
  clone.style.width = `${rect.width}px`;
  clone.style.height = `${rect.height}px`;
  document.body.appendChild(clone);
  originEl.classList.add("dragging");
  drag = {
    book, originEl, clone,
    offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top,
    startX: e.clientX, startY: e.clientY, moved: false,
  };
  moveClone(e);
  window.addEventListener("pointermove", moveClone);
  window.addEventListener("pointerup", endDrag);
}

function moveClone(e) {
  if (!drag) return;
  if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > 6) drag.moved = true;
  drag.clone.style.left = `${e.clientX - drag.offsetX}px`;
  drag.clone.style.top = `${e.clientY - drag.offsetY}px`;
  const slot = slotUnder(e);
  document.querySelectorAll(".slot.over").forEach((s) => s.classList.remove("over"));
  if (slot) slot.classList.add("over");
}

// The empty slot under the pointer, if the clone weren't there (clone has pointer-events:none).
function slotUnder(e) {
  const el = document.elementFromPoint(e.clientX, e.clientY);
  return el ? el.closest(".slot") : null;
}

function endDrag(e) {
  window.removeEventListener("pointermove", moveClone);
  window.removeEventListener("pointerup", endDrag);
  const slot = slotUnder(e);
  const { book, moved } = drag;
  drag.clone.remove();
  document.querySelectorAll(".slot.over").forEach((s) => s.classList.remove("over"));
  drag = null;
  if (!moved) {
    renderPile(); // a tap, not a drag — select the book instead of placing it
    selectBook(book);
  } else if (slot) {
    state.selected = null;
    tryPlace(book, Number(slot.dataset.index));
  } else {
    renderPile(); // dragged into empty space — restore the spine
  }
}

// ---- Placement rule -----------------------------------------------------
function tryPlace(book, slotIndex) {
  if (isCorrectPlacement(book, slotIndex, state.books)) {
    state.slots[slotIndex] = book;
    hideHint();
    renderShelf();
    renderPile();
    updateSelectionUI();
    flashCorrect(slotIndex);
    if (pileBooks().length === 0) win();
    else announce(`Yes! ${book.title} is in the right spot.`);
  } else {
    state.selected = null;
    showHint(hintFor(book, state.order[slotIndex]));
    bounceBack();
    updateSelectionUI();
  }
}

function bounceBack() {
  renderPile();
  const shelf = $("shelf");
  shelf.classList.remove("shake");
  void shelf.offsetWidth; // restart the animation
  shelf.classList.add("shake");
}

function flashCorrect(slotIndex) {
  const spines = $("shelf").querySelectorAll(".spine");
  const placed = [...spines].find((s) => s.dataset.title === state.slots[slotIndex].title);
  if (placed) placed.classList.add("correct");
}

function win() {
  $("successMsg").textContent = `${state.level.name}: every book is in the right place!`;
  $("success").style.display = "flex";
  announce(`You did it! ${state.level.name} complete.`);
  $("successBtn").focus();
}

// ---- Hints --------------------------------------------------------------
function showHint(text) {
  const h = $("hint");
  h.textContent = text;
  h.classList.add("show");
}
function hideHint() {
  $("hint").classList.remove("show");
}

// ---- Wire up ------------------------------------------------------------
$("backBtn").addEventListener("click", backToMenu);
$("successBtn").addEventListener("click", backToMenu);
renderMenu();
})();
