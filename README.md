# My Goals — Personal Goals & Targets Dashboard (Version 2)

A private **single-user** React + TypeScript dashboard starter based on the revised goals-dashboard mockup. This is **source code**, not a published ChatGPT Site. The app runs locally with browser storage and includes an **optional** cloud API example.

## Getting started

Install Node.js 20.19+ or 22.12+ and run:

```bash
npm install
npm run dev
```

Open the URL shown in the terminal (usually `http://localhost:5173`). The first visit loads example goals from the handwritten plan with **no invented achievements**, percentages, or progress history. Edit or remove anything you don't need. All subsequent changes are saved to browser local storage.

Build for production:

```bash
npm run build
npm run preview
```

## What is included

- Dashboard similar to the revised mockup: summary cards, focus goals, recurring tracker, progress history, category grid and expanded selected-goal detail.
- Create, edit, complete, reopen and delete goals.
- Categories with rename, add and removal (removal only allowed for empty categories).
- Optional subtasks, priority, due date and notes.
- Goal tracking modes: no tracker, manual percentage, checklist, numeric total, recurring daily/weekly/monthly.
- One-click daily check-ins and Monday-to-Sunday workout indicators. Recurring check-ins stay in the data when a new period starts.
- Daily recorded-step entries and a seven-day average of **recorded** days (not a claimed smartwatch connection).
- Weekly focus: add/remove goals with the star button in expanded details, regardless of priority.
- Activity history recorded with timestamps; charts show only weeks containing real saved updates.
- Search/filter by category, status and priority.
- JSON backup/restore and a separate CSV summary export.
- Responsive layouts for desktop, tablet and mobile.
- Optional protected API adapter in `src/cloud.ts` and example Cloudflare D1 Worker in `cloudflare/`.

**Important:** Initial example goals are for illustration; no historical achievement data is created. Existing Version 1 local-storage data (`personal-goals-dashboard-v1`) is migrated where possible when first opening Version 2 on the **same browser and origin**. Export a JSON backup of Version 1 first if you want a guaranteed recovery path; browser storage does not automatically transfer between sites or domains.

## Data layout

- `src/model.ts`: goal, tracker, subtask, history, category and store types; seed data; calculations; CSV export and V1-to-V2 normalization.
- `src/App.tsx`: dashboard pages and interactive controls.
- `src/styles.css`: visual design and responsive layout.
- `src/cloud.ts`: optional GET/PUT cloud API adapter.
- `cloudflare/schema.sql`: D1 schema.
- `cloudflare/worker.js`: example state API for a protected single-user app.
- `.env.example`: optional API origin setting.

The example cloud API stores the full dashboard state as one JSON payload in a D1 row, simplifying import/export. For a larger multi-user product, normalized goals/subtasks/events tables and conflict resolution would be more appropriate.

## Cloud sync — secure Cloudflare D1 (setup required)

This repository includes a deployable **same-origin Cloudflare Worker + D1** backend
with **Cloudflare Access single-user authentication** and revision checks.
The database and Cloudflare account **have not been provisioned yet**.

### 1. Before starting

Run `npm install` locally. Export a **JSON backup** of your existing local goals.
Browser localStorage belongs to its own hostname, so localhost data will not
automatically be available at the deployed domain.

### 2. Create the database

Sign in to Cloudflare and run:

```bash
npx wrangler login
npx wrangler d1 create personal-goals-db
```

Copy `cloudflare/wrangler.example.toml` to `cloudflare/wrangler.toml`, then
replace `REPLACE_WITH_YOUR_D1_DATABASE_ID` with the returned D1 UUID.
The real wrangler configuration is gitignored.

Create the remote schema:

```bash
npx wrangler d1 execute personal-goals-db --remote --file cloudflare/schema.sql --config cloudflare/wrangler.toml
```

Only if upgrading an existing D1 database from the prior no-revision schema,
run the commented `ALTER TABLE` migration separately once.

### 3. Configure sign-in before publishing

Create a Cloudflare Zero Trust Access application for this Worker.
Restrict access to **your email only**, protecting production, previews,
and every other reachable hostname/route. A public GitHub repository is fine
for code, but it must never contain real goals, tokens, or private notes.

Find the Access team domain and application Audience (AUD) tag in your
Cloudflare account. Configure Worker secrets by running:

```bash
npx wrangler secret put ACCESS_TEAM_DOMAIN --config cloudflare/wrangler.toml
npx wrangler secret put ACCESS_AUD --config cloudflare/wrangler.toml
npx wrangler secret put ALLOWED_EMAIL --config cloudflare/wrangler.toml
```

Enter the actual values only in the secure prompts, never in tracked source
files. You can also configure Worker secrets from the Cloudflare dashboard.
Do not rely only on a client-provided email header: the Worker verifies the
signed Cloudflare Access JWT, its issuer, audience and matching email.

### 4. Build/deploy *after* Access is configured

```bash
npm run cloud:deploy
```

Your Cloudflare Worker serves React static assets and the authenticated
`/api/store` endpoint from the same origin.

**Security checks are mandatory:** confirm that incognito or another email
cannot open the dashboard or access the API, and that the approved account
can create, refresh and sync a test goal. A deployment is not automatically private.

### 5. Move your personal goals

Open the new protected cloud URL and sign in. Under Settings, use
**Import JSON Backup** to load the backup exported from your old localhost
dashboard. Confirm your changes persist when you refresh and appear on
your second device. Do not keep editing the old localhost copy.

### Recovery and conflicts

Each save includes the last known database revision. When another device
has already saved newer data, the API responds `409` and the dashboard
pauses editing to prevent silent overwrites. Export a local JSON backup
and reconcile before reloading. This does not automatically merge conflicts.

Keep periodic JSON exports as an independent backup. GitHub stores *code*,
not your private D1 records.

**ChatGPT Sites note:** This Cloudflare setup is an independent deployment.
Connecting a ChatGPT Site to its built-in database requires adapting to
that platform's authenticated server-side APIs.

## A few design choices

- The seven-day step average uses values you enter for recorded days. It is not an average for all seven days unless you have logged all seven.
- One recurring check-in is tracked per day; you can undo a check-in by clicking the checked day. For multi-session tracking on the same day, extend the events model to use distinct timestamps rather than unique date strings.
- The progress history chart displays the average of the most recently updated measurable goals within each week, not a scientific fitness/consistency score. It intentionally leaves weeks with no data empty.
- Editing a goal appends a timestamped history entry; there is no externally scheduled reminder or notifications service.
- Cross-device conflicts return HTTP 409, and editing pauses. Export a JSON backup and reconcile manually; no automatic merge exists.
- Keeping the V1 JSON backup is recommended before trying data migration.

## Suggested next steps before publishing

1. Confirm the exact goals, deadlines and category labels.
2. Decide whether to add notifications and richer recurring rules (e.g. multiple activities per day).
3. Wire Sites' supported authentication and database service, or secure a separate backend.
4. Test accessibility, backups/restores and mobile navigation.
5. Only publish when ready; this project does not automatically create or publish a site.
