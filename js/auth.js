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
  return !!getCurrentUser();
}

/** Returns true if current user is admin. */
function isAdmin() {
  const user = getCurrentUser();
  return !!(user && user.email && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase());
}

/** Sign out and redirect to login. */
async function logout() {
  try {
    if (firebaseAuth) await firebaseAuth.signOut();
  } catch (e) {
    console.warn('Signout error:', e);
  }
  window.location.href = 'login.html';
}

/** Get a friendly display name for the current user. */
function getUserDisplayName() {
  const user = getCurrentUser();
  if (!user) return null;
  if (user.displayName) return user.displayName;
  // Derive from email: "john.doe@..." → "john.doe"
  return user.email.split('@')[0];
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

      // Sync to localStorage so storage.js / app.js can read it synchronously
      const userData = {
        name: user.displayName || user.email.split('@')[0],
        email: user.email,
        uid: user.uid,
        role: user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase() ? 'admin' : 'student'
      };
      localStorage.setItem('sv_user', JSON.stringify(userData));

      // If page says "redirect if already logged in" (e.g. login page)
      if (redirectIfLoggedIn) {
        window.location.href = 'index.html';
        return;
      }

      updateNavAuth(user);

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
    }
  });
}

/* ─── Navbar UI Update ──────────────────────────────────────────────────────── */
function updateNavAuth(user) {
  const authBtn       = document.getElementById('nav-auth-btn');
  const authBtnMobile = document.getElementById('nav-auth-btn-mobile');
  if (!authBtn) return;

  if (user) {
    const adminUser = user.email && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
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
  logout,
  getUserDisplayName,
  initAuthObserver,
  updateNavAuth,
  friendlyAuthError,
  get auth() { return firebaseAuth; },
  get db()   { return firestoreDb; },
  ADMIN_EMAIL
};

// Also expose for backward compat with app.js helpers
window.getUser = () => {
  const user = getCurrentUser();
  if (!user) return null;
  return {
    name: user.displayName || user.email.split('@')[0],
    email: user.email,
    uid: user.uid,
    role: user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase() ? 'admin' : 'student'
  };
};
window.isLoggedIn = isLoggedIn;
window.logout     = logout;
