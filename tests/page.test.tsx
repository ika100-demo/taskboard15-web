import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTaskAction } from "@/app/actions";
import { TaskBoard } from "@/app/_components/task-board";
import HomePage from "@/app/page";
import { listTasks } from "@/lib/tasks/api";

vi.mock("@/lib/tasks/api");

const list = vi.mocked(listTasks);

beforeEach(() => list.mockReset());

describe("HomePage", () => {
  it("AC-001.1 lists every task in API order with title and due date or 'No due date'", async () => {
    list.mockResolvedValue({
      ok: true,
      tasks: [
        { id: "a", title: "Older", due_date: "2026-03-04" },
        { id: "b", title: "Newer", due_date: null },
      ],
    });
    render(await HomePage());
    expect(screen.getByRole("heading", { level: 1, name: "Tasks" })).toBeInTheDocument();
    const items = within(screen.getByRole("list", { name: "Tasks" })).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Older");
    expect(items[0]).toHaveTextContent("2026-03-04");
    expect(items[1]).toHaveTextContent("Newer");
    expect(items[1]).toHaveTextContent("No due date");
  });

  it("AC-001.2 shows 'No tasks yet' and the create form when there are no tasks", async () => {
    list.mockResolvedValue({ ok: true, tasks: [] });
    render(await HomePage());
    expect(screen.getByText("No tasks yet")).toBeInTheDocument();
    const form = screen.getByRole("form", { name: "Create task" });
    expect(within(form).getByRole("textbox", { name: "Title" })).toBeInTheDocument();
    expect(within(form).getByLabelText("Due date")).toHaveAttribute("type", "date");
  });

  it("AC-001.7 shows the load message instead of the board when loading fails", async () => {
    list.mockResolvedValue({ ok: false });
    render(await HomePage());
    expect(screen.getByRole("alert")).toHaveTextContent("Tasks could not be loaded. Try again later.");
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Create task" })).not.toBeInTheDocument();
  });

  it("AC-001.3 passes createTaskAction to the board as createTask", async () => {
    list.mockResolvedValue({ ok: true, tasks: [] });
    const element = await HomePage();
    const found: unknown[] = [];
    const walk = (node: unknown): void => {
      if (Array.isArray(node)) return node.forEach(walk);
      if (node && typeof node === "object" && "props" in node) {
        const el = node as { type: unknown; props: { children?: unknown; createTask?: unknown } };
        if (el.type === TaskBoard) found.push(el.props.createTask);
        walk(el.props.children);
      }
    };
    walk(element);
    expect(found).toEqual([createTaskAction]);
  });

  it("AC-001.7 renders the page on every request", async () => {
    const mod = await import("@/app/page");
    expect(mod.dynamic).toBe("force-dynamic");
  });
});
