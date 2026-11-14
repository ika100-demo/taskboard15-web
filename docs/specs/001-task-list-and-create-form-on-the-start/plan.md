---
spec_id: 001-task-list-and-create-form-on-the-start
shape: web-nextjs
spec_hash: 0ab91c44625b
summary: Start page lists tasks from the task API and creates new ones through a Server Action
tasks:
  - id: t1
    title: Add the server-side task API client, title validation and shared types
    files: [lib/tasks/types.ts, lib/tasks/validate.ts, lib/tasks/api.ts, docs/env-vars.md]
    covers: [AC-001.1, AC-001.3, AC-001.4, AC-001.5, AC-001.6, AC-001.7, AC-001.8]
    parallel_safe: true
    depends_on: []
    done: true
  - id: t2
    title: Add the createTaskAction Server Action
    files: [app/actions.ts]
    covers: [AC-001.3, AC-001.4, AC-001.5, AC-001.6, AC-001.8]
    parallel_safe: true
    depends_on: [t1]
    done: true
  - id: t3
    title: Add the TaskBoard client component (list, empty state, form, errors)
    files: [app/_components/task-board.tsx]
    covers: [AC-001.1, AC-001.2, AC-001.3, AC-001.4, AC-001.5, AC-001.6, AC-001.8]
    parallel_safe: true
    depends_on: [t1]
    done: true
  - id: t4
    title: Replace the start page with the task board and its load-failure message
    files: [app/page.tsx, app/globals.css, app/_components/feature-card.tsx, app/_components/icons.tsx, tests/page.test.tsx, e2e/home.spec.ts, e2e/smoke.spec.ts]
    covers: [AC-001.1, AC-001.2, AC-001.3, AC-001.7]
    parallel_safe: true
    depends_on: [t1, t2, t3]
---

# Plan — 001 Task list and create form on the start page

The interfaces, messages and DOM queries every task builds against are in [design.md](design.md#contract). No gitops task: the system plan already sets `API_URL=http://taskboard15-api` for this component.

## t1 — Add the server-side task API client, title validation and shared types

**Files:** lib/tasks/types.ts, lib/tasks/validate.ts, lib/tasks/api.ts, docs/env-vars.md
**Covers:** AC-001.1, AC-001.3, AC-001.4, AC-001.5, AC-001.6, AC-001.7, AC-001.8
**Goal:** one module that talks to `taskboard15-api` and never throws, plus the pure title validator and the types and message constants the rest of the feature imports.

**Implementation notes:**
- `types.ts`: `Task`, `CreateTaskInput`, `TitleError`, `ListTasksResult`, `PostTaskResult`, `CreateTaskResult` and the `MSG_*` constants exactly as in design.md.
- `validate.ts`: `validateTitle` with `title.trim() === ""` then `[...title].length > 200` (code points, not `.length`).
- `api.ts`: read `process.env.API_URL` per call, strip a trailing `/`; unset or empty is failure kind `config`.
- `fetch` with `cache: "no-store"` and `signal: AbortSignal.timeout(5000)`; no retry on either call.
- Check response shapes (array of `Task`, `due_date` `null` or `^\d{4}-\d{2}-\d{2}$`); a parse error or wrong shape is `invalid_body`.
- `POST`: body `JSON.stringify({ title, due_date })`, title untrimmed; map `201` / `422` naming `title` / anything else as in design.md.
- Classify a thrown `TimeoutError`/`AbortError` as `timeout`, any other thrown error as `network`.
- Log each failure with `logger.warn("tasks api call failed", { op, kind, status? })`; never log the title or body.
- `docs/env-vars.md`: add `API_URL` to Core (no default; server-side only, never `NEXT_PUBLIC_`; unset means the page shows the load/save messages).

**Done when:** the acceptance tests that target `lib/tasks/*` directly (fetch stubbed) pass, and `devbox run quality` is clean.

## t2 — Add the createTaskAction Server Action

**Files:** app/actions.ts
**Covers:** AC-001.3, AC-001.4, AC-001.5, AC-001.6, AC-001.8
**Goal:** the only entry point the browser uses to create a task, so the API stays server-side.

**Implementation notes:**
- `"use server"` at the top; export only `createTaskAction(input: CreateTaskInput): Promise<CreateTaskResult>`.
- Re-validate with `validateTitle`; on an error return it without calling `postTask`.
- Map `postTask` results: `ok` → task; `title_invalid` → title error chosen by code-point length; `failed` → `MSG_SAVE_FAILED`.
- Never throw for API failures.

**Done when:** the acceptance tests for `createTaskAction` (with `@/lib/tasks/api` mocked) pass.

## t3 — Add the TaskBoard client component

**Files:** app/_components/task-board.tsx
**Covers:** AC-001.1, AC-001.2, AC-001.3, AC-001.4, AC-001.5, AC-001.6, AC-001.8
**Goal:** the interactive part of the start page: list, empty state, form, field and save errors, and appending a created task without a reload.

**Implementation notes:**
- `"use client"`; props `initialTasks` and `createTask` exactly as in design.md; import nothing from `app/actions.ts` or `lib/tasks/api.ts` (only types, messages and `validateTitle`).
- List state starts from `initialTasks`, kept in the given order; `<ul aria-label="Tasks">`, each `<li>` shows the title and `due_date ?? "No due date"`; with no tasks show `<p>No tasks yet</p>` and no list.
- Controlled `title` and `dueDate` inputs; `<form aria-label="Create task" noValidate onSubmit>`; title input with no `required`/`maxLength`; `type="date"` input labelled "Due date"; button "Add task", disabled while pending.
- Submit flow and error rendering (title error `id="task-title-error"` with `aria-invalid`/`aria-describedby`, save error as `role="alert"`) exactly as in design.md; a rejected `createTask` counts as a save failure.
- Use React keys from `task.id`.

**Done when:** the acceptance tests rendering `TaskBoard` with a mocked `createTask` pass (list order, empty state, append and clear on success, values kept on every error, no call on invalid titles).

## t4 — Replace the start page with the task board and its load-failure message

**Files:** app/page.tsx, app/globals.css, app/_components/feature-card.tsx, app/_components/icons.tsx, tests/page.test.tsx, e2e/home.spec.ts, e2e/smoke.spec.ts
**Covers:** AC-001.1, AC-001.2, AC-001.3, AC-001.7
**Goal:** `/` loads the tasks on the server on every request and renders either the load message or the board wired to the Server Action.

**Implementation notes:**
- `app/page.tsx`: async default export `HomePage`, `export const dynamic = "force-dynamic"`; `<h1>Tasks</h1>`; `await listTasks()`; `{ok: false}` → `<p role="alert">` with `MSG_LOAD_FAILED` and nothing else; `{ok: true}` → `<TaskBoard initialTasks={tasks} createTask={createTaskAction} />`.
- Remove the template hero, feature cards and get-started section; delete `feature-card.tsx` and `icons.tsx` (no other importer).
- `app/globals.css`: styles for the list, form, field error and alerts using the existing tokens; drop rules only the removed sections used; the phone layout must still not scroll horizontally.
- `tests/page.test.tsx`: replace the template tests (they assert the removed content) with tests for the new page, or delete the file if the acceptance tests already cover it; keep the coverage gate at 80%.
- `e2e/home.spec.ts`: heading is now `Tasks`; drop the "Check health" link test (the header's Health link remains).
- `e2e/smoke.spec.ts`: keep the read-only root check and add a read-only one that `/` shows the `Tasks` heading and not the load message; add one `@smoke @writes` test that creates `smoke-<uuid>` and finds it after a reload.
- Leave `app/api/ready/route.ts` and `app/api/health/route.ts` untouched.

**Done when:** all acceptance tests for AC-001.1 to AC-001.8 pass, `devbox run ci` is green, and `devbox run e2e` passes (without `API_URL` the page shows the load message, which the landmark tests tolerate).
