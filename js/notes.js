/**
 * notes.js — OffStudy Notes Page Logic
 * Handles rendering, filtering, sorting, viewing, and deleting notes.
 */

let allNotes = [];
let currentSubjectFilter = 'All';
let currentSourceFilter = 'all';
let currentSort = 'newest';

/* ─── Subject icon map ─────────────────────────────────────────────────────── */
const SUBJECT_ICONS = {
  'C++': '⚙', 'Java': '☕', 'Python': '🐍', 'Data Structures': '🌲',
  'Database': '🗄', 'Digital Logic': '⚡', 'Microprocessor': '💾',
  'Mathematics': '∑', 'Physics': '⚛', 'default': '📄'
};

function subjectIcon(subject) {
  return SUBJECT_ICONS[subject] || SUBJECT_ICONS['default'];
}

/* ─── File type badge colour ───────────────────────────────────────────────── */
function fileTypeBadge(type) {
  const t = (type || '').toUpperCase();
  const map = {
    PDF: 'badge-pdf', DOC: 'badge-doc', DOCX: 'badge-doc',
    TXT: 'badge-txt', MD: 'badge-txt', LOG: 'badge-txt',
    PPT: 'badge-ppt', PPTX: 'badge-ppt',
    JPG: 'badge-img', JPEG: 'badge-img', PNG: 'badge-img', GIF: 'badge-img', WEBP: 'badge-img', SVG: 'badge-img',
    MP4: 'badge-video', MKV: 'badge-video', MOV: 'badge-video', WEBM: 'badge-video',
    MP3: 'badge-audio', WAV: 'badge-audio', OGG: 'badge-audio',
    ZIP: 'badge-zip', RAR: 'badge-zip', '7Z': 'badge-zip', TAR: 'badge-zip', GZ: 'badge-zip',
    PY: 'badge-code', JS: 'badge-code', TS: 'badge-code', CPP: 'badge-code', C: 'badge-code', JAVA: 'badge-code', HTML: 'badge-code', CSS: 'badge-code', JSON: 'badge-code', SQL: 'badge-code'
  };
  return map[t] || 'badge-default';
}

/* ─── Build note card HTML ─────────────────────────────────────────────────── */
function buildNoteCard(note) {
  const icon = subjectIcon(note.subject);
  const rel = SV.relativeTime(note.uploadDate);
  const size = SV.formatSize(note.fileSize);
  const pages = note.pages ? `${note.pages} pages` : '';
  const meta = [note.fileType, pages, size].filter(Boolean).join(' · ');

  const isOfficial = !!note.isOfficial;
  const isUserAdmin = typeof SV !== 'undefined' && SV.isAdmin && SV.isAdmin();
  const canDelete = !isOfficial || isUserAdmin;

  const scopeBadge = isOfficial
    ? `<span class="badge badge-scope-official" title="Official verified study material published by OffStudy">🌐 OFFICIAL</span>`
    : `<span class="badge badge-scope-private" title="Personal note — saved privately only on your device">🔒 MY VAULT</span>`;

  return `
    <article class="note-card" data-id="${note.id}" data-animate style="animation-delay:${Math.random()*0.25}s">
      <div class="note-card-header">
        <div class="note-icon">${icon}</div>
        <div class="note-meta-top">
          <span class="note-subject">${note.subject}</span>
          ${scopeBadge}
          <span class="badge ${fileTypeBadge(note.fileType)}">${note.fileType}</span>
        </div>
        ${canDelete ? `
        <button class="note-delete" data-id="${note.id}" title="${isOfficial ? 'Delete official note (Admin)' : 'Delete private note'}" aria-label="Delete note">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
          </svg>
        </button>
        ` : ''}
      </div>
      <h3 class="note-title">${note.title}</h3>
      ${note.description ? `<p class="note-desc">${note.description}</p>` : ''}
      <div class="note-meta">${meta}</div>
      <div class="note-footer">
        <span class="note-date">${rel}</span>
        <div class="note-actions">
          <button class="btn-note-view" data-id="${note.id}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            VIEW
          </button>
          <button class="btn-note-download" data-id="${note.id}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            DOWNLOAD
          </button>
        </div>
      </div>
    </article>
  `;
}

/* ─── Render notes grid ────────────────────────────────────────────────────── */
function renderNotes(notes) {
  const grid = document.getElementById('notes-grid');
  const empty = document.getElementById('empty-state');
  if (!grid) return;

  if (!notes || notes.length === 0) {
    grid.innerHTML = '';
    if (empty) empty.style.display = 'flex';
    return;
  }

  if (empty) empty.style.display = 'none';
  grid.innerHTML = notes.map(buildNoteCard).join('');

  // Observer for fade-in animations
  grid.querySelectorAll('[data-animate]').forEach(el => {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('animated'); obs.unobserve(e.target); } });
    }, { threshold: 0.05 });
    obs.observe(el);
  });
}

/* ─── Card event delegation ────────────────────────────────────────────────── */
function bindNoteCardEvents(container) {
  if (!container || container.dataset.eventsBound) return;
  container.dataset.eventsBound = 'true';

  container.addEventListener('click', async (e) => {
    const viewBtn = e.target.closest('.btn-note-view');
    const dlBtn = e.target.closest('.btn-note-download');
    const delBtn = e.target.closest('.note-delete');

    if (viewBtn) { await viewNote(viewBtn.dataset.id); return; }
    if (dlBtn) { await downloadNote(dlBtn.dataset.id); return; }
    if (delBtn) { await confirmDeleteNote(delBtn.dataset.id); return; }
  });
}

/* ─── Sort notes ───────────────────────────────────────────────────────────── */
function sortNotes(notes, sort) {
  return [...notes].sort((a, b) => {
    if (sort === 'newest') return new Date(b.uploadDate) - new Date(a.uploadDate);
    if (sort === 'oldest') return new Date(a.uploadDate) - new Date(b.uploadDate);
    if (sort === 'title-az') return a.title.localeCompare(b.title);
    if (sort === 'title-za') return b.title.localeCompare(a.title);
    return 0;
  });
}

/* ─── Apply filter + sort + render ────────────────────────────────────────── */
async function applyFilters() {
  let notes = await OffStudyDB.getNotes({ scope: currentSourceFilter });

  if (currentSubjectFilter && currentSubjectFilter !== 'All') {
    notes = notes.filter(n => n.subject === currentSubjectFilter);
  }

  notes = sortNotes(notes, currentSort);

  const searchInput = document.getElementById('search-input');
  const q = searchInput ? searchInput.value.trim() : '';
  if (q) {
    const ql = q.toLowerCase();
    notes = notes.filter(n =>
      (n.title || '').toLowerCase().includes(ql) ||
      (n.subject || '').toLowerCase().includes(ql) ||
      (n.description || '').toLowerCase().includes(ql) ||
      (n.fileName || '').toLowerCase().includes(ql)
    );
  }

  renderNotes(notes);
  if (typeof updateResultCount === 'function') {
    updateResultCount(notes.length, q);
  }
}

/* ─── Load all notes ───────────────────────────────────────────────────────── */
async function loadNotes() {
  const notes = await OffStudyDB.getNotes({ scope: 'all' });
  allNotes = notes;
  await applyFilters();
  await populateSubjectFilter(notes);
}

/* ─── Populate subject filter dropdown ─────────────────────────────────────── */
async function populateSubjectFilter(notes) {
  const select = document.getElementById('subject-filter');
  if (!select) return;
  const subjects = [...new Set(notes.map(n => n.subject).filter(Boolean))].sort();
  const current = currentSubjectFilter || select.value;
  select.innerHTML = '<option value="All">All Subjects</option>' +
    subjects.map(s => `<option value="${s}"${s === current ? ' selected' : ''}>${s}</option>`).join('');
}

/* ─── View note modal ──────────────────────────────────────────────────────── */
async function viewNote(id) {
  const note = await OffStudyDB.getNote(id);
  if (!note) return;

  const modal = document.getElementById('viewer-modal');
  if (!modal) return;

  document.getElementById('viewer-title').textContent = note.title;
  document.getElementById('viewer-subject').textContent = note.subject;
  document.getElementById('viewer-date').textContent = new Date(note.uploadDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  document.getElementById('viewer-type').textContent = note.fileType;
  document.getElementById('viewer-size').textContent = SV.formatSize(note.fileSize);

  const previewArea = document.getElementById('viewer-preview');
  previewArea.innerHTML = '';

  if (note.blob) {
    const url = URL.createObjectURL(note.blob);
    const type = (note.blob.type || '').toLowerCase();
    const ext = (note.fileName || '').split('.').pop().toLowerCase();

    if (type === 'application/pdf' || note.fileType === 'PDF' || ext === 'pdf') {
      previewArea.innerHTML = `<iframe src="${url}" title="${note.title}" class="pdf-frame"></iframe>`;
    } else if (type.startsWith('image/') || ['jpg','jpeg','png','gif','webp','svg','bmp'].includes(ext)) {
      previewArea.innerHTML = `<img src="${url}" alt="${note.title}" class="img-preview">`;
    } else if (type.startsWith('video/') || ['mp4','webm','ogg','mov','mkv'].includes(ext)) {
      previewArea.innerHTML = `<video src="${url}" controls class="video-preview" style="max-width:100%;max-height:65vh;border-radius:var(--radius-sm);outline:none;background:#000;"></video>`;
    } else if (type.startsWith('audio/') || ['mp3','wav','ogg','m4a','flac'].includes(ext)) {
      previewArea.innerHTML = `<div style="padding:48px 24px;text-align:center;"><div style="font-size:54px;margin-bottom:18px;">🎵</div><p style="margin-bottom:20px;font-weight:600;">${escapeHtml(note.fileName)}</p><audio src="${url}" controls style="width:100%;max-width:440px;"></audio></div>`;
    } else if (type.startsWith('text/') || ['txt','md','js','ts','py','java','c','cpp','cs','html','css','json','xml','sql','sh','log','csv'].includes(ext)) {
      try {
        const text = await note.blob.text();
        previewArea.innerHTML = `<pre class="txt-preview" style="white-space:pre-wrap;word-break:break-word;max-height:60vh;overflow-y:auto;background:var(--surface-card);padding:20px;border-radius:var(--radius-sm);border:1px solid var(--border);font-family:monospace;font-size:13px;line-height:1.6;">${escapeHtml(text)}</pre>`;
      } catch {
        previewArea.innerHTML = `<div class="preview-unavailable"><div class="preview-icon">📄</div><p>Unable to display file content.</p></div>`;
      }
    } else {
      previewArea.innerHTML = `
        <div class="preview-unavailable" style="padding:40px 20px; text-align:center;">
          <div class="preview-icon" style="font-size:48px; margin-bottom:14px;">📦</div>
          <p style="font-size:17px; font-weight:700; color:var(--text); margin-bottom:8px;">${escapeHtml(note.fileName)}</p>
          <p style="color:var(--muted); font-size:13px; margin-bottom:24px;">Direct preview is not available for this file type. Click download to view it on your device.</p>
          <button class="btn-primary" id="preview-inline-dl-btn">DOWNLOAD FILE</button>
        </div>
      `;
      const inlineDlBtn = document.getElementById('preview-inline-dl-btn');
      if (inlineDlBtn) inlineDlBtn.onclick = () => downloadNote(id);
    }

    // Wire open/download buttons
    document.getElementById('viewer-open-btn').style.display = '';
    document.getElementById('viewer-download-btn').style.display = '';
    document.getElementById('viewer-open-btn').onclick = () => window.open(url, '_blank');
    document.getElementById('viewer-download-btn').onclick = () => {
      const a = document.createElement('a');
      a.href = url; a.download = note.fileName; a.click();
    };
  } else {
    // Note without blob
    previewArea.innerHTML = `<div class="preview-unavailable"><div class="preview-icon">📄</div><p>No file attached to this note.</p></div>`;
    document.getElementById('viewer-open-btn').style.display = 'none';
    document.getElementById('viewer-download-btn').style.display = 'none';
  }

  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

/* ─── Close viewer ─────────────────────────────────────────────────────────── */
function closeViewer() {
  const modal = document.getElementById('viewer-modal');
  if (!modal) return;
  modal.classList.remove('open');
  document.body.style.overflow = '';
  const preview = document.getElementById('viewer-preview');
  if (preview) preview.innerHTML = '';
}

/* ─── Download note ────────────────────────────────────────────────────────── */
async function downloadNote(id) {
  const note = await OffStudyDB.getNote(id);
  if (!note) return;
  if (!note.blob) { SV.showToast('Demo notes cannot be downloaded.', 'error'); return; }
  const url = URL.createObjectURL(note.blob);
  const a = document.createElement('a');
  a.href = url; a.download = note.fileName; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/* ─── Delete note ──────────────────────────────────────────────────────────── */
async function confirmDeleteNote(id) {
  const note = await OffStudyDB.getNote(id);
  if (!note) return;

  const isUserAdmin = typeof SV !== 'undefined' && SV.isAdmin && SV.isAdmin();
  if (note.isOfficial && !isUserAdmin) {
    SV.showToast('Protected: Only Admin can delete Official OffStudy notes.', 'error');
    return;
  }

  const modal = document.getElementById('confirm-modal');
  if (!modal) {
    if (confirm(`Delete "${note.title}"?`)) {
      await OffStudyDB.deleteNote(id);
      SV.showToast('Note deleted.', 'success');
      await loadNotes();
    }
    return;
  }

  document.getElementById('confirm-note-title').textContent = note.title;
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';

  document.getElementById('confirm-delete-btn').onclick = async () => {
    try {
      await OffStudyDB.deleteNote(id);
      modal.classList.remove('open');
      document.body.style.overflow = '';
      SV.showToast('Note deleted.', 'success');
      await loadNotes();
    } catch (err) {
      SV.showToast(err.message || 'Could not delete note.', 'error');
    }
  };
  document.getElementById('confirm-cancel-btn').onclick = () => {
    modal.classList.remove('open');
    document.body.style.overflow = '';
  };
}

/* ─── Escape HTML for text preview ─────────────────────────────────────────── */
function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* ─── Boot ─────────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const sParam = urlParams.get('s');
  if (sParam) {
    currentSubjectFilter = sParam;
  }

  const grid = document.getElementById('notes-grid');
  if (grid) bindNoteCardEvents(grid);

  await loadNotes();

  // Filter: Subject
  const subjectFilter = document.getElementById('subject-filter');
  if (subjectFilter) {
    if (sParam) subjectFilter.value = sParam;
    subjectFilter.addEventListener('change', async () => {
      currentSubjectFilter = subjectFilter.value;
      await applyFilters();
    });
  }

  // Filter: Source (All, Official, Private)
  const sourceFilter = document.getElementById('source-filter');
  if (sourceFilter) {
    sourceFilter.addEventListener('change', async () => {
      currentSourceFilter = sourceFilter.value;
      await applyFilters();
    });
  }

  // Sort
  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', async () => {
      currentSort = sortSelect.value;
      await applyFilters();
    });
  }

  // Viewer close
  document.getElementById('viewer-close-btn')?.addEventListener('click', closeViewer);
  document.getElementById('viewer-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'viewer-modal') closeViewer();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeViewer(); }
  });

  // Re-render notes when auth state resolves (e.g. admin delete buttons appear)
  window.addEventListener('offstudy:auth-changed', () => {
    loadNotes();
  });
});

// Expose for search.js
window.renderNotes = renderNotes;
window.loadNotes = loadNotes;
