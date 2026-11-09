# CLAUDE.md — dxg-rfp-tool-admin

Back-office app for RFPilot: clients, users, read-only proposals, support desk and
AI operations (Next.js 16 App Router, React 19, NextAuth v5, Tailwind CSS 4).
Knowledge and pricing screens were removed on 2026-10-25. This repo is one of
three (with `dxg-rfp-tool-backend` and `dxg-rfp-tool-dashboard`). The backend owns
the API and the shared project docs.

## Read first

1. `../dxg-rfp-tool-backend/docs/PROJECT_STATE.md` and `docs/ARCHITECTURE.md` there
2. The workspace `CONTEXT-MAP.md`, if this repo sits in the shared workspace folder

## Commands

```bash
npm run dev          # Next.js dev server (:3001 via run-all.sh; expects the backend on :8000)
npm test             # Jest (*.test.ts / *.spec.ts, node environment)
npm run lint
npm run type-check
npm run ci           # lint -> type-check -> test -> build (what .github/workflows/ci.yml runs)
```

## Layout and gotchas

- `app/` route groups `(auth)` and `(page)`, server actions in `app/actions/`, and server
  helpers in `lib/server/`.
- Unlike the dashboard, admin has no generated `contracts/` directory.
- Config comes from `BACKEND_URL`, `NEXTAUTH_URL`, `AUTH_SECRET` and `BFF_SHARED_SECRET`
  (see `.env.example`). The build needs none of them.

## Rules

- Never commit `.env*` files (except the `.example` files), real proposal content, or the DXG pricing workbook.
- Run `npm run ci` before pushing. CI enforces it.
