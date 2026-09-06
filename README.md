# OJT Hunter 🎯

**Land that OJT.** A personal dashboard for managing your entire internship application pipeline in the Philippines — Kanban board, document vault, deadline reminders, and company notes. Built with Supabase cloud sync so your data follows you across devices.

## Features

- **Kanban Board** — drag applications through `To Apply → Applied → Interview → Offer` (plus `Rejected`). Priority stripes, search, and status counts.
- **Document Vault** — keep your Resume, TOR, Good Moral, NDA, and medical certs ready two ways: paste a Google Drive/Dropbox link, or upload the file itself to your own private cloud bucket. **Copy link** creates a share URL that self-expires in 1 hour, right when HR asks "send your resume".
- **Save from anywhere** — one-time bookmarklet: click it on any job posting page and OJT Hunter opens with the URL and title prefilled (Huntr-style capture, no extension needed); or paste a job URL to quick-add a card with the company guessed from the link.
- **Deadline Reminders** — per-application deadlines and follow-up reminders. The Deadlines tab groups them into Overdue / Due this week / Later, badges the tab, and fires browser notifications for same-day deadlines.
- **Company Notes** — paste interview questions, culture intel, salary info, or HR contact history right on each application card.
- **Installable PWA** — service worker + web manifest, relative paths so it works both locally and on GitHub Pages project sites.

## Getting started

### 1. Serve locally

No build step, no dependencies.

```bash
start-ojt-hunter.bat        # double-click; serves http://localhost:8081
# or
python -m http.server 8081
```

> Opening index.html directly via file:// breaks auth redirects — always use a local server.

### 2. Connect Supabase (one-time)

1. Create a free project at [supabase.com](https://supabase.com)
2. Open **SQL Editor** in the dashboard, paste the contents of [`sql/schema.sql`](sql/schema.sql), and run it. This creates the tables + Row Level Security so every user only ever touches their own data. Safe to re-run. Already have data? Re-running adds the `interviewed_at`/`offered_at` funnel columns and the URL/email format constraints, and backfills what it can.
3. Copy your project URL and **anon key** from Project Settings → API, then paste them into `js/config.js`

The anon key is public by design — protection comes entirely from RLS policies.

### 3. Sign up & hunt

Sign up with any email/password (8+ chars), add your first target company, and start dragging cards.

## Security model

- **Row Level Security** — every table locks each row to `auth.uid()`; the server rejects any cross-user read/write, so the public anon key can't leak anyone's data
- **Private file storage** — uploads go to a private bucket whose policies confine every read/write/delete to the caller's own `auth.uid()` folder; sharing creates a *signed URL* that self-expires after 1 hour, so a pasted link can't leak your files forever
- **Content Security Policy** — injected from your own config at startup: `default-src 'none'`, scripts only from itself + jsDelivr, network requests only to your Supabase project. Any injected script, remote frame, or unexpected request is blocked by the browser
- **Pinned dependencies** — supabase-js is pinned to an exact version with a Subresource Integrity hash, so a compromised or mutated CDN file cannot execute
- **XSS-safe rendering** — user content (names, notes, versions) is inserted via `textContent`, never raw HTML; links are scheme-allowlisted to http(s) so `javascript:` URLs are rejected at both the form and the render layer
- **DB-level limits** — length/range constraints on every text and numeric column, plus URL-scheme (`https?://` only) and email-format checks, enforced by Postgres even if the client is bypassed
- **Account recovery** — "Forgot password?" sends a Supabase reset email; the recovery link returns to the app and prompts you to set a new password. One-time setup: add your deployed URL (e.g. `https://you.github.io/ojt-hunter/`) under Supabase → Authentication → URL Configuration → Redirect URLs
- **No referrer leakage** — `referrer: no-referrer` meta plus `rel="noopener noreferrer"` on outbound links

## Data model

| Table | Purpose |
|---|---|
| `applications` | Company, position, HR email, job URL, status, priority, deadline, follow-up time, OJT hours, applied/interview/offer timestamps |
| `documents`   | Vault entries: name, type, link, version label, notes |
| `notes`       | Free-form company/interview notes attached to an application |

## Stack

Vanilla HTML/CSS/JS · [supabase-js v2](https://supabase.com/docs/reference/javascript) via CDN · zero build tools.

## Development

No dependencies, no build step. The pure logic (URL sanitizing, job-title parsing, date math, stats) lives in [`js/logic.js`](js/logic.js), separate from the DOM/network code. Run the test suite with Node's built-in runner:

```bash
node --test tests/logic.test.js
```

GitHub Actions runs the tests before every deploy, so a regression fails the build instead of shipping.
