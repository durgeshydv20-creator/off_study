/**
 * upload.js — OffStudy Upload System
 * Handles drag-drop, file selection, validation, and storing via OffStudyDB.
 */

let selectedFile = null;

/* ─── Derive friendly type label ───────────────────────────────────────────── */
function getFileTypeLabel(file) {
  if (!file || !file.name) return 'FILE';
  const parts = file.name.split('.');
  if (parts.length > 1) {
    return parts.pop().toUpperCase().slice(0, 8);
  }
  return 'FILE';
}

/* ─── Validate file (Allows all file types) ────────────────────────────────── */
function validateFile(file) {
  if (!file) {
    return 'Please select a file to upload.';
  }
  if (file.size > 200 * 1024 * 1024) {
    return 'File size must be under 200 MB.';
  }
  return null;
}

/* ─── Update drop zone UI ──────────────────────────────────────────────────── */
function updateDropZoneUI(file) {
  const dropZone = document.getElementById('drop-zone');
  const fileInfo = document.getElementById('file-info');
  const fileName = document.getElementById('file-name');
  const fileSize = document.getElementById('file-size');
  const fileTypeIcon = document.getElementById('file-type-icon');

  if (!dropZone) return;

  if (file) {
    dropZone.classList.add('has-file');
    if (fileInfo) fileInfo.style.display = 'flex';
    if (fileName) fileName.textContent = file.name;
    if (fileSize) fileSize.textContent = SV.formatSize(file.size);
    if (fileTypeIcon) fileTypeIcon.textContent = getFileTypeLabel(file);
  } else {
    dropZone.classList.remove('has-file');
    if (fileInfo) fileInfo.style.display = 'none';
  }
}

/* ─── Handle file selection ────────────────────────────────────────────────── */
function handleFileSelect(file) {
  const err = validateFile(file);
  if (err) {
    SV.showToast(err, 'error');
    selectedFile = null;
    updateDropZoneUI(null);
    return;
  }
  selectedFile = file;
  updateDropZoneUI(file);
}

/* ─── Init drag-drop zone ──────────────────────────────────────────────────── */
function initDropZone() {
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const browseBtn = document.getElementById('browse-btn');
  if (!dropZone) return;

  ['dragenter', 'dragover'].forEach(ev => {
    dropZone.addEventListener(ev, (e) => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });
  });
  ['dragleave', 'dragend'].forEach(ev => {
    dropZone.addEventListener(ev, () => dropZone.classList.remove('drag-over'));
  });
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  });

  if (browseBtn && fileInput) {
    browseBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      if (fileInput.files[0]) handleFileSelect(fileInput.files[0]);
    });
  }
}

/* ─── Render Scope UI (Admin vs Student Private Vault) ────────────────────── */
function renderUploadScopeUI() {
  let container = document.getElementById('upload-scope-container');
  const form = document.getElementById('upload-form');
  if (!container && form) {
    container = document.createElement('div');
    container.id = 'upload-scope-container';
    form.insertBefore(container, form.firstChild);
  }
  if (!container) return;

  const isAdmin = (typeof SV !== 'undefined' && SV.isAdmin && SV.isAdmin()) ||
                  (typeof OffStudyAuth !== 'undefined' && OffStudyAuth.isAdmin && OffStudyAuth.isAdmin()) ||
                  (typeof OffStudyDB !== 'undefined' && OffStudyDB.isAdmin && OffStudyDB.isAdmin());

  const cardSub = document.querySelector('.upload-card-sub');
  const sectionTag = document.querySelector('.upload-card-header .section-tag');
  const submitBtn = document.getElementById('upload-submit-btn');

  if (isAdmin) {
    if (sectionTag) sectionTag.innerHTML = `👑 Admin Publishing Mode`;
    if (cardSub) cardSub.innerHTML = `Upload verified study material directly to <strong>OffStudy Official Cloud</strong> for all students, or save privately.`;
    if (submitBtn && submitBtn.textContent.trim().toUpperCase() === 'UPLOAD') {
      submitBtn.innerHTML = `PUBLISH TO CLOUD <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`;
    }

    container.innerHTML = `
      <div class="form-group" style="margin-bottom:20px;">
        <label class="form-label" style="display:flex; justify-content:space-between; align-items:center;">
          <span>👑 Admin Publishing Mode</span>
          <span style="font-size:11px; color:var(--accent); font-weight:600; text-transform:none;">Official Cloud Upload</span>
        </label>
        <div class="scope-selector">
          <label class="scope-option active" id="scope-opt-official">
            <input type="radio" name="upload-scope" value="official" checked>
            <span class="scope-icon">🌐</span>
            <div>
              <div class="scope-title">Publish to OffStudy Official Cloud</div>
              <div class="scope-desc">Published globally. Every student visiting OffStudy can view &amp; download this note.</div>
            </div>
          </label>
          <label class="scope-option" id="scope-opt-private">
            <input type="radio" name="upload-scope" value="private">
            <span class="scope-icon">🔒</span>
            <div>
              <div class="scope-title">Save as Private Personal Note</div>
              <div class="scope-desc">Saved only to your private local storage. Hidden from other students.</div>
            </div>
          </label>
        </div>
      </div>
    `;

    const optOff = container.querySelector('#scope-opt-official');
    const optPriv = container.querySelector('#scope-opt-private');
    container.querySelectorAll('input[name="upload-scope"]').forEach(r => {
      r.addEventListener('change', () => {
        if (r.value === 'official') {
          optOff?.classList.add('active');
          optPriv?.classList.remove('active');
          if (submitBtn) submitBtn.innerHTML = `PUBLISH TO CLOUD <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`;
        } else {
          optPriv?.classList.add('active');
          optOff?.classList.remove('active');
          if (submitBtn) submitBtn.innerHTML = `SAVE TO VAULT <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`;
        }
      });
    });
  } else {
    if (sectionTag) sectionTag.innerHTML = `Upload System`;
    if (cardSub) cardSub.innerHTML = `Add PDFs, documents, presentations or images to your personal vault.`;
    if (submitBtn && submitBtn.textContent.trim().toUpperCase() !== 'UPLOADING...') {
      submitBtn.innerHTML = `UPLOAD <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`;
    }
    container.innerHTML = `
      <div class="private-vault-notice">
        <span class="pvn-icon">🔒</span>
        <div>
          <strong>Personal Student Vault:</strong> Your uploaded material stays strictly in your own browser's private vault on this device. It is <strong>NOT</strong> shared with other students or uploaded to the public website.
        </div>
      </div>
    `;
  }
}

/* ─── Open upload modal ────────────────────────────────────────────────────── */
function openUploadModal() {
  const modal = document.getElementById('upload-modal');
  if (!modal) return;
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
  resetUploadForm();
  renderUploadScopeUI();
}

/* ─── Close upload modal ───────────────────────────────────────────────────── */
function closeUploadModal() {
  const modal = document.getElementById('upload-modal');
  if (!modal) return;
  modal.classList.remove('open');
  document.body.style.overflow = '';
  selectedFile = null;
  resetUploadForm();
}

/* ─── Reset form ───────────────────────────────────────────────────────────── */
function resetUploadForm() {
  const form = document.getElementById('upload-form');
  if (form) form.reset();
  selectedFile = null;
  updateDropZoneUI(null);
  // clear errors
  document.querySelectorAll('.field-error').forEach(e => e.textContent = '');
}

/* ─── Form validation ──────────────────────────────────────────────────────── */
function validateUploadForm() {
  let valid = true;
  const title = document.getElementById('note-title');
  const subject = document.getElementById('note-subject');
  const titleErr = document.getElementById('title-error');
  const subjectErr = document.getElementById('subject-error');
  const fileErr = document.getElementById('file-error');

  if (titleErr) titleErr.textContent = '';
  if (subjectErr) subjectErr.textContent = '';
  if (fileErr) fileErr.textContent = '';

  if (!title || !title.value.trim()) {
    if (titleErr) titleErr.textContent = 'Title is required.';
    valid = false;
  }
  if (!subject || !subject.value.trim()) {
    if (subjectErr) subjectErr.textContent = 'Subject is required.';
    valid = false;
  }
  if (!selectedFile) {
    if (fileErr) fileErr.textContent = 'Please select a file to upload.';
    valid = false;
  }
  return valid;
}

/* ─── Submit upload ────────────────────────────────────────────────────────── */
async function submitUpload() {
  if (!validateUploadForm()) return false;

  const title = document.getElementById('note-title').value.trim();
  const subject = document.getElementById('note-subject').value.trim();
  const desc = (document.getElementById('note-desc') || {}).value?.trim() || '';
  const uploadBtn = document.getElementById('upload-submit-btn');
  const origContent = uploadBtn ? uploadBtn.innerHTML : 'UPLOAD';

  if (uploadBtn) {
    uploadBtn.disabled = true;
    uploadBtn.textContent = 'UPLOADING...';
  }

  const scopeRadio = document.querySelector('input[name="upload-scope"]:checked');
  const isAdmin = typeof SV !== 'undefined' && SV.isAdmin && SV.isAdmin();
  const isOfficial = isAdmin ? (!scopeRadio || scopeRadio.value === 'official') : false;

  try {
    const note = {
      id: 'note-' + Date.now() + '-' + Math.random().toString(36).slice(2),
      title,
      subject,
      description: desc,
      fileName: selectedFile.name,
      fileType: getFileTypeLabel(selectedFile),
      fileSize: selectedFile.size,
      pages: null,
      uploadDate: new Date().toISOString(),
      blob: selectedFile
    };

    await OffStudyDB.addNote(note, { isOfficial });
    closeUploadModal();
    if (isOfficial) {
      SV.showToast('Published to OffStudy Official Cloud! 🌐', 'success');
    } else {
      SV.showToast('Saved to your Private Student Vault! 🔒', 'success');
    }

    // Refresh notes list if on notes page
    if (typeof loadNotes === 'function') await loadNotes();
    return true;

  } catch (err) {
    console.error('Upload failed:', err);
    SV.showToast(err.message || 'Upload failed. Please try again.', 'error');
    return false;
  } finally {
    if (uploadBtn) {
      uploadBtn.disabled = false;
      uploadBtn.innerHTML = origContent;
    }
  }
}

/* ─── Init upload buttons ──────────────────────────────────────────────────── */
function initUploadButtons() {
  // All "upload" trigger buttons
  document.querySelectorAll('[data-open-upload]').forEach(btn => {
    btn.addEventListener('click', openUploadModal);
  });

  // Cancel button
  const cancelBtn = document.getElementById('upload-cancel-btn');
  if (cancelBtn) cancelBtn.addEventListener('click', closeUploadModal);

  // Submit button — only bind if we have a modal overlay (not on the standalone upload page)
  const modal = document.getElementById('upload-modal');
  const submitBtn = document.getElementById('upload-submit-btn');
  if (submitBtn && modal) {
    submitBtn.addEventListener('click', submitUpload);
  }

  // Close on backdrop
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeUploadModal();
    });
  }

  // ESC key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeUploadModal();
  });
}

/* ─── Boot ─────────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initDropZone();
  initUploadButtons();
  renderUploadScopeUI();
});

// Re-render immediately whenever auth state is updated or restored
window.addEventListener('offstudy:auth-changed', () => {
  renderUploadScopeUI();
});
window.addEventListener('storage', (e) => {
  if (e.key === 'sv_user') renderUploadScopeUI();
});

window.openUploadModal = openUploadModal;
window.renderUploadScopeUI = renderUploadScopeUI;
