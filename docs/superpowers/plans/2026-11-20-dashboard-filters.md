# Dashboard Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a filter button below the left-side crash summary dashboard that opens an accessible, scrollable dropdown with 6 filters (Severity, Time of Day, Day of Week, Crash Type with its own scrollable menu, Urban/Rural Place, and Year), filtering crash queries, counts, and map presentation.

**Architecture:**
- A new `src/components/crash-filters.tsx` component containing the toggle button and dropdown panel, positioned immediately below `.map-intro` in a responsive column.
- Filter types and validation in `src/lib/crashes.ts` and query building in `src/lib/queries.ts`.
- Updates to `/api/snapshots/[snapshot]/crashes/route.ts` to accept filter query parameters and query the database accordingly.
- Bilingual localization for all filter options and headers in `src/lib/language.ts`.
- Integration into `src/components/street-aware.tsx`, passing filters to `CrashDrawer` and applying layer filters in `src/components/map-canvas.tsx`.

**Tech Stack:** Next.js (App Router), React 19, TypeScript, Lucide React, PostgreSQL/PostGIS, MapLibre GL.

**Spec:** User request:
- Pull main branch and start work in a feature branch.
- Add an icon/small button below the ПТПС dashboard on the left side that toggles a dropdown.
- Implement the 6 chosen filters:
  1. Severity (Тежест на ПТП)
  2. Time of day (Време от денонощието)
  3. Day of week (Ден от седмицата)
  4. Crash type (Вид произшествие) — must have its own small scrollable dropdown so it doesn't degrade UI/UX
  7. Urban vs Rural Place (В / Извън населено място)
  9. Year (Година: 2024, 2025, 2026)

## Global Constraints

- Must run with TypeScript 5.9 and Node 24.
- Must preserve existing test suite and pass all `npm test` and `npm run typecheck` commands.
- Immutability: Always return new objects, never mutate.
- Accessibility: Keyboard navigation (Esc to close, Tab order, aria-expanded, aria-controls).
- Bilingual: Fully localized in Bulgarian (`bg`) and English (`en`).

## Review Focus

1. Crash type list overflow: The crash type dropdown must have scrollable overflow (`max-height` + `overflow-y: auto`) so 25+ crash types do not overflow the viewport.
2. Filter state persistence & reset: Clicking "Clear all" or toggling filters immediately synchronizes with both the list view and the map.
3. Empty state handling: If a combination of filters yields 0 crashes, display a clean empty state message instead of crashing or hanging.
4. Mobile viewport responsiveness: On screens <= 620px, the filter widget must stack without obscuring map navigation or bottom drawer.
5. SQL parameter safety: All filter values passed from query parameters must be strictly validated/whitelisted before passing as SQL query parameters.

---

### Task 1: Filter Types, Schema Validation & Query String Parser

**Files:**
- Modify: `src/lib/crashes.ts`
- Modify: `tests/snapshot.test.ts`

- [ ] Define `CrashFilters` interface and allowed values (severity, timeOfDay, dayOfWeek, crashType, place, year) in `src/lib/crashes.ts`.
- [ ] Implement `parseCrashFilters(searchParams: URLSearchParams): CrashFilters` and `hasActiveFilters(filters: CrashFilters): boolean` in `src/lib/crashes.ts`.
- [ ] Add unit tests in `tests/snapshot.test.ts` for parsing valid, partial, empty, and invalid filter queries.
- [ ] Run `npm test` to verify Task 1 passes.

---

### Task 2: Database Query Filtering & API Route Update

**Files:**
- Modify: `src/lib/queries.ts`
- Modify: `src/app/api/snapshots/[snapshot]/crashes/route.ts`
- Test: `tests/filters-query.test.ts`

- [ ] Write unit test `tests/filters-query.test.ts` testing `buildFilterClauses` for all 6 filters (severity, timeOfDay, dayOfWeek, crashType, place, year).
- [ ] Implement `buildFilterClauses(filters: CrashFilters, startIndex: number)` in `src/lib/queries.ts`.
- [ ] Update `listCrashes` and `countCrashesInBounds` in `src/lib/queries.ts` to accept `filters: CrashFilters` and append the WHERE clauses.
- [ ] Update `src/app/api/snapshots/[snapshot]/crashes/route.ts` to parse query parameters into `CrashFilters` and pass them to `listCrashes` and `countCrashesInBounds`.
- [ ] Run `npm test` to verify database query builders pass.

---

### Task 3: Bilingual Strings in language.ts

**Files:**
- Modify: `src/lib/language.ts`

- [ ] Add Bulgarian and English copy for all filter controls:
  - Filter labels: `filterSeverity`, `filterTimeOfDay`, `filterDayOfWeek`, `filterCrashType`, `filterPlace`, `filterYear`
  - Values: `dayTime`, `nightTime`, `weekdays`, `weekend`, `urban`, `rural`, `all`, `allTypes`, `clearFilters`, `filterCount`
  - Ensure all 25 crash types have matching Bulgarian labels and English translations.
- [ ] Run `npm run typecheck` to verify copy definitions match across `bg` and `en`.

---

### Task 4: Filter UI Component & Dropdown Panel

**Files:**
- Create: `src/components/crash-filters.tsx`
- Modify: `src/app/globals.css`

- [ ] Create `CrashFiltersComponent` in `src/components/crash-filters.tsx`:
  - Toggle button with `SlidersHorizontal` icon, active count badge, and accessible aria attributes.
  - Dropdown card with:
    - Severity selector (All / Fatal / Injury / None)
    - Time of Day selector (All / Day / Night)
    - Day of Week selector (All / Weekdays / Weekend)
    - Crash Type selector: Dedicated scrollable dropdown (`max-height: 160px; overflow-y: auto;`) with all types.
    - Urban/Rural selector (All / Urban / Rural)
    - Year selector (All / 2024 / 2025 / 2026)
    - "Clear all" button when filters are active.
- [ ] Add CSS styling in `src/app/globals.css` for `.intro-column`, `.filter-widget`, `.filter-toggle-button`, `.filter-dropdown`, `.filter-group`, and `.scrollable-type-list`.
- [ ] Ensure escape key closes the dropdown and focus returns to the toggle button.

---

### Task 5: Integration with StreetAware & MapCanvas

**Files:**
- Modify: `src/components/street-aware.tsx`
- Modify: `src/components/crash-drawer.tsx`
- Modify: `src/components/map-canvas.tsx`

- [ ] In `street-aware.tsx`, manage `filters: CrashFilters` state and render `CrashFiltersComponent` right beneath `.map-intro`.
- [ ] Update `CrashDrawer` and `CrashList` to include active filters in API requests to `/api/snapshots/${snapshotId}/crashes`.
- [ ] In `map-canvas.tsx`, update map layer filters (e.g. for severity points and heatmap) when filters change.
- [ ] Verify keyboard accessibility and click-outside dismissal.

---

### Task 6: End-to-End Verification

**Files:**
- Run: `npm test`
- Run: `npm run typecheck`
- Run: `git status`

- [ ] Run all unit tests with `npm test`.
- [ ] Run TypeScript checks with `npm run typecheck`.
- [ ] Verify git status and prepare clean commit on branch `feature/dashboard-filters`.
