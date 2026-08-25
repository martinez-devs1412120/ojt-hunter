# OJT Hunter 🎯

**Land that OJT.** A personal dashboard for managing your entire internship application pipeline in the Philippines — Kanban board, document vault, deadline reminders, and company notes. Built with Supabase cloud sync so your data follows you across devices.

## Features

- **Kanban Board** — drag applications through `To Apply → Applied → Interview → Offer` (plus `Rejected`). Priority stripes, search, and status counts.
- **Document Vault** — store links to your Resume, TOR, Good Moral, NDA, and medical certs (Google Drive/Dropbox). One click **Copy link** when HR asks "send your resume".
- **Deadline Reminders** — per-application deadlines and follow-up reminders. The Deadlines tab groups them into Overdue / Due this week / Later, badges the tab, and fires browser notifications for same-day deadlines.
- **Company Notes** — paste interview questions, culture intel, salary info, or HR contact history right on each application card.

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
2. Open **SQL Editor** in the dashboard, paste the contents of [`sql/schema.sql`](sql/schema.sql), and run it. This creates the tables + Row Level Security so every user only ever touches their own data.
3. Copy your project URL and **anon key** from Project Settings → API, then paste them into `js/supabase.js`

The anon key is public by design — protection comes entirely from RLS policies.

### 3. Sign up & hunt

Sign up with any email/password, add your first target company, and start dragging cards.

## Data model

| Table | Purpose |
|---|---|
| `applications` | Company, position, HR email, job URL, status, priority, deadline, follow-up time, OJT hours |
| `documents`   | Vault entries: name, type, link, version label, notes |
| `notes`       | Free-form company/interview notes attached to an application |

## Stack

Vanilla HTML/CSS/JS · [supabase-js v2](https://supabase.com/docs/reference/javascript) via CDN · zero build tools.
