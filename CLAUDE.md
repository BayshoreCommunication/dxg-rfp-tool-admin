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
- **Staff management** (owner decisions, 2026-11-18): staff change a member's role, deactivate and
  reactivate a member, reassign a member's proposals, transfer ownership, and block or reactivate
  a whole customer organization. Team management is the last sub-bullet here. Pages are under
  `/organization-management/[organizationId]/`: `members/[userId]` (the member and the writes
  their state offers), `members/[userId]/role`, `/deactivate`, `/reactivate`,
  `/reassign-proposals`, `/transfer-ownership`, and `block` and `reactivate` for the organization.
  Code: `app/actions/organizationManagement.ts`, `lib/organizationManagement/` (pure, tested) and
  `components/organizations/manage/`.
  - **Why outside `/organizations/[organizationId]/`:** everything under that address, and
    `components/organizations/content/`, is the view-only browser, which `readOnly.test.ts` keeps
    free of any control. The Members list there has one plain "Manage" link per member; the
    detail page shows "Blocked since" with "Reactivate organization", or a danger area with
    "Block organization".
  - **Every request is recorded on the RFPilot side, the single-member read
    (`GET members/:userId`) included:** no caching, no prefetch, one member read per page view,
    and once more only when staff press "Load the current member", which is offered after a
    `STALE_VERSION`, a `VERSION_REQUIRED` and a write whose outcome is unknown. A
    member write page reads the member and then the organization (its name is in the review, and
    typed to confirm a transfer or a block); `loadMemberWritePage` decides the reads. The list of
    members to receive proposals is the content browser's members read, loaded only on a press.
  - **One shared write allowance:** member, team and block writes together, 60 per 15 minutes per
    staff account; the reads count toward the content browser's 300.
  - Every write: form, review in plain words, explicit confirmation (`confirmGate.ts`; a
    transfer and a block need the organization's name typed), a reason of 10 to 500 characters,
    then one request. Every action: staff check, ids, body rebuilt field by field. The Owner is
    changed only by a transfer. Reassignment never sends `rfpIds` (the API then moves all).
    Refusal codes map to fixed wording in `management.ts` and are shown beside it; backend
    message text never is. A write with no readable answer is "may or may not have been saved",
    never "nothing happened". The staff routes return a deactivated member's status as
    `suspended`.
  - **Team management** (same owner decision): staff create, rename and archive a team, add and
    remove a team member, set or unset a team manager, and set which teams a member is on. Staff
    never change which team a proposal is on. Pages: `teams/new`, `teams/[teamId]` (the team, its
    listed members and what its state offers; an archived team offers nothing and can't be
    un-archived), `teams/[teamId]/rename`, `/archive` (the team's name typed to confirm),
    `/members/add`, `/members/[userId]/remove`, `/make-manager`, `/remove-manager`, and
    `members/[userId]/teams` ("Change teams" on the member page). Code: the second half of
    `app/actions/organizationManagement.ts`, `lib/organizationManagement/teams.ts` (paths, parsers,
    state rules, loaders, wording) and the `Team*` components. `TeamWriteFlow` and
    `TeamMemberPicker` are siblings of `WriteFlow` and `ReassignTargetPicker`, whose source is
    pinned by the guard; they share the gate, the reason field, the review facts, the refusals
    and the frame. Reads per page (each recorded): the team page 1 (`GET teams/:teamId`); create 1
    (the organization); rename, archive and add 2 (team, organization) plus one members read per
    page of the picker staff load; remove and manager pages 2 (the member, whose own `teams` say
    whether they are on the team and manage it, then the organization); a member's teams 3 (the
    member, the content browser's teams read for the active teams, the organization), and one more
    member read on each press of "Review": `PUT members/:userId/teams` replaces the member's whole
    active team set and a team-route change does not move the member's `version`, so the review
    is built from the member as read on that press (`reviewMemberTeams`) and names what changed
    since the page loaded. The lasting fix is the backend's. The backend
    lists at most 200 members and 200 managers of a team: the count shown is `memberCount`, with
    "Showing the first N" when the list is shorter and the count is above 200, and "The server
    listed N of M members" when it is not (rows the backend or the parser left out). Removing a team member is a DELETE with
    `{ reason }` in a JSON body. `MEMBER_NOT_FOUND` on add and make-manager means "not an active
    member" and is worded so. The Teams list has "Create a team" and one "Manage" link per team.
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
