# CLAUDE.md — dxg-rfp-tool-admin

Back-office app for RFPilot: clients, users, organizations (plans, account detail and a read-only
browser of each organization's content), legacy customer placement, support desk and AI operations (Next.js 16 App Router, React 19, NextAuth v5, Tailwind CSS 4).
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
- Staff view a customer organization's content with no grant (owner decision, 2026-11-17; the
  support-grant model is superseded). The organization content browser lives under
  `/organizations/[organizationId]/`: `proposals`, `proposals/[proposalId]`,
  `proposals/[proposalId]/vendor-responses`, `members`, `teams`, `templates`,
  `templates/[templateId]` and `vendors`. Code: `app/actions/organizationContent.ts` (the eight
  GET routes under `/api/v1/admin/organizations/:organizationId/...`), `lib/organizationContent/`
  (parsers, paths, failure states, one `load…Page` per page) and `components/organizations/content/`.
  - **Read-only.** No edit, delete, share, export or download control on customer content
    (`components/organizations/content/readOnly.test.ts` scans for them). Upload filenames are plain
    text, never links: staff cannot open customer files. Vendor responses show a document count only.
  - **Every read is recorded** in the staff organization's audit trail (a 404 too), never in the
    customer's. So: no caching, `prefetch={false}` on every link into these pages, each page view
    makes exactly the one read it shows (its loader is handed that read alone), and nothing polls.
    The eight routes share one rate limit (300 reads per 15 minutes per staff account); a 429 has
    its own state. The organization's name is not on the content pages: it would take a second read.
  - Every action checks the signed-in session is a staff admin (`lib/server/staffAdmin.ts`) and that
    ids are 24 lower-case hex before it calls the backend. A 404 without a known code
    (`ORGANIZATION_NOT_FOUND`, `PROPOSAL_NOT_FOUND`, `TEMPLATE_NOT_FOUND`) means the API does not
    have the route yet: the page says "Not available yet".
  - The grant workspace ("Support access", "Granted to me") is gone. Old `/support-access/...`
    addresses redirect into the browser (`supportAccessRedirect`); `/proposals` goes to `/organizations`.
- The organization detail page (`/organizations/[organizationId]`, `getOrganizationAccountAction`,
  `lib/organizationAccount.ts`) shows account-level information (counts, settings and the Owner as
  account contact) and links to the five content sections; it reads none of them itself. Each view
  is audited in the staff organization: no caching, and `prefetch={false}` on links into it. A plan
  change from the detail page writes up to two further read events (the action's revalidation and
  `ChangePlanButton`'s `router.refresh()` can each re-render the page). The page's backend reads
  are decided in `loadOrganizationPage`. A 404 without `ORGANIZATION_NOT_FOUND` means the API does
  not have the route yet.
- **Legacy customers** (`/legacy-customers`, backend ORG-110): staff place a legacy customer, with
  their proposals, into a new or an existing organization. It moves tenant data and is the most
  consequential action in this app. Pages: the list, `/[userId]/place` (form, then a review with an
  explicit confirmation) and `/placements/[runId]` (the run, followed until it finishes; rollback).
  Code: `app/actions/legacyCustomers.ts` (the five routes under `/api/admin/legacy-customers`, not
  `/api/v1/admin`), `lib/legacyCustomers/` (pure, tested code) and `components/legacyCustomers/`.
  - On production the API answers 202 and a one-off task does the move; the run page polls
    `GET /placements/:runId`. **Never faster than 3 seconds** (`MIN_POLL_INTERVAL_MS` in
    `pollController.ts`, which is the only loop: one read at a time, stops on a finished run, a
    404 and repeated errors, waits while the tab is hidden, backs off on 429).
  - Allowances per staff member per 15 minutes: 1,500 run reads, 600 list and search reads
    together, 120 placements and rollbacks. Links into the place and run pages opt out of prefetch.
  - **Two different "busy" answers, both 429:** `PLACEMENT_RATE_LIMITED` (this account used an
    allowance: wait) and `PLACEMENT_CAPACITY_REACHED` (another placement or rollback is running:
    one at a time). And two 409s: `PLACEMENT_IN_PROGRESS` (this customer is being placed, or on a
    rollback the run has not finished) and `NOT_A_LEGACY_CUSTOMER` (already placed).
    503 `PLACEMENT_REQUIRES_MIGRATION_ROLE` means the server cannot start placements.
  - Every action: staff check, ids checked (24 lower-case hex, or the `placement-<ISO>-<8 hex>` run
    id), the body rebuilt field by field, then one request. Place and rollback send an
    `Idempotency-Key` made when the confirmation opens, so a repeat returns the same run. Backend
    message text (`message`, `error`, `task.message`) is never shown: codes map to wording in
    `placement.ts` and `runView.ts`.
  - The list is paged and searched on the Next server (the backend has neither): one page of at
    most 50 customers reaches the browser, `?page=` is a number only, and the search is a form
    POST to a server action, so a name or email is never in an address. One backend list read per
    page view or search; every link to `/legacy-customers` inside the feature opts out of prefetch.
  - After any rollback answer that is not an accepted run, the run is read again
    (`rollbackFollowUp`, `recheck`). The loop also stops after 30 minutes of queued or running.
  - The optional team comes from the content browser's teams read (recorded, and counted in that
    browser's allowance), asked only when staff press "Choose a team".
- Config comes from `BACKEND_URL`, `NEXTAUTH_URL`, `AUTH_SECRET` and `BFF_SHARED_SECRET`
  (see `.env.example`). The build needs none of them.

## Rules

- User-facing copy calls the document a planner writes and sends to vendors a **proposal**, never
  an "RFP" ("Proposals", "Proposals created", "Proposal intelligence", "1 proposal").
  **RFPilot** is the product name and stays. `lib/wording.test.ts` scans `app/`, `components/`,
  `config/` and `lib/` and fails on a new standalone "RFP" in on-screen text; its exceptions list
  is empty, and an exception added there must say why it stays. Identifiers, the old `/rfps/`
  redirect routes, API fields (`rfps`, `rfp`) and backend error codes keep `rfp`. Text the backend writes
  and this app only displays is worded in the backend, not patched here.
- Counts take the right number ("1 proposal", "2 proposals"): use `countLabel` from `lib/plural.ts`.
- Never commit `.env*` files (except the `.example` files), real proposal content, or the DXG pricing workbook.
- Run `npm run ci` before pushing. CI enforces it.
