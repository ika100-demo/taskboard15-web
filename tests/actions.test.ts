import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTaskAction } from "@/app/actions";
import { postTask } from "@/lib/tasks/api";
import { validateTitle } from "@/lib/tasks/validate";

vi.mock("@/lib/tasks/api");
vi.mock("@/lib/tasks/validate", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tasks/validate")>();
  return { ...actual, validateTitle: vi.fn(actual.validateTitle) };
});

const post = vi.mocked(postTask);
const task = { id: "9", title: "Write report", due_date: "2026-12-01" };

beforeEach(() => post.mockReset());

describe("createTaskAction", () => {
  it("AC-001.3 posts the input and returns the created task", async () => {
    post.mockResolvedValue({ ok: true, task });
    const result = await createTaskAction({ title: "Write report", due_date: "2026-12-01" });
    expect(post).toHaveBeenCalledWith({ title: "Write report", due_date: "2026-12-01" });
    expect(result).toEqual({ ok: true, task });
  });

  it("AC-001.4 rejects an empty or whitespace title without calling the API", async () => {
    for (const title of ["", "   "]) {
      expect(await createTaskAction({ title, due_date: null })).toEqual({
        ok: false,
        field: "title",
        message: "Title is required",
      });
    }
    expect(post).not.toHaveBeenCalled();
  });

  it("AC-001.5 rejects a title over 200 characters without calling the API", async () => {
    expect(await createTaskAction({ title: "a".repeat(201), due_date: null })).toEqual({
      ok: false,
      field: "title",
      message: "Title must be at most 200 characters",
    });
    expect(post).not.toHaveBeenCalled();
  });

  it("AC-001.6 maps title_invalid to 'Title is required' for a short title", async () => {
    vi.mocked(validateTitle).mockReturnValueOnce(null);
    post.mockResolvedValue({ ok: false, reason: "title_invalid" });
    expect(await createTaskAction({ title: "x", due_date: null })).toEqual({
      ok: false,
      field: "title",
      message: "Title is required",
    });
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("AC-001.6 maps title_invalid to the length message for a title over 200 code points", async () => {
    for (const title of ["a".repeat(201), "😀".repeat(201)]) {
      post.mockReset();
      vi.mocked(validateTitle).mockReturnValueOnce(null);
      post.mockResolvedValue({ ok: false, reason: "title_invalid" });
      expect(await createTaskAction({ title, due_date: null })).toEqual({
        ok: false,
        field: "title",
        message: "Title must be at most 200 characters",
      });
      expect(post).toHaveBeenCalledTimes(1);
    }
  });

  it("AC-001.6 counts code points when mapping title_invalid (150 emoji are not too long)", async () => {
    vi.mocked(validateTitle).mockReturnValueOnce(null);
    post.mockResolvedValue({ ok: false, reason: "title_invalid" });
    expect(await createTaskAction({ title: "😀".repeat(150), due_date: null })).toEqual({
      ok: false,
      field: "title",
      message: "Title is required",
    });
  });

  it("AC-001.8 maps a failed call to the save-failed message", async () => {
    post.mockResolvedValue({ ok: false, reason: "failed" });
    expect(await createTaskAction({ title: "x", due_date: null })).toEqual({
      ok: false,
      field: null,
      message: "Task could not be saved. Try again.",
    });
  });
});
