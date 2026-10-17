# OffStudy 📚

**Your personal academic notes platform.**  
*Learn. Organize. Master.*

---

## Overview

OffStudy is a premium, dark-themed academic notes management platform built with **pure HTML, CSS, and Vanilla JavaScript** — zero frameworks, zero dependencies.

Upload, organize, search, view, and manage your study notes from a single powerful workspace. All data is stored locally in your browser using **IndexedDB**.

---

## Features

- 📤 **Upload** PDFs, Word docs, presentations, images, and text files
- 🗂️ **Organize** by subject with filtering and sorting
- 🔍 **Search** across titles, subjects, descriptions, and filenames in real time
- 👁️ **View** PDFs and images directly in the browser
- ⬇️ **Download** any uploaded file
- 🗑️ **Delete** notes with a confirmation prompt
- 📱 **Fully responsive** — works on desktop, tablet, and mobile
- 🔒 **Private** — all data stays in your browser (IndexedDB)
- 🔑 **Auth** — login/register flow with localStorage session

---

## File Structure

```
studyvault/
├── index.html          ← Landing page
├── notes.html          ← My Notes (main dashboard)
├── subjects.html       ← Browse by subject
├── upload.html         ← Dedicated upload page
├── about.html          ← About page
├── login.html          ← Login / Register
│
├── css/
│   ├── style.css       ← Full design system
│   └── responsive.css  ← Mobile/tablet breakpoints
│
├── js/
│   ├── storage.js      ← IndexedDB abstraction layer
│   ├── app.js          ← Global: nav, auth, animations
│   ├── notes.js        ← Notes: render, view, delete, download
│   ├── upload.js       ← Upload: drag-drop, validation, save
│   └── search.js       ← Real-time search with debounce
│
├── assets/
│   ├── images/
│   └── icons/
│
└── README.md
```

---

## Running Locally

Since this is pure HTML/CSS/JS, you can open it in multiple ways:

### Option 1 — Direct file open
```bash
open studyvault/index.html
```

### Option 2 — Local server (recommended for PDF preview)
```bash
# Using Python
python3 -m http.server 8080 --directory studyvault/

# Using Node.js
npx serve studyvault/

# Then visit: http://localhost:8080
```

> **Note:** PDF preview via `<iframe>` works best when served over HTTP, not `file://`. Use a local server for best results.

---

## Storage Architecture

All storage logic is isolated in `js/storage.js` with a clean API:

```js
OffStudyDB.addNote(note)      // Add a note to IndexedDB
OffStudyDB.getNotes()         // Get all notes (newest first)
OffStudyDB.getNote(id)        // Get a single note by ID
OffStudyDB.deleteNote(id)     // Delete a note
OffStudyDB.searchNotes(query) // Full-text search
OffStudyDB.filterNotes(subj)  // Filter by subject
OffStudyDB.getSubjects()      // Get subject → count map
```

To connect a real backend, replace these functions with `fetch()` API calls.

---

## Design System

CSS variables used throughout:

```css
--bg:           #050505    /* Near-black background */
--surface:      #0d0d0f    /* Card surface */
--surface-light:#141416    /* Lighter surface */
--text:         #ffffff    /* Primary text */
--muted:        #666670    /* Muted text */
--accent:       #0077B6    /* Blue accent */
--border:       rgba(255,255,255,0.07)
--gradient:     linear-gradient(135deg, #0077B6, #00B4D8)
--radius:       14px
--font-main:    'Space Grotesk', 'Inter', sans-serif
```

---

## Demo Data

The site ships with 9 realistic demo notes seeded automatically on first load:
- C++ Programming Fundamentals
- Java OOP Concepts
- Python for Data Science
- Data Structures & Algorithms
- Database Management Systems
- Digital Logic Design
- Microprocessor 8085 Architecture
- Engineering Mathematics — Unit 4
- Physics — Wave Optics

To remove demo data: clear IndexedDB via DevTools → Application → IndexedDB → OffStudyDB, then remove `sv_seeded` from localStorage.

---

## Browser Support

| Browser | Status |
|---------|--------|
| Chrome 90+ | ✅ Full support |
| Firefox 88+ | ✅ Full support |
| Safari 14+ | ✅ Full support |
| Edge 90+ | ✅ Full support |

---

## License

MIT License — free to use, modify, and distribute.

---

*Built with ❤️ for students everywhere.*
