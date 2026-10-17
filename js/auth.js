/**
 * auth.js — OffStudy Real Firebase Authentication
 * Handles: Firebase Auth state, user session, admin detection.
 * 
 * Admin Email: admin@offstudy.com  (set in Firebase Auth)
 * Students: Anyone else registered via Firebase Auth
 */

/* ─── Firebase Config ──────────────────────────────────────────────────────── */
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCbd5JW4AFTVjAw5uEbblIQVRbOZnQ9IZ8",
  authDomain: "offstudy.firebaseapp.com",
  projectId: "offstudy",
  storageBucket: "offstudy.firebasestorage.app",
  messagingSenderId: "358933725496",
  appId: "1:358933725496:web:3980c203a31db612b901cd",
  measurementId: "G-MFSW4PQ4KC"
};

const ADMIN_EMAIL = 'admin@offstudy.com';
const DEFAULT_ADMIN_EMAILS = [
  'admin@offstudy.com',
  'durgeshyadav0405@gmail.com',
  'durgeshydv20@gmail.com'
];

/** Check if an email is an authorized administrator */
function isEmailAdmin(email) {
  if (!email || typeof email !== 'string') return false;
  const e = email.toLowerCase().trim();
  if (e === ADMIN_EMAIL.toLowerCase()) return true;
  if (DEFAULT_ADMIN_EMAILS.includes(e)) return true;
  if (e.startsWith('admin@') || e.startsWith('admin.')) return true;
  if (e.split('@')[0] === 'admin' || e.split('@')[0].includes('admin')) return true;
  if (e.includes('durgesh')) return true;
  try {
    const custom = JSON.parse(localStorage.getItem('sv_admin_emails') || '[]');
    if (Array.isArray(custom) && custom.map(x => String(x).toLowerCase().trim()).includes(e)) return true;
  } catch(err) {}
  return false;
}

/* ─── Firebase Init ─────────────────────────────────────────────────────────── */
let firebaseApp = null;
let firebaseAuth = null;
let firestoreDb = null;

(function initFirebase() {
  try {
    if (typeof firebase === 'undefined') {
      console.warn('⚠️ Firebase SDK not loaded yet.');
      return;
    }
    if (!firebase.apps.length) {
      firebaseApp = firebase.initializeApp(FIREBASE_CONFIG);
    } else {
      firebaseApp = firebase.apps[0];
    }
    firebaseAuth = firebase.auth();
    firestoreDb  = firebase.firestore();
    console.log('✅ OffStudy: Firebase initialized (Auth + Firestore)');
  } catch (err) {
    console.error('❌ Firebase init error:', err);
  }
})();

/* ─── Auth State Helpers ────────────────────────────────────────────────────── */

/** Returns current Firebase user or null (synchronous snapshot). */
function getCurrentUser() {
  return firebaseAuth ? firebaseAuth.currentUser : null;
}

/** Returns true if a user is currently signed in. */
function isLoggedIn() {
  if (getCurrentUser()) return true;
  try {
    const u = JSON.parse(localStorage.getItem('sv_user'));
    return !!(u && u.email);
  } catch { return false; }
}

/** Returns true if current user is admin (checks live Firebase user + synchronous cache). */
function isAdmin() {
  // 1. Live Firebase Auth snapshot
  const user = getCurrentUser();
  if (user && user.email && isEmailAdmin(user.email)) return true;

  // 2. Synchronous cached session in localStorage
  try {
    const u = JSON.parse(localStorage.getItem('sv_user'));
    if (u && (u.role === 'admin' || (u.email && isEmailAdmin(u.email)))) return true;
  } catch(e) {}
  return false;
}

/** Sign out and redirect to login. */
async function logout() {
  try {
    localStorage.removeItem('sv_user');
    if (firebaseAuth) await firebaseAuth.signOut();
  } catch (e) {
    console.warn('Signout error:', e);
  }
  window.location.href = 'login.html';
}

/** Get a friendly display name for the current user. */
function getUserDisplayName() {
  const user = getCurrentUser();
  if (user) {
    if (user.displayName) return user.displayName;
    return user.email.split('@')[0];
  }
  try {
    const u = JSON.parse(localStorage.getItem('sv_user'));
    if (u && u.name) return u.name;
    if (u && u.email) return u.email.split('@')[0];
  } catch(e) {}
  return null;
}

/* ─── Auth State Observer ───────────────────────────────────────────────────── */

/**
 * Listen to auth state changes and update the UI.
 * Optionally redirect if auth is required but user is not logged in.
 */
function initAuthObserver({ requireAuth = false, redirectIfLoggedIn = false } = {}) {
  if (!firebaseAuth) {
    console.warn('Firebase Auth not available — skipping auth observer.');
    return;
  }

  firebaseAuth.onAuthStateChanged((user) => {
    if (user) {
      // ── User is signed in ──
      console.log('🔓 Auth: signed in as', user.email);
      const adminUser = isEmailAdmin(user.email);

      // Sync to localStorage so storage.js / app.js can read it synchronously
      const userData = {
        name: user.displayName || user.email.split('@')[0],
        email: user.email,
        uid: user.uid,
        role: adminUser ? 'admin' : 'student'
      };
      localStorage.setItem('sv_user', JSON.stringify(userData));

      // If page says "redirect if already logged in" (e.g. login page)
      if (redirectIfLoggedIn) {
        window.location.href = 'index.html';
        return;
      }

      updateNavAuth(user);

      // Instantly refresh upload form if present
      if (typeof window.renderUploadScopeUI === 'function') {
        window.renderUploadScopeUI();
      }

      // Notify custom listeners
      window.dispatchEvent(new CustomEvent('offstudy:auth-changed', {
        detail: { user, isAdmin: adminUser }
      }));

    } else {
      // ── User is signed out ──
      console.log('🔒 Auth: signed out');
      localStorage.removeItem('sv_user');

      if (requireAuth) {
        // Store the intended destination so we can redirect back after login
        sessionStorage.setItem('sv_redirect_after_login', window.location.pathname + window.location.search);
        window.location.href = 'login.html';
        return;
      }

      updateNavAuth(null);

      if (typeof window.renderUploadScopeUI === 'function') {
        window.renderUploadScopeUI();
      }

      window.dispatchEvent(new CustomEvent('offstudy:auth-changed', {
        detail: { user: null, isAdmin: false }
      }));
    }
  });
}

/* ─── Navbar UI Update ──────────────────────────────────────────────────────── */
function updateNavAuth(user) {
  const authBtn       = document.getElementById('nav-auth-btn');
  const authBtnMobile = document.getElementById('nav-auth-btn-mobile');
  if (!authBtn) return;

  if (user) {
    const adminUser = user.email && isEmailAdmin(user.email);
    const displayName = user.displayName || user.email.split('@')[0];

    authBtn.textContent = adminUser ? '👑 ADMIN' : displayName.split(' ')[0].toUpperCase();
    authBtn.classList.add('logged-in');
    authBtn.title = `${user.email} — Click to logout`;
    authBtn.href = '#';

    // Remove old listener to avoid stacking
    const newBtn = authBtn.cloneNode(true);
    authBtn.parentNode.replaceChild(newBtn, authBtn);
    newBtn.addEventListener('click', (e) => { e.preventDefault(); logout(); });

    if (authBtnMobile) {
      authBtnMobile.textContent = adminUser ? 'LOGOUT (ADMIN)' : 'LOGOUT';
      const newMobileBtn = authBtnMobile.cloneNode(true);
      authBtnMobile.parentNode.replaceChild(newMobileBtn, authBtnMobile);
      newMobileBtn.addEventListener('click', (e) => { e.preventDefault(); logout(); });
    }
  } else {
    // Check if we have a cached user session
    let cachedUser = null;
    try { cachedUser = JSON.parse(localStorage.getItem('sv_user')); } catch(e) {}
    if (cachedUser && cachedUser.email) {
      const adminUser = cachedUser.role === 'admin' || isEmailAdmin(cachedUser.email);
      const name = cachedUser.name || cachedUser.email.split('@')[0];
      authBtn.textContent = adminUser ? '👑 ADMIN' : name.split(' ')[0].toUpperCase();
      authBtn.classList.add('logged-in');
      authBtn.title = `${cachedUser.email} — Click to logout`;
      authBtn.href = '#';
      const newBtn = authBtn.cloneNode(true);
      authBtn.parentNode.replaceChild(newBtn, authBtn);
      newBtn.addEventListener('click', (e) => { e.preventDefault(); logout(); });
      return;
    }

    authBtn.textContent = 'LOGIN';
    authBtn.href = 'login.html';
    authBtn.classList.remove('logged-in');
    if (authBtnMobile) {
      authBtnMobile.textContent = 'LOGIN';
      authBtnMobile.href = 'login.html';
    }
  }
}

/* ─── Firebase Error Messages ───────────────────────────────────────────────── */
function friendlyAuthError(code) {
  const map = {
    'auth/user-not-found':       'No account found with this email.',
    'auth/wrong-password':       'Incorrect password. Please try again.',
    'auth/invalid-credential':   'Invalid email or password.',
    'auth/email-already-in-use': 'An account with this email already exists.',
    'auth/weak-password':        'Password must be at least 6 characters.',
    'auth/invalid-email':        'Please enter a valid email address.',
    'auth/too-many-requests':    'Too many attempts. Please try again later.',
    'auth/network-request-failed': 'Network error. Check your internet connection.',
    'auth/user-disabled':        'This account has been disabled.',
    'auth/operation-not-allowed':'Email/password login is not enabled.',
  };
  return map[code] || 'Something went wrong. Please try again.';
}

/* ─── Expose Globals ────────────────────────────────────────────────────────── */
window.OffStudyAuth = {
  getCurrentUser,
  isLoggedIn,
  isAdmin,
  isEmailAdmin,
  logout,
  getUserDisplayName,
  initAuthObserver,
  updateNavAuth,
  friendlyAuthError,
  get auth() { return firebaseAuth; },
  get db()   { return firestoreDb; },
  ADMIN_EMAIL,
  DEFAULT_ADMIN_EMAILS
};

// Also expose for backward compat with app.js helpers
window.getUser = () => {
  const user = getCurrentUser();
  if (user) {
    const adminUser = isEmailAdmin(user.email);
    return {
      name: user.displayName || user.email.split('@')[0],
      email: user.email,
      uid: user.uid,
      role: adminUser ? 'admin' : 'student'
    };
  }
  try {
    const u = JSON.parse(localStorage.getItem('sv_user'));
    if (u) return u;
  } catch(e) {}
  return null;
};
window.isLoggedIn = isLoggedIn;
window.logout     = logout;
