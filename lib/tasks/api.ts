import { logger } from "@/lib/logger";
import type { CreateTaskInput, ListTasksResult, PostTaskResult, Task } from "./types";

type Op = "list" | "create";
type Kind = "status" | "invalid_body" | "timeout" | "network" | "config";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isTask(value: unknown): value is Task {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.title === "string" &&
    (v.due_date === null || (typeof v.due_date === "string" && DATE_RE.test(v.due_date)))
  );
}

function fail(op: Op, kind: Kind, status?: number): void {
  logger.warn("tasks api call failed", status === undefined ? { op, kind } : { op, kind, status });
}

function baseUrl(): string | null {
  const raw = process.env.API_URL;
  if (!raw) return null;
  return raw.replace(/\/$/, "");
}

type Outcome = { response: Response } | { error: Kind };

async function call(op: Op, init: RequestInit): Promise<Outcome> {
  const base = baseUrl();
  if (base === null) {
    fail(op, "config");
    return { error: "config" };
  }
  try {
    const response = await fetch(`${base}/tasks`, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    return { response };
  } catch (err) {
    // DOMException is not always an Error instance across realms, so read `name` structurally.
    const name = typeof err === "object" && err !== null ? (err as { name?: unknown }).name : undefined;
    const kind: Kind = name === "TimeoutError" || name === "AbortError" ? "timeout" : "network";
    fail(op, kind);
    return { error: kind };
  }
}

async function readJson(response: Response): Promise<{ ok: true; body: unknown } | { ok: false }> {
  try {
    return { ok: true, body: await response.json() };
  } catch {
    return { ok: false };
  }
}

export async function listTasks(): Promise<ListTasksResult> {
  const outcome = await call("list", {});
  if ("error" in outcome) return { ok: false };
  const { response } = outcome;
  if (response.status !== 200) {
    fail("list", "status", response.status);
    return { ok: false };
  }
  const parsed = await readJson(response);
  if (!parsed.ok || !Array.isArray(parsed.body) || !parsed.body.every(isTask)) {
    fail("list", "invalid_body", response.status);
    return { ok: false };
  }
  return { ok: true, tasks: parsed.body };
}

function namesTitle(body: unknown): boolean {
  if (typeof body !== "object" || body === null) return false;
  const detail = (body as { detail?: unknown }).detail;
  if (!Array.isArray(detail)) return false;
  return detail.some((item: unknown) => {
    if (typeof item !== "object" || item === null) return false;
    const loc = (item as { loc?: unknown }).loc;
    return Array.isArray(loc) && loc[1] === "title";
  });
}

export async function postTask(input: CreateTaskInput): Promise<PostTaskResult> {
  const outcome = await call("create", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: input.title, due_date: input.due_date }),
  });
  if ("error" in outcome) return { ok: false, reason: "failed" };
  const { response } = outcome;
  if (response.status === 201) {
    const parsed = await readJson(response);
    if (parsed.ok && isTask(parsed.body)) return { ok: true, task: parsed.body };
    fail("create", "invalid_body", response.status);
    return { ok: false, reason: "failed" };
  }
  if (response.status === 422) {
    const parsed = await readJson(response);
    if (parsed.ok && namesTitle(parsed.body)) return { ok: false, reason: "title_invalid" };
    fail("create", "invalid_body", response.status);
    return { ok: false, reason: "failed" };
  }
  fail("create", "status", response.status);
  return { ok: false, reason: "failed" };
}
