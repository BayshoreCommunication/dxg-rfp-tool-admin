# CLAUDE.md — dxg-rfp-tool-admin

Back-office app for RFPilot: users, organizations (plans, account detail and a read-only
browser of each organization's content), support desk and AI operations (Next.js 16 App Router, React 19, NextAuth v5, Tailwind CSS 4).
Knowledge and pricing screens were removed on 2026-10-25. The Clients directory (`/clients`) and
the Legacy customers placement screens (`/legacy-customers`) were removed on 2026-11-24 (owner
decision: no tenancy cutover will run); both addresses are a 404 and
`app/(page)/removedScreens.test.ts` keeps them out. The backend routes they called
(`/api/all-clients`, `/api/admin/legacy-customers`) are unchanged. This repo is one of
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
- **Organization management** (owner decision, 2026-11-24, which reverses the member and team
  writes of 2026-11-18): staff **view** one member and one team, and **block or reactivate** a
  whole customer organization. Staff change nothing about a member or a team: no role change,
  deactivation, reactivation, reassignment of proposals, change of teams or ownership move, and
  no team create, rename, archive, member or manager change. Those pages, components and server
  actions were removed, not hidden; their addresses are a 404. Pages are under
  `/organization-management/[organizationId]/`: `members/[userId]` and `teams/[teamId]` (both
  view only, with no control), and `block` and `reactivate` for the organization. Code:
  `app/actions/organizationManagement.ts` (five actions: `getManagedMemberAction`,
  `getManagedTeamAction`, `getManagedOrganizationAction`, `blockOrganizationAction`,
  `reactivateOrganizationAction`), `lib/organizationManagement/` (`management.ts`,
  `lib/organizationManagement/teams.ts`, `confirmGate.ts`; pure, tested) and
  `components/organizations/manage/`.
  - **The guard:** `app/actions/staffViewOnly.test.ts` fails when an action for a member or team
    write is exported again, when any source names one of the removed backend write routes with
    a method other than GET, when a removed write page comes back, or when the member page says
    "What you can change". An exported server action is a public endpoint: add none for a member
    or team write. The backend still has the write routes until its own follow-up change.
  - **Why outside `/organizations/[organizationId]/`:** everything under that address, and
    `components/organizations/content/`, is the content browser, which `readOnly.test.ts` keeps
    free of any control. The Members list and the Teams list there have one plain "View" link per
    row; the detail page shows "Blocked since" with "Reactivate organization", or a danger area
    with "Block organization".
  - **Every request is recorded on the RFPilot side, the single-member read
    (`GET members/:userId`) and the team read (`GET teams/:teamId`) included:** no caching, no
    prefetch, one read per page view. The view pages say so ("View only. … Each page you open is
    recorded on the RFPilot side."); the block pages keep the note of a page that changes
    something. The block and reactivate pages read the organization once
    (`loadOrganizationWritePage`), through the organization account read; the Owner is not handed on.
  - **Block and reactivate:** form, review in plain words, explicit confirmation (`confirmGate.ts`;
    a block needs the organization's name typed, a reactivation a tick), a reason of 10 to 500
    characters, then one POST with `{ reason }`. Every action: staff check, ids, body rebuilt from
    the checked reason. Refusal codes map to fixed wording in `management.ts` and are shown beside
    it; backend message text never is. A write with no readable answer is "may or may not have
    been saved", never "nothing happened". Block writes allow 60 per 15 minutes per staff account;
    the reads count toward the content browser's 300.
  - **The team page:** the backend lists at most 200 members and 200 managers of a team: the count
    shown is `memberCount`, with "Showing the first N" when the list is shorter and the count is
    above 200, and "The server listed N of M members" when it is not (rows the backend or the
    parser left out). The staff routes return a deactivated member's status as `suspended`.
- Shared pieces: `components/shared/pageList.ts` (`buildPageList`, the pager's page numbers),
  `components/shared/ClientSearchForm.tsx` (the search box that navigates on its own; never used
  in the content browser) and `lib/confirmedSubmit.ts` (the gate under
  `lib/organizationManagement/confirmGate.ts`).
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
