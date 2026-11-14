import { MSG_TITLE_REQUIRED, MSG_TITLE_TOO_LONG } from "./types";
import type { TitleError } from "./types";

/** Shared by browser and server; length counts Unicode code points. */
export function validateTitle(title: string): TitleError | null {
  if (title.trim() === "") return MSG_TITLE_REQUIRED;
  if ([...title].length > 200) return MSG_TITLE_TOO_LONG;
  return null;
}
