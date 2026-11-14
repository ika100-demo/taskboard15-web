"use server";

import { postTask } from "@/lib/tasks/api";
import {
  MSG_SAVE_FAILED,
  MSG_TITLE_REQUIRED,
  MSG_TITLE_TOO_LONG,
} from "@/lib/tasks/types";
import type { CreateTaskInput, CreateTaskResult } from "@/lib/tasks/types";
import { validateTitle } from "@/lib/tasks/validate";

export async function createTaskAction(input: CreateTaskInput): Promise<CreateTaskResult> {
  const error = validateTitle(input.title);
  if (error !== null) return { ok: false, field: "title", message: error };

  const result = await postTask(input);
  if (result.ok) return { ok: true, task: result.task };
  if (result.reason === "title_invalid") {
    return {
      ok: false,
      field: "title",
      message: [...input.title].length > 200 ? MSG_TITLE_TOO_LONG : MSG_TITLE_REQUIRED,
    };
  }
  return { ok: false, field: null, message: MSG_SAVE_FAILED };
}
