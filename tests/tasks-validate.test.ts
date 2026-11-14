import { describe, expect, it } from "vitest";

import { MSG_TITLE_REQUIRED, MSG_TITLE_TOO_LONG } from "@/lib/tasks/types";
import { validateTitle } from "@/lib/tasks/validate";

describe("validateTitle", () => {
  it("AC-001.4 rejects an empty title with 'Title is required'", () => {
    expect(MSG_TITLE_REQUIRED).toBe("Title is required");
    expect(validateTitle("")).toBe("Title is required");
  });

  it("AC-001.4 rejects a whitespace-only title", () => {
    expect(validateTitle("   \t\n ")).toBe("Title is required");
  });

  it("AC-001.5 rejects a title over 200 characters", () => {
    expect(MSG_TITLE_TOO_LONG).toBe("Title must be at most 200 characters");
    expect(validateTitle("a".repeat(201))).toBe("Title must be at most 200 characters");
  });

  it("AC-001.5 accepts exactly 200 characters", () => {
    expect(validateTitle("a".repeat(200))).toBeNull();
  });

  it("AC-001.5 counts Unicode code points, not UTF-16 units", () => {
    expect(validateTitle("😀".repeat(200))).toBeNull();
    expect(validateTitle("😀".repeat(201))).toBe("Title must be at most 200 characters");
  });

  it("AC-001.3 accepts a normal title", () => {
    expect(validateTitle("Write report")).toBeNull();
  });
});
