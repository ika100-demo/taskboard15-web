export const MSG_TITLE_REQUIRED = "Title is required";
export const MSG_TITLE_TOO_LONG = "Title must be at most 200 characters";
export const MSG_LOAD_FAILED = "Tasks could not be loaded. Try again later.";
export const MSG_SAVE_FAILED = "Task could not be saved. Try again.";
export const MSG_NO_TASKS = "No tasks yet";
export const MSG_NO_DUE_DATE = "No due date";

/** `due_date` is "YYYY-MM-DD" or null. */
export type Task = { id: string; title: string; due_date: string | null };
export type CreateTaskInput = { title: string; due_date: string | null };
export type TitleError = typeof MSG_TITLE_REQUIRED | typeof MSG_TITLE_TOO_LONG;
export type ListTasksResult = { ok: true; tasks: Task[] } | { ok: false };
export type PostTaskResult =
  | { ok: true; task: Task }
  | { ok: false; reason: "title_invalid" }
  | { ok: false; reason: "failed" };
export type CreateTaskResult =
  | { ok: true; task: Task }
  | { ok: false; field: "title"; message: TitleError }
  | { ok: false; field: null; message: typeof MSG_SAVE_FAILED };
