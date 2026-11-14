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

## Cloud sync — optional, **not connected by default**

You don't need Azure to run the starter. The default app stores your goals in **this browser only** and backs them up with JSON export. For phone/laptop syncing, you must deploy a real API and enable account-level access protection.

One possible path outside ChatGPT Sites is Cloudflare Workers + D1:

1. Create a D1 database and apply `cloudflare/schema.sql` using Wrangler.
2. Configure the Worker in `cloudflare/worker.js` with a D1 binding named `GOALS_DB`, an `ALLOWED_EMAIL` setting and the D1 database ID.
3. **Before making the Worker reachable**, enforce Cloudflare Access with an identity policy protecting **both** the website and API hostname/route. Disable or protect any direct `workers.dev` or alternative routes. An email header alone is **not** a substitute for an Access policy and should never be treated as authentication on a publicly reachable Worker.
4. Host the frontend in an Access-protected site and route `/api/store` to the Worker on the same origin, or configure a secured cross-origin frontend/API deployment with the appropriate CORS and cookie policy.
5. Set `VITE_GOALS_API_URL` to the externally reachable protected API origin if using one. Don't put credentials or API keys in `VITE_` variables, because the frontend bundle is visible to browsers.
6. Test loading, saving, access denied, logging out, backup/export and two-device sync before depending on the cloud copy.

**ChatGPT Sites note:** This starter does **not** directly connect to ChatGPT Sites' database or authenticate a user. When building the Site in Sites/Codex, the server-side data and auth layers must be adapted to whatever APIs and access controls that platform actually exposes. The mockup's “Private” label alone does not enforce privacy. The included Cloudflare Worker is an optional architectural example, not a required dependency or an automatically connected service.

## A few design choices

- The seven-day step average uses values you enter for recorded days. It is not an average for all seven days unless you have logged all seven.
- One recurring check-in is tracked per day; you can undo a check-in by clicking the checked day. For multi-session tracking on the same day, extend the events model to use distinct timestamps rather than unique date strings.
- The progress history chart displays the average of the most recently updated measurable goals within each week, not a scientific fitness/consistency score. It intentionally leaves weeks with no data empty.
- Editing a goal appends a timestamped history entry; there is no externally scheduled reminder or notifications service.
- Cross-device simultaneous updates are **not** conflict-resolved in this starter; the optional cloud sync uses last-write-wins. For one user, avoid editing at the same time on multiple devices until conflict handling is built.
- Keeping the V1 JSON backup is recommended before trying data migration.

## Suggested next steps before publishing

1. Confirm the exact goals, deadlines and category labels.
2. Decide whether to add notifications and richer recurring rules (e.g. multiple activities per day).
3. Wire Sites' supported authentication and database service, or secure a separate backend.
4. Test accessibility, backups/restores and mobile navigation.
5. Only publish when ready; this project does not automatically create or publish a site.
