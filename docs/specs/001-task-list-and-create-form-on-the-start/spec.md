---
spec_id: 001-task-list-and-create-form-on-the-start
title: Task list and create form on the start page
status: done
priority: P1
shape: web-nextjs
parent: ika100-demo/taskboard15-gitops:001-persistent-tasks-in-postgres-shown-and
---

# 001 — Task list and create form on the start page

## Problem

The task API keeps tasks only in its memory: every restart, redeploy or new replica loses or splits them, so nobody can rely on the board. People also have no way to see or add tasks except by calling the API by hand, because the web UI has no features yet. This spec makes tasks durable in a Postgres database and gives people a page in the web UI where they see all tasks and create new ones.

## System context

Slice of the system plan `001-persistent-tasks-in-postgres-shown-and` in `ika100-demo/taskboard15-gitops` for `taskboard15-web` (web-nextjs). The system criteria and the contract below are binding: every criterion of this spec implements one of them and names it: `(system AC-<NNN>.<n>)`.

### System criteria

- **AC-001.4** Given tasks exist, when a person opens the web UI's start page, then it lists every task in creation order (oldest first), each showing its title and its due date as `YYYY-MM-DD`, or "No due date" when it has none.
- **AC-001.5** Given no task exists, when a person opens the web UI's start page, then it shows the text "No tasks yet" and the form to create a task.
- **AC-001.6** Given the start page is open, when a person enters the title "Write report" and the due date 2026-12-01 and submits the form, then the new task appears at the end of the list without the person reloading the page, the form is cleared, and the task is still listed after a reload of the page and in `GET /tasks`.
- **AC-001.7** Given the start page is open, when a person submits the form with an empty or whitespace-only title or one longer than 200 characters, then no task is created, the form keeps the entered values, and a message next to the title field says "Title is required" (empty or whitespace) or "Title must be at most 200 characters" (too long).
- **AC-001.8** Given the task API is unreachable or answers with an error, when a person opens the start page or submits the form, then the page shows "Tasks could not be loaded. Try again later." (when loading) or "Task could not be saved. Try again." (when saving) instead of an error page, and on a failed save the form keeps the entered values.

### Contract

Caller: `taskboard15-web` (server side), at `API_URL` (`http://taskboard15-api` in the cluster). Callee:
`taskboard15-api`. JSON, UTF-8, no authentication (system A10, dev only).

### `GET /tasks`

- `200`: a bare JSON array of tasks, creation order, oldest first, no upper bound, no pagination.
- `503`: database unreachable, body `{"detail": "database unavailable"}`.

### `POST /tasks`

Request body:

| Field | Type | Rules |
|---|---|---|
| `title` | string, required | 1 to 200 characters (Unicode code points), at least one non-whitespace character; stored as sent, not trimmed |
| `due_date` | string or `null`, optional | calendar date `YYYY-MM-DD`; absent or `null` means no due date; past dates accepted |

Responses:

- `201`: the created task.
- `422`: invalid input, FastAPI's standard body `{"detail": [{"loc": ["body", "<field>"], "msg": "...", "type": "..."}]}`;
  the field is `loc[1]` (`title` or `due_date`). No task is created.
- `503`: database unreachable, body `{"detail": "database unavailable"}`. No task is created.

### Task

| Field | Type | Notes |
|---|---|---|
| `id` | string | server-generated, opaque, unique, never reused; clients cannot set it |
| `title` | string | as sent |
| `due_date` | string `YYYY-MM-DD` or `null` | |

### Probes (cluster only)

- `GET /ready`: `200 {"status": "ready"}` when the database answers; `503 {"status": "not ready"}` otherwise.
- `GET /health`: `200` while the process runs, independent of the database.

The web UI's `/api/ready` and `/api/health` do not call the task API.

No events.

### Errors

- Error bodies are JSON with a `detail` field: a string for `503`, FastAPI's list for `422`.
- The web UI treats `422` naming `title` as a field error at the title field (its messages, see its criteria), and any
  other `422` as a failed save.
- Any response the contract does not list for a call (other `4xx`, `5xx`, a non-JSON body, a body not matching the
  shapes above), a connection error and a timeout count as "the API answers with an error": on `GET /tasks` the page
  shows "Tasks could not be loaded. Try again later.", on `POST /tasks` it shows "Task could not be saved. Try again."
  and keeps the form values. The page itself never answers with an error page for this.
- The web UI logs each such failure with the status or error kind, never the task title.

### Timeouts

- Web to API, `GET /tasks`: 5 s total, no retry; on timeout the load message is shown.
- Web to API, `POST /tasks`: 5 s total, no retry (a retry could create the task twice); on timeout the save message is
  shown, and a later reload shows whether the task was stored.
- API to Postgres: connect timeout 2 s, statement timeout 3 s; on either, the request answers `503` within 5 s.
- `/ready` checks the database with a 1 s timeout, so a down database takes every replica out of rotation; the
  Service then refuses connections, which the web UI handles as unreachable. The API reconnects by itself when the
  database is back, without a restart.

### Provided by the system

The gitops part of this plan wires these for this repo; rely on them, do not ask for them again:

- env `API_URL=http://taskboard15-api`

### Notes for this repo

The task API is called only server-side (Server Component, Server Action or route handler) at API_URL; the browser
never calls the API, and API_URL is never a NEXT_PUBLIC_ variable. Document API_URL in docs/env-vars.md.
/api/ready must not depend on the task API, so that an API outage shows the message instead of taking the UI down.
Count title length in Unicode code points, as the API does (not UTF-16 units).

## Stories

<!-- As a <persona>, I want <goal>, so that <benefit>. -->

## Acceptance criteria

- **AC-001.1** Given the task API returns tasks for `GET /tasks`, when a person opens `/`, then the page lists every task in the order the API returns them (oldest first), each showing its `title` and its `due_date` as `YYYY-MM-DD`, or "No due date" when `due_date` is `null` (system AC-001.4)
- **AC-001.2** Given the task API returns an empty array for `GET /tasks`, when a person opens `/`, then the page shows "No tasks yet" and the create form with a title field and a date input for the due date (system AC-001.5)
- **AC-001.3** Given `/` is open, when a person enters the title "Write report" and the due date 2026-12-01 and submits, then the web UI sends `POST /tasks` with `{"title": "Write report", "due_date": "2026-12-01"}`, and on `201` the returned task appears at the end of the list without a page reload and the form is cleared; a reload lists it from `GET /tasks` (system AC-001.6)
- **AC-001.4** Given `/` is open, when a person submits with an empty or whitespace-only title, then no `POST /tasks` is sent, the form keeps the entered values, and next to the title field the page shows "Title is required" (system AC-001.7)
- **AC-001.5** Given `/` is open, when a person submits a title longer than 200 characters, then no `POST /tasks` is sent, the form keeps the entered values, and next to the title field the page shows "Title must be at most 200 characters" (system AC-001.7)
- **AC-001.6** Given the task API answers `POST /tasks` with `422` naming the `title` field, when the person submitted the form, then no task is added to the list, the form keeps the entered values, and next to the title field the page shows "Title is required" or, for a title over 200 characters, "Title must be at most 200 characters" (system AC-001.7)
- **AC-001.7** Given the task API is unreachable, does not answer within 5 seconds, or answers `GET /tasks` with a status other than `200`, when a person opens `/`, then the page shows "Tasks could not be loaded. Try again later." instead of an error page (system AC-001.8)
- **AC-001.8** Given the task API is unreachable, does not answer within 5 seconds, or answers `POST /tasks` with a status other than `201` or `422`, when a person submits the form, then the page shows "Task could not be saved. Try again.", the list is unchanged, and the form keeps the entered values (system AC-001.8)

## Non-goals

## Assumptions

<!-- Spec 149: decisions taken by default, approved with the spec. One bullet each: - **A1** <the decision> (other option: <…>; affects AC-…). A revised one is struck through (~~…~~), never deleted. -->

## Open questions

<!-- Only what may not be decided by default (spec 149): security or access, money, destroying or migrating data, or a request too ambiguous to build. Approval is refused while any is open. Strike answered ones (~~…~~) and fold the answer into the criteria. -->

## Changelog

- 2026-11-14 created from the system plan, with its criteria (spec 147)
- 2026-11-14 approved
- 2026-11-14 building
- 2026-11-14 done
