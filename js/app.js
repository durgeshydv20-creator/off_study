/**
 * app.js — OffStudy Global Application
 * Handles: navigation, scroll animations, shared utilities.
 * Authentication is handled by auth.js (Firebase Auth).
 */

/* ─── Auth helpers (delegates to OffStudyAuth from auth.js) ────────────────── */
function getUser() {
  // Try Firebase Auth first (real auth)
  if (window.OffStudyAuth && typeof OffStudyAuth.getCurrentUser === 'function') {
    const fbUser = OffStudyAuth.getCurrentUser();
    if (fbUser) {
      return {
        name: fbUser.displayName || fbUser.email.split('@')[0],
        email: fbUser.email,
        uid: fbUser.uid,
        role: fbUser.email.toLowerCase() === 'admin@offstudy.com' ? 'admin' : 'student'
      };
    }
    return null;
  }
  // Fallback: localStorage (kept in sync by onAuthStateChanged)
  try { return JSON.parse(localStorage.getItem('sv_user')); } catch { return null; }
}
function isLoggedIn() {
  if (window.OffStudyAuth && typeof OffStudyAuth.isLoggedIn === 'function') {
    return OffStudyAuth.isLoggedIn();
  }
  return !!getUser();
}
async function logout() {
  if (window.OffStudyAuth && typeof OffStudyAuth.logout === 'function') {
    await OffStudyAuth.logout();
    return;
  }
  localStorage.removeItem('sv_user');
  window.location.href = 'login.html';
}

/* ─── Update navbar based on auth state ────────────────────────────────────── */
// Called by auth.js onAuthStateChanged (user = Firebase user object OR null)
function updateNavAuth(user) {
  const authBtn       = document.getElementById('nav-auth-btn');
  const authBtnMobile = document.getElementById('nav-auth-btn-mobile');
  if (!authBtn) return;

  let displayEmail = null;
  let displayName  = null;
  let adminUser    = false;

  if (user && user.email) {
    // Firebase user object passed from auth.js
    displayEmail = user.email;
    displayName  = user.displayName || user.email.split('@')[0];
    adminUser    = user.email.toLowerCase() === 'admin@offstudy.com';
  } else if (!user) {
    // Check localStorage fallback
    const u = getUser();
    if (u) {
      displayEmail = u.email;
      displayName  = u.name || u.email.split('@')[0];
      adminUser    = u.role === 'admin' || (u.email && u.email.toLowerCase() === 'admin@offstudy.com');
    }
  }

  if (displayEmail) {
    authBtn.innerHTML = adminUser ? `👑 ADMIN` : `${displayName.split(' ')[0].toUpperCase()}`;
    authBtn.classList.add('logged-in');
    authBtn.title = `${displayEmail} — Click to logout`;
    authBtn.href = '#';

    // Replace node to avoid listener stacking
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

/* ─── Hamburger nav ────────────────────────────────────────────────────────── */
function initHamburger() {
  const toggle = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobile-menu');
  if (!toggle || !mobileMenu) return;

  toggle.addEventListener('click', () => {
    const open = mobileMenu.classList.toggle('open');
    toggle.classList.toggle('active', open);
    toggle.setAttribute('aria-expanded', open);
  });

  // close on outside click
  document.addEventListener('click', (e) => {
    if (!toggle.contains(e.target) && !mobileMenu.contains(e.target)) {
      mobileMenu.classList.remove('open');
      toggle.classList.remove('active');
    }
  });

  // close on nav link click
  mobileMenu.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      mobileMenu.classList.remove('open');
      toggle.classList.remove('active');
    });
  });
}

/* ─── Navbar scroll behaviour ──────────────────────────────────────────────── */
function initNavScroll() {
  const navbar = document.getElementById('navbar');
  if (!navbar) return;
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 20);
  }, { passive: true });
}

/* ─── Intersection Observer — fade-in animations ───────────────────────────── */
function initScrollAnimations() {
  const els = document.querySelectorAll('[data-animate]');
  if (!els.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('animated');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });

  els.forEach(el => observer.observe(el));
}

/* ─── Animated number counter ──────────────────────────────────────────────── */
function animateCount(el, target, duration = 1200) {
  let start = 0;
  const step = target / (duration / 16);
  const tick = () => {
    start = Math.min(start + step, target);
    el.textContent = Number.isInteger(target)
      ? Math.floor(start)
      : start.toFixed(1);
    if (start < target) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function initCounters() {
  const counters = document.querySelectorAll('[data-count]');
  if (!counters.length) return;
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        const el = e.target;
        animateCount(el, parseFloat(el.dataset.count));
        obs.unobserve(el);
      }
    });
  }, { threshold: 0.5 });
  counters.forEach(c => obs.observe(c));
}

/* ─── Toast notification ───────────────────────────────────────────────────── */
function showToast(message, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
    <span class="toast-msg">${message}</span>
  `;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}

/* ─── Format file size ─────────────────────────────────────────────────────── */
function formatSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

/* ─── Relative time ────────────────────────────────────────────────────────── */
function relativeTime(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'Yesterday';
  if (d < 7) return `${d} days ago`;
  if (d < 14) return '1 week ago';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/* ─── Active nav link ──────────────────────────────────────────────────────── */
function setActiveNav() {
  const page = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link').forEach(link => {
    const href = link.getAttribute('href');
    if (href === page || (page === '' && href === 'index.html')) {
      link.classList.add('active');
    }
  });
}

/* ─── Hero typed animation ─────────────────────────────────────────────────── */
function initHeroAnimation() {
  const hero = document.querySelector('.hero-content');
  if (!hero) return;
  hero.classList.add('hero-loaded');
}

/* ─── Search icon toggle ───────────────────────────────────────────────────── */
function initSearchToggle() {
  const searchBtn = document.getElementById('nav-search-btn');
  const searchBar = document.getElementById('nav-search-bar');
  if (!searchBtn || !searchBar) return;
  searchBtn.addEventListener('click', () => {
    const visible = searchBar.classList.toggle('visible');
    if (visible) searchBar.querySelector('input').focus();
  });
  searchBar.querySelector('input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const q = e.target.value.trim();
      if (q) window.location.href = `notes.html?q=${encodeURIComponent(q)}`;
    }
    if (e.key === 'Escape') searchBar.classList.remove('visible');
  });
}

/* ─── Boot ─────────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  // Purge any old dummy data on launch
  if (window.OffStudyDB && typeof OffStudyDB.cleanDemoData === 'function') {
    await OffStudyDB.cleanDemoData();
  }

  initNavScroll();
  initHamburger();
  setActiveNav();
  initScrollAnimations();
  initCounters();
  initHeroAnimation();
  initSearchToggle();

  // Start Firebase Auth observer — updates navbar when auth state changes
  if (window.OffStudyAuth && typeof OffStudyAuth.initAuthObserver === 'function') {
    // Pages that need auth guard call initAuthObserver themselves (e.g. upload.html)
    // For all other pages, start the observer without requiring auth
    const alreadyInitialized = document.querySelector('[data-auth-observer-started]');
    if (!alreadyInitialized) {
      OffStudyAuth.initAuthObserver();
    }
  } else {
    // Fallback: use localStorage snapshot (no Firebase)
    updateNavAuth(null);
  }
});

/* ─── Expose globals ───────────────────────────────────────────────────────── */
window.SV = {
  showToast, formatSize, relativeTime, getUser, isLoggedIn, logout,
  isAdmin: () => {
    if (window.OffStudyAuth && typeof OffStudyAuth.isAdmin === 'function') {
      const res = OffStudyAuth.isAdmin();
      if (res) return true;
    }
    if (window.OffStudyDB && typeof OffStudyDB.isAdmin === 'function') {
      const res = OffStudyDB.isAdmin();
      if (res) return true;
    }
    try {
      const u = (typeof getUser === 'function') ? getUser() : JSON.parse(localStorage.getItem('sv_user'));
      if (u) {
        if (u.role === 'admin') return true;
        if (u.email) {
          const em = u.email.toLowerCase().trim();
          if (em === 'admin@offstudy.com' || em.startsWith('admin@') || em.includes('durgesh')) return true;
        }
      }
    } catch(e) {}
    return false;
  }
};
