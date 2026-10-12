# Accessibility — WCAG 2.1 AA (IPP-NF-004)

SRS 5: *"The web interface shall conform to WCAG 2.1 AA, including keyboard navigation, screen-reader-friendly labels and a
high-contrast mode."* (Test TC-UX-01: accessibility audit with Lighthouse/axe.)

## What was implemented

| Area | Implementation |
|---|---|
| **Keyboard** | Everything is a native `<a>`, `<button>`, `<input>`, `<select>`, `<details>`; no click-only `div`s. "Skip to content" link is the first tab stop. Visible 3 px focus ring on every control (`:focus-visible`). Dialogs trap focus, close on `Esc` and restore focus to the opener. The test runner is fully keyboard-operable (radio groups with arrow keys, numbered question navigator, Next/Previous). |
| **Focus & titles on navigation** | After each route change focus moves to `<main>` and `document.title` becomes `"<page heading> · IPP"` (WCAG 2.4.2, 2.4.3). |
| **Labels / names** | Every form control has a visible `<label for>`; errors are tied with `aria-describedby` and `aria-invalid`; icon-only buttons have `aria-label`s that contain their visible text; decorative icons are `aria-hidden`. |
| **Structure** | Landmarks (`header`, `nav aria-label="Main"`, `main`, `aside`), one `<h1>` per page, ordered headings, real `<table>`s with `<caption>` and `scope="col"`, valid definition lists. |
| **Live regions** | Toasts and save/loading states use `role="status"`/`aria-live`; form errors `role="alert"`; the test timer is a `role="timer"` and announces 5 min / 1 min / 30 s / 10 s remaining (not every second). |
| **Charts** | SVG charts have a text summary (`role="img"` + `aria-label`), tooltips, a legend that repeats the numbers, and a **"View as table"** toggle so no information depends on colour or sight. |
| **Colour & contrast** | Light and dark themes meet 4.5:1 for text and 3:1 for UI. Status is never colour-only (badges carry text). |
| **High-contrast mode** | Theme switch in the top bar (and on the sign-in pages): *System / Light / Dark / High contrast*. High contrast = black surfaces, white text (≥ 15:1), yellow accents, 2 px borders, underlined links. Remembered per browser; the OS "increase contrast" preference selects it on first visit. |
| **Motion** | `prefers-reduced-motion` disables animations and transitions. |
| **Responsive / zoom** | Layouts reflow down to 320 px (no horizontal page scroll); text uses relative units so browser zoom works. |
| **Forms & errors** | Inline, specific error messages; required fields marked; submit buttons show progress text. |

## Verification

Automated (axe-core 4, rules `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`), repeatable:

```bash
# terminal 1: API (with demo data)      cd server && npm run seed:demo && npm start
# terminal 2: client                    cd client && npm run dev
# terminal 3:                           cd client && ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run a11y
```

Latest result: **54 page views (public, student, recruiter, admin) × 3 themes (light, dark, high contrast) — 0 violations.**
During development the audit found and we fixed: an `aria-label` that did not contain its visible text (user chip, "Allow reattempt"
buttons) and an invalid `<dl>` structure on the detail cards.

Manual checklist for the acceptance run (TC-UX-01) — tick off in a browser:

- [ ] Tab through login → dashboard → apply → test runner using only the keyboard; focus is always visible and never trapped (except in open dialogs).
- [ ] Turn on a screen reader (NVDA/VoiceOver): page titles are announced after navigation; form errors are announced; the timer announces thresholds.
- [ ] Switch to **High contrast** and browse every page.
- [ ] Zoom to 200 % and 400 %: no content is cut off or overlapping.
- [ ] Run Lighthouse → Accessibility on `/login`, `/student`, `/student/internships` (expect ≥ 95).

## Known limitations

* The PDF export is a plain report generated server-side and is not tagged for screen readers; the CSV export and the on-screen tables are the accessible alternatives.
* Manual screen-reader testing has not been performed in this environment — only automated checks and structural review.
