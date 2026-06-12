// DOM rendering, pointer drag-and-drop, and the per-level game flow.
// All ordering correctness lives in engine.js; this file only wires it to the page.
// Classic script: reads ShelfBooks/ShelfEngine globals set by the earlier <script>
// tags. This lets the game run by double-clicking index.html (file:// URL), where
// ES module imports would be blocked by CORS.
(function () {
  "use strict";
  const { LEVELS } = window.ShelfBooks;
  const { correctOrder, isCorrectPlacement, hintFor } = window.ShelfEngine;

  const $ = (id) => document.getElementById(id);

// ---- Current-level state ------------------------------------------------
let state = null; // { level, order, slots: (book|null)[], locked: bool[] }

// The call-number text shown on a spine.
const callLabel = (book) => (book.callType === "fiction" ? "FIC" : book.dewey);

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
  if (draggable) el.addEventListener("pointerdown", (e) => startDrag(e, book, el));
  else el.classList.add("locked");
  return el;
}

// ---- Rendering ----------------------------------------------------------
function renderMenu() {
  const grid = $("levelGrid");
  grid.innerHTML = "";
  for (const level of LEVELS) {
    const card = document.createElement("div");
    card.className = "level-card";
    card.innerHTML = `<h3>${level.name}</h3><p>${level.books.length} books</p>`;
    card.addEventListener("click", () => startLevel(level));
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
      shelf.appendChild(slot);
    }
  });
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
  const order = correctOrder(level.books);
  const slots = order.map((_, i) => null);
  // Pre-place locked anchor books at their correct positions.
  for (const i of level.preplaced) slots[i] = order[i];
  state = { level, order, slots, pileOrder: shuffled(level.books) };
  $("levelTitle").textContent = level.name;
  $("instructions").textContent = level.instructions;
  $("menu").style.display = "none";
  $("game").style.display = "block";
  $("success").style.display = "none";
  hideHint();
  renderShelf();
  renderPile();
}

function backToMenu() {
  state = null;
  $("game").style.display = "none";
  $("success").style.display = "none";
  $("menu").style.display = "block";
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
  drag = { book, originEl, clone, offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top };
  moveClone(e);
  window.addEventListener("pointermove", moveClone);
  window.addEventListener("pointerup", endDrag);
}

function moveClone(e) {
  if (!drag) return;
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
  const { book } = drag;
  drag.clone.remove();
  document.querySelectorAll(".slot.over").forEach((s) => s.classList.remove("over"));
  drag = null;
  if (slot) tryPlace(book, Number(slot.dataset.index));
  else renderPile(); // dropped in empty space — restore the spine
}

// ---- Placement rule -----------------------------------------------------
function tryPlace(book, slotIndex) {
  if (isCorrectPlacement(book, slotIndex, state.level.books)) {
    state.slots[slotIndex] = book;
    hideHint();
    renderShelf();
    renderPile();
    flashCorrect(slotIndex);
    if (pileBooks().length === 0) win();
  } else {
    showHint(hintFor(book, state.order[slotIndex]));
    bounceBack();
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
