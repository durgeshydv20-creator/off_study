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

/** Get current active session user info (UID, email, name, role) */
function getCurrentUserInfo() {
  let uid = '';
  let email = '';
  let name = '';
  let role = 'student';

  try {
    if (window.OffStudyAuth && typeof OffStudyAuth.getCurrentUser === 'function') {
      const u = OffStudyAuth.getCurrentUser();
      if (u) {
        uid = u.uid || '';
        email = (u.email || '').toLowerCase().trim();
        name = u.displayName || '';
      }
    }
  } catch(e) {}

  if (!email || !uid) {
    try {
      const u = JSON.parse(localStorage.getItem('sv_user'));
      if (u) {
        if (!uid && u.uid) uid = u.uid;
        if (!email && u.email) email = (u.email || '').toLowerCase().trim();
        if (!name && u.name) name = u.name;
        if (u.role) role = u.role;
      }
    } catch(e) {}
  }

  const isAdm = (window.OffStudyAuth && typeof OffStudyAuth.isEmailAdmin === 'function')
    ? OffStudyAuth.isEmailAdmin(email)
    : (email === ADMIN_EMAIL_DB || email.startsWith('admin@') || email.includes('durgesh'));

  if (isAdm) role = 'admin';

  return { uid, email, name, role, isAdmin: isAdm };
}

/* ─── IndexedDB Config for Private Vault ───────────────────────────────────── */
const LOCAL_DB_NAME = 'OffStudyPrivateVault';
const LOCAL_DB_VERSION = 2;
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
        store.createIndex('userEmail', 'userEmail', { unique: false });
        store.createIndex('userId', 'userId', { unique: false });
      } else {
        const store = req.transaction.objectStore(LOCAL_STORE_NAME);
        if (!store.indexNames.contains('userEmail')) store.createIndex('userEmail', 'userEmail', { unique: false });
        if (!store.indexNames.contains('userId')) store.createIndex('userId', 'userId', { unique: false });
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
 * - If not isOfficial (Student or Admin Private): Saves strictly to Private Vault for that specific user.
 */
async function addNote(note, options = {}) {
  const noteId = note.id || ('note-' + Date.now() + '-' + Math.random().toString(36).slice(2));
  note.id = noteId;

  const currentUser = getCurrentUserInfo();
  const canPublishCloud = currentUser.isAdmin;
  const isOfficial = canPublishCloud && (options.isOfficial !== false);

  note.isOfficial = isOfficial;
  note.userId = currentUser.uid || '';
  note.userEmail = currentUser.email || '';
  note.author = isOfficial
    ? 'OffStudy Official'
    : (currentUser.name ? `${currentUser.name} (Private)` : 'Personal Vault');

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
    // CLOUD UPLOAD (ADMIN ONLY -> Published globally for all students)
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
      uploadedBy: currentUser.email || 'Admin',
      uploaderUid: currentUser.uid || '',
      hasChunks: !!isLarge
    };

    if (dataUrl && !isLarge) {
      cloudDoc.fileData = dataUrl;
    }

    const docRef = firestoreDb.collection('notes').doc(noteId);
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
    // PRIVATE VAULT (Personal -> STRICTLY visible only to this user)
    // ══════════════════════════════════════════════════════════════
    const privateNote = {
      ...note,
      isOfficial: false,
      userId: currentUser.uid || '',
      userEmail: currentUser.email || '',
      author: currentUser.isAdmin ? 'Admin (Private Vault)' : (currentUser.name ? `${currentUser.name} (Private)` : 'Personal Vault')
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
      console.log('🔒 Note saved to Personal Private Vault for:', currentUser.email || 'user', noteId);
    }
  }

  return noteId;
}

/**
 * Return notes:
 * - scope: 'all' (Official Cloud Notes + CURRENT USER's Private Notes)
 * - scope: 'official' (Only Official Notes by OffStudy)
 * - scope: 'private' (Only CURRENT USER's Private Notes)
 * 
 * IMPORTANT:
 * - A student's private notes NEVER appear in the Admin's panel!
 * - If Admin uploads private notes, they ONLY appear in Admin's own private vault!
 */
async function getNotes(options = {}) {
  const scope = options.scope || 'all';
  const currentUser = getCurrentUserInfo();
  let officialNotes = [];
  let privateNotes = [];

  // 1. Fetch Official Notes from Firebase Cloud (Publicly available to all)
  if (scope === 'all' || scope === 'official') {
    const firestoreDb = getFirestoreDb();
    if (firestoreDb) {
      try {
        const snap = await firestoreDb.collection('notes').orderBy('uploadDate', 'desc').get();
        snap.forEach(doc => {
          const data = doc.data();

          // If note is explicitly marked private in cloud, only the owner can see it
          if (data.isOfficial === false || data.scope === 'private') {
            const ownerEmail = (data.userEmail || data.uploadedBy || '').toLowerCase().trim();
            const ownerUid = data.uploaderUid || data.userId || '';
            const isOwner = (currentUser.uid && ownerUid === currentUser.uid) ||
                            (currentUser.email && ownerEmail === currentUser.email);
            if (isOwner && (scope === 'all' || scope === 'private')) {
              privateNotes.push({ ...data, isOfficial: false });
            }
            return;
          }

          // Published official study material
          data.isOfficial = true;
          officialNotes.push(data);
        });
      } catch (err) {
        console.warn('Could not fetch cloud notes:', err);
      }
    }
  }

  // 2. Fetch Personal Notes from IndexedDB Private Vault (STRICT USER ISOLATION)
  if (scope === 'all' || scope === 'private') {
    try {
      const localDb = await openPrivateDB();
      if (localDb) {
        const allLocal = await new Promise((resolve) => {
          const tx = localDb.transaction(LOCAL_STORE_NAME, 'readonly');
          const store = tx.objectStore(LOCAL_STORE_NAME);
          const req = store.getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => resolve([]);
        });

        allLocal.forEach(n => {
          const noteOwnerEmail = (n.userEmail || n.ownerEmail || '').toLowerCase().trim();
          const noteOwnerUid = n.userId || n.uploaderUid || '';

          // Match ownership strictly
          if (noteOwnerEmail || noteOwnerUid) {
            const isOwner = (currentUser.uid && noteOwnerUid === currentUser.uid) ||
                            (currentUser.email && noteOwnerEmail === currentUser.email);
            if (isOwner) {
              privateNotes.push({ ...n, isOfficial: false });
            }
          } else {
            // Legacy untagged notes in browser:
            // Admin must NEVER see other users' untagged private notes!
            // Only regular student on this machine can see them.
            if (!currentUser.isAdmin && currentUser.email) {
              privateNotes.push({ ...n, isOfficial: false });
            }
          }
        });
      }
    } catch (err) {
      console.warn('Could not fetch private notes:', err);
    }
  }

  // Merge according to requested scope
  let combined = [];
  if (scope === 'official') combined = officialNotes;
  else if (scope === 'private') combined = privateNotes;
  else combined = [...officialNotes, ...privateNotes];

  // Sort newest first
  combined.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
  return combined;
}

/** Return single note by id (searches cloud and private vault with access check) */
async function getNote(id) {
  const currentUser = getCurrentUserInfo();

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
        const ownerEmail = (privateNote.userEmail || privateNote.ownerEmail || '').toLowerCase().trim();
        const ownerUid = privateNote.userId || privateNote.uploaderUid || '';

        // If note has owner info, verify access
        if (ownerEmail || ownerUid) {
          const isOwner = (currentUser.uid && ownerUid === currentUser.uid) ||
                          (currentUser.email && ownerEmail === currentUser.email);
          if (isOwner) {
            privateNote.isOfficial = false;
            return privateNote;
          }
          // Not the owner -> access denied
          return null;
        } else {
          // Untagged note: allow only non-admin on this device
          if (!currentUser.isAdmin && currentUser.email) {
            privateNote.isOfficial = false;
            return privateNote;
          }
          return null;
        }
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

        // If cloud note is private, enforce ownership
        if (note.isOfficial === false || note.scope === 'private') {
          const ownerEmail = (note.userEmail || note.uploadedBy || '').toLowerCase().trim();
          const ownerUid = note.uploaderUid || note.userId || '';
          const isOwner = (currentUser.uid && ownerUid === currentUser.uid) ||
                          (currentUser.email && ownerEmail === currentUser.email);
          if (!isOwner) return null;
          note.isOfficial = false;
        } else {
          note.isOfficial = true;
        }

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
 * - If Private Note: Owner can delete their own private note.
 * - If Official Cloud Note: ONLY Admin is allowed to delete!
 */
async function deleteNote(id) {
  const currentUser = getCurrentUserInfo();

  // 1. Try deleting from Private Vault (IndexedDB)
  try {
    const localDb = await openPrivateDB();
    if (localDb) {
      const existing = await new Promise((resolve) => {
        const tx = localDb.transaction(LOCAL_STORE_NAME, 'readonly');
        const req = tx.objectStore(LOCAL_STORE_NAME).get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });

      if (existing) {
        const ownerEmail = (existing.userEmail || existing.ownerEmail || '').toLowerCase().trim();
        const ownerUid = existing.userId || existing.uploaderUid || '';
        const isOwner = !ownerEmail ||
                        (currentUser.uid && ownerUid === currentUser.uid) ||
                        (currentUser.email && ownerEmail === currentUser.email) ||
                        currentUser.isAdmin;

        if (isOwner) {
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
    }
  } catch (err) {
    console.warn('Private note delete error:', err);
  }

  // 2. If it's a Cloud Note, check Admin permission
  if (!currentUser.isAdmin) {
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
