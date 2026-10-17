/**
 * storage.js — OffStudy Cloud & Personal Vault Data Layer
 * Powered by Google Firebase Firestore (Official Notes) & Local IndexedDB (Student Private Vault)
 *
 * Rules:
 * 1. Admin uploads -> Firebase Cloud (Published globally for all users)
 * 2. Student uploads -> Private Local Storage (Visible ONLY to that student on their device)
 *
 * NOTE: Firebase is initialized by auth.js which MUST be loaded before this file.
 */

const ADMIN_EMAIL_DB = 'admin@offstudy.com';

/* ─── Get Firestore DB (from auth.js singleton) ─────────────────────────────── */
function getFirestoreDb() {
  // auth.js exposes the db via OffStudyAuth.db after init
  if (window.OffStudyAuth && window.OffStudyAuth.db) return window.OffStudyAuth.db;
  // Fallback: try firebase directly if available
  try {
    if (typeof firebase !== 'undefined' && firebase.apps.length) {
      return firebase.firestore();
    }
  } catch(e) { /* ignore */ }
  return null;
}

/* ─── Check Admin Status via Firebase Auth ─────────────────────────────────── */
function isAdmin() {
  try {
    if (window.OffStudyAuth && typeof OffStudyAuth.isAdmin === 'function') {
      const res = OffStudyAuth.isAdmin();
      if (res) return true;
    }
    if (typeof firebase !== 'undefined' && firebase.apps.length) {
      const user = firebase.auth().currentUser;
      if (user && user.email) {
        if (window.OffStudyAuth && typeof OffStudyAuth.isEmailAdmin === 'function') {
          if (OffStudyAuth.isEmailAdmin(user.email)) return true;
        } else {
          const em = user.email.toLowerCase().trim();
          if (em === ADMIN_EMAIL_DB || em.startsWith('admin@') || em.includes('durgesh')) return true;
        }
      }
    }
  } catch(e) { /* ignore */ }
  // Check localStorage synchronous session
  try {
    const u = JSON.parse(localStorage.getItem('sv_user'));
    if (u) {
      if (u.role === 'admin') return true;
      if (u.email) {
        if (window.OffStudyAuth && typeof OffStudyAuth.isEmailAdmin === 'function') {
          if (OffStudyAuth.isEmailAdmin(u.email)) return true;
        } else {
          const em = u.email.toLowerCase().trim();
          if (em === ADMIN_EMAIL_DB || em.startsWith('admin@') || em.includes('durgesh')) return true;
        }
      }
    }
  } catch { return false; }
  return false;
}

/* ─── IndexedDB Config for Private Vault ───────────────────────────────────── */
const LOCAL_DB_NAME = 'OffStudyPrivateVault';
const LOCAL_DB_VERSION = 1;
const LOCAL_STORE_NAME = 'private_notes';

function openPrivateDB() {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null);
    const req = indexedDB.open(LOCAL_DB_NAME, LOCAL_DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(LOCAL_STORE_NAME)) {
        const store = db.createObjectStore(LOCAL_STORE_NAME, { keyPath: 'id' });
        store.createIndex('subject', 'subject', { unique: false });
        store.createIndex('uploadDate', 'uploadDate', { unique: false });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = () => resolve(null);
  });
}

/* ─── Helper: File <-> DataURL ─────────────────────────────────────────────── */
function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    if (typeof file === 'string') return resolve(file);
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

function dataURLtoBlob(dataurl) {
  if (!dataurl) return null;
  try {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'application/octet-stream';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  } catch (err) {
    console.error('DataURL to Blob failed:', err);
    return null;
  }
}

/* ─── Public API ───────────────────────────────────────────────────────────── */

/**
 * Add a note:
 * - If isOfficial (Admin): Uploads to Firebase Cloud for everyone.
 * - If not isOfficial (Student): Saves ONLY to Private Local Vault on this device.
 */
async function addNote(note, options = {}) {
  const noteId = note.id || ('note-' + Date.now() + '-' + Math.random().toString(36).slice(2));
  note.id = noteId;

  // Determine whether this is Official (Cloud) or Private (Local)
  // Only an Admin can publish official notes to Cloud
  const canPublishCloud = isAdmin();
  const isOfficial = canPublishCloud && (options.isOfficial !== false);

  note.isOfficial = isOfficial;
  note.author = isOfficial ? 'OffStudy Official' : (options.author || 'Private Student Vault');

  // Convert blob to DataURL if needed
  let dataUrl = null;
  if (note.blob) {
    try {
      dataUrl = await fileToDataURL(note.blob);
    } catch (e) {
      console.warn('Failed to convert blob:', e);
    }
  }

  if (isOfficial) {
    // ══════════════════════════════════════════════════════════════
    // CLOUD UPLOAD (ADMIN ONLY -> Visible to ALL students)
    // ══════════════════════════════════════════════════════════════
    const firestoreDb = getFirestoreDb();
    if (!firestoreDb) {
      throw new Error('Firebase Cloud is not connected. Please check your internet connection.');
    }

    const CHUNK_SIZE = 600000;
    const isLarge = dataUrl && dataUrl.length > 800000;

    const cloudDoc = {
      id: noteId,
      title: note.title || 'Untitled',
      subject: note.subject || 'General',
      description: note.description || '',
      fileName: note.fileName || '',
      fileType: note.fileType || 'FILE',
      fileSize: note.fileSize || 0,
      pages: note.pages || null,
      uploadDate: note.uploadDate || new Date().toISOString(),
      isOfficial: true,
      author: 'OffStudy Official',
      hasChunks: !!isLarge
    };

    if (dataUrl && !isLarge) {
      cloudDoc.fileData = dataUrl;
    }

    const db = getFirestoreDb();
    const docRef = db.collection('notes').doc(noteId);
    await docRef.set(cloudDoc);

    if (isLarge && dataUrl) {
      const totalChunks = Math.ceil(dataUrl.length / CHUNK_SIZE);
      for (let i = 0; i < totalChunks; i++) {
        const chunkStr = dataUrl.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        await docRef.collection('chunks').doc(String(i)).set({
          index: i,
          data: chunkStr
        });
      }
    }
    console.log('🌐 Note published to Official Cloud by Admin:', noteId);

  } else {
    // ══════════════════════════════════════════════════════════════
    // PRIVATE STUDENT VAULT (Local only -> Never sent to cloud)
    // ══════════════════════════════════════════════════════════════
    const privateNote = {
      ...note,
      isOfficial: false,
      author: 'My Private Vault'
    };

    const localDb = await openPrivateDB();
    if (localDb) {
      await new Promise((resolve, reject) => {
        const tx = localDb.transaction(LOCAL_STORE_NAME, 'readwrite');
        const store = tx.objectStore(LOCAL_STORE_NAME);
        store.put(privateNote);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
      console.log('🔒 Note saved to Personal Private Vault (local only):', noteId);
    }
  }

  return noteId;
}

/**
 * Return notes:
 * - scope: 'all' (Official Cloud Notes + Student's Private Notes)
 * - scope: 'official' (Only Official Notes by OffStudy)
 * - scope: 'private' (Only Student's Private Notes)
 */
async function getNotes(options = {}) {
  const scope = options.scope || 'all';
  let officialNotes = [];
  let privateNotes = [];

  // 1. Fetch Official Notes from Firebase Cloud (if requested)
  if (scope === 'all' || scope === 'official') {
    const firestoreDb = getFirestoreDb();
    if (firestoreDb) {
      try {
        const snap = await firestoreDb.collection('notes').orderBy('uploadDate', 'desc').get();
        snap.forEach(doc => {
          const data = doc.data();
          data.isOfficial = true;
          officialNotes.push(data);
        });
      } catch (err) {
        console.warn('Could not fetch cloud notes:', err);
      }
    }
  }

  // 2. Fetch Personal Notes from Student's Private Local Vault (if requested)
  if (scope === 'all' || scope === 'private') {
    try {
      const localDb = await openPrivateDB();
      if (localDb) {
        privateNotes = await new Promise((resolve) => {
          const tx = localDb.transaction(LOCAL_STORE_NAME, 'readonly');
          const store = tx.objectStore(LOCAL_STORE_NAME);
          const req = store.getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => resolve([]);
        });
        privateNotes.forEach(n => { n.isOfficial = false; });
      }
    } catch (err) {
      console.warn('Could not fetch private notes:', err);
    }
  }

  // Merge according to scope
  let combined = [];
  if (scope === 'official') combined = officialNotes;
  else if (scope === 'private') combined = privateNotes;
  else combined = [...officialNotes, ...privateNotes];

  // Sort newest first
  combined.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
  return combined;
}

/** Return single note by id (searches cloud and private vault) */
async function getNote(id) {
  // 1. Check Student's Private Vault first
  try {
    const localDb = await openPrivateDB();
    if (localDb) {
      const privateNote = await new Promise((resolve) => {
        const tx = localDb.transaction(LOCAL_STORE_NAME, 'readonly');
        const req = tx.objectStore(LOCAL_STORE_NAME).get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
      if (privateNote) {
        privateNote.isOfficial = false;
        return privateNote;
      }
    }
  } catch (err) {
    console.warn('Private note check failed:', err);
  }

  // 2. Check Firebase Cloud (Official Notes)
  const firestoreDb = getFirestoreDb();
  if (firestoreDb) {
    try {
      const docRef = firestoreDb.collection('notes').doc(id);
      const docSnap = await docRef.get();
      if (docSnap.exists) {
        const note = docSnap.data();
        note.isOfficial = true;

        if (note.hasChunks) {
          const chunkSnap = await docRef.collection('chunks').orderBy('index', 'asc').get();
          let fullData = '';
          chunkSnap.forEach(c => { fullData += (c.data().data || ''); });
          note.blob = dataURLtoBlob(fullData);
        } else if (note.fileData) {
          note.blob = dataURLtoBlob(note.fileData);
        }
        return note;
      }
    } catch (err) {
      console.warn('Cloud getNote failed:', err);
    }
  }

  return null;
}

/**
 * Delete a note:
 * - If Private Note: Any student can delete their own private note.
 * - If Official Cloud Note: ONLY Admin is allowed to delete!
 */
async function deleteNote(id) {
  // 1. Try deleting from Student's Private Vault
  try {
    const localDb = await openPrivateDB();
    if (localDb) {
      const exists = await new Promise((resolve) => {
        const tx = localDb.transaction(LOCAL_STORE_NAME, 'readonly');
        const req = tx.objectStore(LOCAL_STORE_NAME).get(id);
        req.onsuccess = () => resolve(!!req.result);
        req.onerror = () => resolve(false);
      });

      if (exists) {
        await new Promise((resolve) => {
          const tx = localDb.transaction(LOCAL_STORE_NAME, 'readwrite');
          tx.objectStore(LOCAL_STORE_NAME).delete(id);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        });
        console.log('🗑️ Deleted private note:', id);
        return;
      }
    }
  } catch (err) {
    console.warn('Private note delete error:', err);
  }

  // 2. If it's a Cloud Note, check Admin permission
  if (!isAdmin()) {
    throw new Error('Unauthorized: Only Admin can delete Official OffStudy materials.');
  }

  const firestoreDb = getFirestoreDb();
  if (firestoreDb) {
    try {
      const docRef = firestoreDb.collection('notes').doc(id);
      const chunkSnap = await docRef.collection('chunks').get();
      const batch = firestoreDb.batch();
      chunkSnap.forEach(c => batch.delete(c.ref));
      batch.delete(docRef);
      await batch.commit();
      console.log('🗑️ Admin deleted official cloud note:', id);
    } catch (err) {
      console.error('Firebase delete error:', err);
      throw err;
    }
  }
}

/** Search notes */
async function searchNotes(query, options = {}) {
  const all = await getNotes(options);
  if (!query) return all;
  const q = query.toLowerCase();
  return all.filter(n =>
    (n.title || '').toLowerCase().includes(q) ||
    (n.subject || '').toLowerCase().includes(q) ||
    (n.description || '').toLowerCase().includes(q) ||
    (n.fileName || '').toLowerCase().includes(q)
  );
}

/** Filter by subject */
async function filterNotes(subject, options = {}) {
  const all = await getNotes(options);
  if (!subject || subject === 'All') return all;
  return all.filter(n => n.subject === subject);
}

/** Return unique subjects */
async function getSubjects(options = {}) {
  const all = await getNotes(options);
  const subjects = {};
  all.forEach(n => {
    if (n.subject) subjects[n.subject] = (subjects[n.subject] || 0) + 1;
  });
  return subjects;
}

function cleanDemoData() { return Promise.resolve(); }
function seedDemoData() { return Promise.resolve(); }

/* ─── Export ───────────────────────────────────────────────────────────────── */
window.OffStudyDB = {
  addNote, getNotes, getNote, deleteNote, searchNotes, filterNotes,
  getSubjects, seedDemoData, cleanDemoData, isAdmin
};
window.StudyVaultDB = window.OffStudyDB;
