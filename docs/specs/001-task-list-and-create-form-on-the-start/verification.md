# Verification — 001 Task list and create form on the start page

**Result:** pass
**Commit:** 06e447e · **Base:** a46bfbe · **Trace:** 8/8 criteria named by tests

| Criterion | Verdict | Tests | Implementation | Notes |
|---|---|---|---|---|
| AC-001.1 | met | `tests/page.test.tsx::AC-001.1 lists every task in API order…`, `tests/task-board.test.tsx::AC-001.1 lists every task in the given order…`, `tests/tasks-api.test.ts::AC-001.1 returns tasks in API order from GET API_URL/tasks` | `lib/tasks/api.ts:61-75` (order kept, `isTask` checks `YYYY-MM-DD` at `:7-17`), `app/page.tsx:9,14-15`, `app/_components/task-board.tsx:57-62` | tests assert item count, order, title, date string and "No due date" for `null` |
| AC-001.2 | met | `tests/page.test.tsx::AC-001.2 shows 'No tasks yet' and the create form…`, `tests/task-board.test.tsx::AC-001.2 shows 'No tasks yet' with no list…`, `tests/tasks-api.test.ts::AC-001.2 returns an empty list…` | `app/_components/task-board.tsx:54-55,65-82` | asserts the text, no list, a Title textbox and an `input type="date"` labelled "Due date" |
| AC-001.3 | met | `tests/tasks-api.test.ts::AC-001.3 sends POST /tasks with the exact JSON body…` (parsed body equals `{"title":"Write report","due_date":"2026-12-01"}`), `tests/actions.test.ts::AC-001.3 posts the input…`, `tests/task-board.test.tsx::AC-001.3 sends the entered values, appends… and clears the form`, `tests/page.test.tsx::AC-001.3 passes createTaskAction to the board` | `lib/tasks/api.ts:88-101`, `app/actions.ts:16-17`, `app/_components/task-board.tsx:31-43`, `app/page.tsx:15` | append at end and cleared inputs asserted without a reload; "a reload lists it" is covered by the page rendering `GET /tasks` per request (`dynamic = "force-dynamic"`, `app/page.tsx:6`, AC-001.1 page test) and end-to-end by `e2e/smoke.spec.ts` "a created task survives a reload @smoke @writes" |
| AC-001.4 | met | `tests/task-board.test.tsx::AC-001.4 blocks an empty or whitespace title…`, `::AC-001.4 blocks a fully empty title`, `tests/actions.test.ts::AC-001.4 rejects…without calling the API`, `tests/tasks-validate.test.ts::AC-001.4 …` | `lib/tasks/validate.ts:6`, `app/_components/task-board.tsx:26-29,67-75`, `app/actions.ts:13-14` | asserts `createTask` not called, both values kept, message in `#task-title-error` with `aria-invalid`/`aria-describedby` |
| AC-001.5 | met | `tests/task-board.test.tsx::AC-001.5 blocks a title over 200 characters…`, `::AC-001.5 does not limit input length…`, `tests/actions.test.ts::AC-001.5 …`, `tests/tasks-validate.test.ts::AC-001.5 …` (200 ok, 201 rejected, code points) | `lib/tasks/validate.ts:7`, `app/_components/task-board.tsx:26-29,75` | no `maxlength`/`required` on the field, so every case reaches the validator |
| AC-001.6 | met | `tests/tasks-api.test.ts::AC-001.6 maps a 422 naming the title field to title_invalid…`, `tests/actions.test.ts::AC-001.6 …` (three tests, code-point length), `tests/task-board.test.tsx::AC-001.6 shows the server's title message…`, `::AC-001.6 shows 'Title is required' from the server` | `lib/tasks/api.ts:77-86,102-104`, `app/actions.ts:18-24`, `app/_components/task-board.tsx:44-45` | list length unchanged and values kept asserted |
| AC-001.7 | met | `tests/page.test.tsx::AC-001.7 shows the load message instead of the board…`, `tests/tasks-api.test.ts::AC-001.7 …` (unreachable, timeout, 5000 ms signal, non-200 incl. 201/204/500, non-JSON, wrong shape, unset `API_URL`) | `lib/tasks/api.ts:31-51,61-75`, `app/page.tsx:16-17` | page renders an `alert` with the exact text and no list/form; `listTasks` never throws, so no error page |
| AC-001.8 | met | `tests/tasks-api.test.ts::AC-001.8 …` (5000 ms signal, 200, other 422s, 500, malformed 201, network/timeout without retry, unset `API_URL`, title never logged), `tests/actions.test.ts::AC-001.8 maps a failed call…`, `tests/task-board.test.tsx::AC-001.8 shows the save-failed alert…`, `::…when createTask rejects`, `::clears the save message on the next submit` | `lib/tasks/api.ts:94-109`, `app/actions.ts:25`, `app/_components/task-board.tsx:33-37,46-47,78` | alert inside the form with the exact text, list length unchanged, both values kept |

## Non-goals

The spec lists no non-goals. No template-owned layout (header, footer, navigation) changed: `app/layout.tsx` is untouched, and the `globals.css` changes remove only rules of the deleted start-page sections (hero, cards, steps) and add `.board` rules plus a `--danger` token. `/api/ready` and `/api/health` are untouched and do not call the task API. ✔

## Deviations from the plan

- `tests/actions.test.ts`, `tests/task-board.test.tsx`, `tests/tasks-api.test.ts`, `tests/tasks-validate.test.ts` are in no task's `files`: the acceptance tests, written in the red phase before the tasks; acceptable.
- `docs/backlog.md` is in no task's `files`: the generated `cplat spec index` row; acceptable (it shows status `approved` while the spec says `building`, regenerated on the next index run).
- `docs/specs/001-*/{spec,design,plan}.md`: the spec artefacts themselves; acceptable.
- `app/globals.css:391-394` leaves an empty `@media (prefers-reduced-motion: no-preference) {}` block after removing the hero animation; cosmetic, acceptable.
- All four tasks are `done: true`.

## Contract

Matches `design.md`: message constants, result types, `validateTitle`, `listTasks`/`postTask` (no-store, `AbortSignal.timeout(5000)`, no retry, shape checks, `logger.warn("tasks api call failed", { op, kind, status? })`, no title logged, no log for a 422 naming `title`), `createTaskAction`, the `TaskBoard` props and the page DOM table. A `422` not naming `title` is logged as kind `invalid_body` with status 422; design does not name the kind for that case, so acceptable. ✔

## Smoke tests

`e2e/smoke.spec.ts` keeps the read-only root check, adds a read-only check that `/` shows the `Tasks` heading without the load message (fails without the feature, since the old heading was `taskboard15-web`), and one `@smoke @writes` test that creates `smoke-<uuid>` and finds it after a reload. No finding.

## Mutation check (report only)

Skipped: no mutation check for shape web-nextjs yet.
