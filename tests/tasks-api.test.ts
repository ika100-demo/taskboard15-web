import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { listTasks, postTask } from "@/lib/tasks/api";

const warn = vi.hoisted(() => vi.fn());
vi.mock("@/lib/logger", () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn, error: vi.fn() } }));

const fetchMock = vi.fn();

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const t1 = { id: "1", title: "First", due_date: "2026-01-02" };
const t2 = { id: "2", title: "Second", due_date: null };

beforeEach(() => {
  fetchMock.mockReset();
  warn.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  process.env.API_URL = "http://api.test";
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.API_URL;
});

describe("listTasks", () => {
  it("AC-001.1 returns tasks in API order from GET API_URL/tasks", async () => {
    fetchMock.mockResolvedValue(json([t2, t1]));
    const result = await listTasks();
    expect(result).toEqual({ ok: true, tasks: [t2, t1] });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("http://api.test/tasks");
    expect(init.cache).toBe("no-store");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("AC-001.1 strips a trailing slash from API_URL", async () => {
    process.env.API_URL = "http://api.test/";
    fetchMock.mockResolvedValue(json([]));
    await listTasks();
    expect(String(fetchMock.mock.calls[0][0])).toBe("http://api.test/tasks");
  });

  it("AC-001.2 returns an empty list for an empty array", async () => {
    fetchMock.mockResolvedValue(json([]));
    expect(await listTasks()).toEqual({ ok: true, tasks: [] });
  });

  it("AC-001.7 fails when the API is unreachable and logs kind network", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    expect(await listTasks()).toEqual({ ok: false });
    expect(warn).toHaveBeenCalledWith("tasks api call failed", expect.objectContaining({ op: "list", kind: "network" }));
  });

  it("AC-001.7 fails on a timeout and logs kind timeout", async () => {
    fetchMock.mockRejectedValue(new DOMException("The operation timed out", "TimeoutError"));
    expect(await listTasks()).toEqual({ ok: false });
    expect(warn).toHaveBeenCalledWith("tasks api call failed", expect.objectContaining({ op: "list", kind: "timeout" }));
  });

  it("AC-001.7 fails on a status other than 200 and logs the status", async () => {
    fetchMock.mockResolvedValue(json([t1], 500));
    expect(await listTasks()).toEqual({ ok: false });
    expect(warn).toHaveBeenCalledWith("tasks api call failed", expect.objectContaining({ op: "list", kind: "status", status: 500 }));
  });

  it("AC-001.7 fails on a non-JSON body", async () => {
    fetchMock.mockResolvedValue(new Response("<html>oops</html>", { status: 200 }));
    expect(await listTasks()).toEqual({ ok: false });
    expect(warn).toHaveBeenCalledWith("tasks api call failed", expect.objectContaining({ kind: "invalid_body", status: 200 }));
  });

  it("AC-001.7 fails when the body is not an array of tasks", async () => {
    fetchMock.mockResolvedValue(json({ tasks: [] }));
    expect(await listTasks()).toEqual({ ok: false });
    fetchMock.mockResolvedValue(json([{ id: "1", title: "x", due_date: "01/02/2026" }]));
    expect(await listTasks()).toEqual({ ok: false });
    fetchMock.mockResolvedValue(json([{ id: 1, title: "x", due_date: null }]));
    expect(await listTasks()).toEqual({ ok: false });
  });

  it("AC-001.7 treats an unset or empty API_URL as unreachable (kind config)", async () => {
    delete process.env.API_URL;
    expect(await listTasks()).toEqual({ ok: false });
    process.env.API_URL = "";
    expect(await listTasks()).toEqual({ ok: false });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith("tasks api call failed", expect.objectContaining({ op: "list", kind: "config" }));
  });
});

describe("postTask", () => {
  it("AC-001.3 sends POST /tasks with the exact JSON body and returns the created task", async () => {
    const created = { id: "9", title: "Write report", due_date: "2026-12-01" };
    fetchMock.mockResolvedValue(json(created, 201));
    const result = await postTask({ title: "Write report", due_date: "2026-12-01" });
    expect(result).toEqual({ ok: true, task: created });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("http://api.test/tasks");
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("content-type")).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({ title: "Write report", due_date: "2026-12-01" });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("AC-001.3 sends due_date null when there is no date and keeps the title untrimmed", async () => {
    fetchMock.mockResolvedValue(json({ id: "9", title: " x ", due_date: null }, 201));
    await postTask({ title: " x ", due_date: null });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ title: " x ", due_date: null });
  });

  it("AC-001.6 maps a 422 naming the title field to title_invalid without logging", async () => {
    fetchMock.mockResolvedValue(json({ detail: [{ loc: ["body", "title"], msg: "bad", type: "x" }] }, 422));
    expect(await postTask({ title: "x", due_date: null })).toEqual({ ok: false, reason: "title_invalid" });
    expect(warn).not.toHaveBeenCalled();
  });

  it("AC-001.8 maps a 422 not naming the title to failed", async () => {
    fetchMock.mockResolvedValue(json({ detail: [{ loc: ["body", "due_date"], msg: "bad", type: "x" }] }, 422));
    expect(await postTask({ title: "x", due_date: "nope" })).toEqual({ ok: false, reason: "failed" });
  });

  it("AC-001.8 maps a 422 with a non-JSON body to failed", async () => {
    fetchMock.mockResolvedValue(new Response("nope", { status: 422 }));
    expect(await postTask({ title: "x", due_date: null })).toEqual({ ok: false, reason: "failed" });
  });

  it("AC-001.8 maps other statuses to failed and logs the status", async () => {
    fetchMock.mockResolvedValue(json({}, 500));
    expect(await postTask({ title: "x", due_date: null })).toEqual({ ok: false, reason: "failed" });
    expect(warn).toHaveBeenCalledWith("tasks api call failed", expect.objectContaining({ op: "create", kind: "status", status: 500 }));
  });

  it("AC-001.8 maps a 201 with a malformed body to failed", async () => {
    fetchMock.mockResolvedValue(json({ nope: true }, 201));
    expect(await postTask({ title: "x", due_date: null })).toEqual({ ok: false, reason: "failed" });
  });

  it("AC-001.8 maps network errors and timeouts to failed, without retrying", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    expect(await postTask({ title: "x", due_date: null })).toEqual({ ok: false, reason: "failed" });
    fetchMock.mockRejectedValue(new DOMException("timed out", "TimeoutError"));
    expect(await postTask({ title: "x", due_date: null })).toEqual({ ok: false, reason: "failed" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledWith("tasks api call failed", expect.objectContaining({ op: "create", kind: "timeout" }));
  });

  it("AC-001.8 treats an unset API_URL as failed", async () => {
    delete process.env.API_URL;
    expect(await postTask({ title: "x", due_date: null })).toEqual({ ok: false, reason: "failed" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("AC-001.8 never logs the title or the request body", async () => {
    fetchMock.mockResolvedValue(json({}, 500));
    await postTask({ title: "secret-title-xyz", due_date: "2026-12-01" });
    expect(JSON.stringify(warn.mock.calls)).not.toContain("secret-title-xyz");
  });
});
