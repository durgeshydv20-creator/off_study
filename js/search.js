/**
 * search.js — OffStudy Search Logic
 * Handles real-time search with debounce.
 */

let searchTimeout = null;

/* ─── Debounce helper ──────────────────────────────────────────────────────── */
function debounce(fn, delay) {
  return (...args) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => fn(...args), delay);
  };
}

/* ─── Show result count ────────────────────────────────────────────────────── */
function updateResultCount(count, query) {
  const countEl = document.getElementById('result-count');
  if (!countEl) return;
  if (!query) {
    countEl.textContent = '';
    return;
  }
  countEl.textContent = count > 0
    ? `${count} RESULT${count !== 1 ? 'S' : ''} FOUND`
    : 'NO NOTES FOUND';
  countEl.className = count > 0 ? 'result-count found' : 'result-count not-found';
}

/* ─── Perform search + render ──────────────────────────────────────────────── */
async function performSearch(query) {
  if (typeof renderNotes !== 'function') return;
  const notes = await OffStudyDB.searchNotes(query.trim());
  renderNotes(notes);
  updateResultCount(notes.length, query.trim());
}

/* ─── Init search input ────────────────────────────────────────────────────── */
function initSearch() {
  const input = document.getElementById('search-input');
  if (!input) return;

  const debouncedSearch = debounce(performSearch, 280);

  input.addEventListener('input', () => {
    const q = input.value;
    if (!q.trim()) {
      updateResultCount(0, '');
      if (typeof loadNotes === 'function') loadNotes();
    } else {
      debouncedSearch(q);
    }
  });

  // Pre-fill from URL param
  const urlParams = new URLSearchParams(window.location.search);
  const qParam = urlParams.get('q');
  if (qParam) {
    input.value = qParam;
    performSearch(qParam);
  }
}

document.addEventListener('DOMContentLoaded', initSearch);
