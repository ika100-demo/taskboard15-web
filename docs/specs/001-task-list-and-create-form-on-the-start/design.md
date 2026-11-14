# Design — 001 Task list and create form on the start page

## Decisions

- The task API is called only from server code: the start page (`app/page.tsx`, an async Server Component) loads the list, a Server Action (`app/actions.ts`) creates a task. The browser never sees `API_URL`, which stays a plain server env variable (spec notes).
- One server-side client module, `lib/tasks/api.ts`, owns every HTTP detail (URL, 5 s timeout via `AbortSignal.timeout(5000)`, no retry, response-shape checks, failure logging) and returns discriminated results instead of throwing, so the page and the action never reach `app/error.tsx` for an API failure (AC-001.7, AC-001.8).
- The page passes the Server Action to the client component as a prop (`createTask`), not by import: the client component is then testable with a plain mock and can be built in parallel with the action.
- The form uses controlled inputs and an `onSubmit` handler (`event.preventDefault()`, then `await createTask(...)` inside `startTransition`), not `<form action={...}>`: React 19 resets a form after a form action, which would break "the form keeps the entered values" (AC-001.4 to AC-001.6, AC-001.8).
- Title rules are checked in one shared pure function, `validateTitle`, run in the browser before submit (so no `POST /tasks` is sent, AC-001.4, AC-001.5) and again in the Server Action before calling the API. Length counts Unicode code points (`[...title].length`), emptiness uses `title.trim() === ""` (spec notes). The title is sent untrimmed, as typed.
- When the load fails, the page shows only the load message, not the board or the form: a list it could not load cannot be appended to sensibly. A reload is the retry.
- `/api/ready` and `/api/health` stay unchanged and never call the task API (spec notes).
- The template's marketing content (hero, feature cards, get-started steps) is replaced by the task board; `app/_components/feature-card.tsx` and `app/_components/icons.tsx` are deleted because nothing else uses them and untested files would lower the coverage gate.
- No new dependency, no ADR: every choice is local to this feature.

## Modules

| Module | Responsibility | New / changed |
|---|---|---|
| `lib/tasks/types.ts` | `Task`, result types, the five user-facing message constants | new |
| `lib/tasks/validate.ts` | `validateTitle(title)`: pure, shared by browser and server | new |
| `lib/tasks/api.ts` | `listTasks()`, `postTask(input)`: HTTP to `API_URL`, timeout, shape checks, logging | new |
| `app/actions.ts` | `"use server"`; `createTaskAction(input)`: validate, call `postTask`, map to `CreateTaskResult` | new |
| `app/_components/task-board.tsx` | `"use client"`; list, empty state, form, field and save errors, append on success | new |
| `app/page.tsx` | async Server Component; `listTasks()` then load message or `<TaskBoard>` | changed (replaces template content) |
| `app/globals.css` | styles for the board, list, form and messages | changed |
| `docs/env-vars.md` | documents `API_URL` | changed |

## Contract

### Upstream (binding, from the system plan)

`GET /tasks` and `POST /tasks` at `API_URL` exactly as in the spec's `### Contract`. This repo adds nothing to it.

### Messages (exact strings, `lib/tasks/types.ts`)

```ts
export const MSG_TITLE_REQUIRED = "Title is required";
export const MSG_TITLE_TOO_LONG = "Title must be at most 200 characters";
export const MSG_LOAD_FAILED = "Tasks could not be loaded. Try again later.";
export const MSG_SAVE_FAILED = "Task could not be saved. Try again.";
export const MSG_NO_TASKS = "No tasks yet";
export const MSG_NO_DUE_DATE = "No due date";
```

### Types and functions

```ts
// lib/tasks/types.ts
export type Task = { id: string; title: string; due_date: string | null };   // due_date "YYYY-MM-DD"
export type CreateTaskInput = { title: string; due_date: string | null };
export type TitleError = typeof MSG_TITLE_REQUIRED | typeof MSG_TITLE_TOO_LONG;
export type ListTasksResult = { ok: true; tasks: Task[] } | { ok: false };
export type PostTaskResult =
  | { ok: true; task: Task }
  | { ok: false; reason: "title_invalid" }      // 422 whose detail names loc[1] === "title"
  | { ok: false; reason: "failed" };            // anything else
export type CreateTaskResult =
  | { ok: true; task: Task }
  | { ok: false; field: "title"; message: TitleError }
  | { ok: false; field: null; message: typeof MSG_SAVE_FAILED };

// lib/tasks/validate.ts
export function validateTitle(title: string): TitleError | null;
//   title.trim() === ""          -> MSG_TITLE_REQUIRED
//   [...title].length > 200      -> MSG_TITLE_TOO_LONG
//   otherwise                    -> null

// lib/tasks/api.ts  (server only; reads process.env.API_URL at call time, trailing "/" stripped)
export async function listTasks(): Promise<ListTasksResult>;
export async function postTask(input: CreateTaskInput): Promise<PostTaskResult>;

// app/actions.ts
"use server";
export async function createTaskAction(input: CreateTaskInput): Promise<CreateTaskResult>;
```

`listTasks`: `fetch(`${API_URL}/tasks`, { cache: "no-store", signal: AbortSignal.timeout(5000) })`. `{ok: true}` only for status `200` with a JSON array whose every item is a `Task` (`id` string, `title` string, `due_date` `null` or a string matching `^\d{4}-\d{2}-\d{2}$`); the order is kept as returned (AC-001.1). Every other outcome is `{ok: false}` (AC-001.7).

`postTask`: `POST ${API_URL}/tasks`, header `content-type: application/json`, body `JSON.stringify({ title, due_date })` (so the example sends exactly `{"title": "Write report", "due_date": "2026-12-01"}`; an empty date input sends `"due_date": null`), same signal, no retry (AC-001.3). `201` with a body that is a `Task` gives `{ok: true, task}`; `422` with `detail` an array containing an item whose `loc[1] === "title"` gives `title_invalid`; everything else, including other `422`s, non-JSON bodies, connection errors and timeouts, gives `failed` (AC-001.6, AC-001.8).

`API_URL` unset or empty counts as unreachable (`{ok: false}` / `failed`) with failure kind `config`.

`createTaskAction`:
1. `validateTitle(input.title)` not null: return `{ok: false, field: "title", message}` without calling `postTask` (AC-001.4, AC-001.5).
2. `postTask(input)`: `ok` → `{ok: true, task}`; `title_invalid` → `{ok: false, field: "title", message: [...title].length > 200 ? MSG_TITLE_TOO_LONG : MSG_TITLE_REQUIRED}` (AC-001.6); `failed` → `{ok: false, field: null, message: MSG_SAVE_FAILED}` (AC-001.8).

### Failure logging

Each failed call logs one line through `@/lib/logger`: `logger.warn("tasks api call failed", { op: "list" | "create", kind, status? })` with `kind` one of `status` (unexpected status, `status` set), `invalid_body` (not JSON or wrong shape, `status` set), `timeout`, `network`, `config`. A `422` naming `title` logs nothing (it is a user error). The title and the request body are never logged.

### `TaskBoard` component

```ts
// app/_components/task-board.tsx
"use client";
export function TaskBoard(props: {
  initialTasks: Task[];
  createTask: (input: CreateTaskInput) => Promise<CreateTaskResult>;
}): JSX.Element;
```

Behaviour on submit (`<form noValidate onSubmit>`):
1. Clear the save message. `validateTitle(title)` not null: show it as the title error, do not call `createTask`, keep the values.
2. Otherwise call `createTask({ title, due_date: dueDate === "" ? null : dueDate })`; the button is disabled while it runs (no double create).
3. `ok`: append `task` to the end of the list, clear title, due date and the title error (AC-001.3).
4. `field: "title"`: show `message` as the title error, keep values, list unchanged (AC-001.6).
5. `field: null`, or `createTask` rejects: show `MSG_SAVE_FAILED`, keep values, list unchanged (AC-001.8).

### Page DOM (what the acceptance tests query)

| Element | Accessible query |
|---|---|
| page heading | `heading`, level 1, name `Tasks` |
| load failure | `alert` with text `Tasks could not be loaded. Try again later.`; no list and no form are rendered |
| task list (one or more tasks) | `list`, name `Tasks` (`<ul aria-label="Tasks">`); one `listitem` per task in API order, containing the title text and either the `due_date` string as returned or `No due date` |
| empty state | text `No tasks yet` (in a `<p>`), no `list` |
| form | `form`, name `Create task` (`<form aria-label="Create task" noValidate>`) |
| title field | `textbox`, label `Title`; no `required`, no `maxLength`, so every case reaches the validator |
| due date field | input `type="date"`, label `Due date` (`getByLabelText("Due date")`) |
| submit | `button`, name `Add task` |
| title error | `<p id="task-title-error">` directly after the title field with the message; the field gets `aria-invalid="true"` and `aria-describedby="task-title-error"`; absent when there is no error |
| save failure | `alert` with text `Task could not be saved. Try again.`, inside the form |

The page exports `dynamic = "force-dynamic"` so the list is fetched on every request, never at build time.

### Test seams

- `lib/tasks/api.ts`: stub `globalThis.fetch` and set `process.env.API_URL` (for example `http://api.test`).
- `app/actions.ts`: `vi.mock("@/lib/tasks/api")`.
- `TaskBoard`: render it with `initialTasks` and a `vi.fn()` for `createTask`.
- `app/page.tsx`: `vi.mock("@/lib/tasks/api")` (or stub `fetch`), then `render(await HomePage())`.

## Data

None in this repo; tasks live in `taskboard15-api`.

## Configuration

`API_URL` (no default; unset means every call fails with the load or save message) is documented in `docs/env-vars.md` under Core. The system's gitops part already sets `API_URL=http://taskboard15-api`, so no gitops task is needed.
