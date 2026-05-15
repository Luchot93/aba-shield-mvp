# ABA Shield — Clinical CRM · Frontend Demo

> **Status:** Frontend prototype · Pending CEO approval for backend development

A purpose-built CRM for Applied Behavior Analysis (ABA) therapy practices. Designed to streamline the full clinical pipeline — from initial client referral through insurance authorization, assessment, treatment planning, and active service delivery.

---

## What This Is

This is a **fully functional frontend demo** built to validate UX, workflows, and feature scope before committing to backend development. All data is seeded locally (no API calls). The goal is to present a working, navigable product to stakeholders for sign-off.

---

## Features

### Pipeline Kanban
- 9-stage visual pipeline: **Intake → Auth 97151 → Assessment → Plan Draft → Submitted → Denied → Authorized → Staffing → In Services**
- Per-stage contextual checklists with progress tracking
- Controlled stage advancement — clients move only when the checklist is complete
- Summary bar with one-click filters for blocked, denied, and reauth-due cases

### Client Management
- Searchable, sortable client table across all pipeline stages
- Bulk import via CSV or Excel (handles multiple date formats, Excel serials)
- Duplicate detection on name + DOB and member ID
- Client detail view: stage stepper, documents, activity log

### Staff Directory
- BCBA and RBT roster with certification expiry tracking
- Case load per clinician visible at assignment time
- Staff invite flow with pending invite management

### Smart Notifications
- Automatic alerts for upcoming reauthorizations (14-day urgent / 30-day warning)
- Staff certification expiry warnings (60-day window)
- Unread badge with pulse animation

---

## Tech Stack

| Layer | Technology |
|---|---|
| UI Framework | React 18 |
| Build Tool | Vite 5 |
| Styling | Tailwind CSS 3 |
| Fonts | Syne · DM Sans · DM Mono |
| E2E Testing | Playwright 1.60 — 89 tests, 0 failures |
| Data | Local seed state (no backend) |

---

## Getting Started

```bash
# Clone
git clone https://github.com/Luchot93/ABA_Shield_V0.git
cd ABA_Shield_V0

# Install dependencies
npm install

# Run dev server
npm run dev
# → http://localhost:5173

# Run E2E test suite (first time: install browsers)
npx playwright install chromium
npx playwright test
```

---

## Project Structure

```
src/
├── App.jsx                   # Root: state + page routing
├── components/               # Shared UI — NavBar, Avatar, StagePill, icons
├── constants/                # Stage definitions, seed data, checklist config
├── features/
│   ├── pipeline/             # Kanban board + card components
│   ├── clients/              # Client table + CSV / Excel import
│   ├── staff/                # Staff cards + invite panel
│   └── detail/               # Client detail modal
└── utils/                    # Date parsing, notifications, checklist logic
```

---

## Roadmap · Post-Approval

- [ ] Backend API (Node / Postgres)
- [ ] Authentication & role-based access (Admin, BCBA, RBT)
- [ ] Real document storage (S3 or equivalent)
- [ ] Insurance portal integrations
- [ ] Smart Assessment AI bridge
- [ ] Reporting & analytics dashboard

---

## License

Private — internal use only.
