import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TaskBoard } from "@/app/_components/task-board";
import type { CreateTaskInput, CreateTaskResult, Task } from "@/lib/tasks/types";

const t1: Task = { id: "1", title: "First", due_date: "2026-01-02" };
const t2: Task = { id: "2", title: "Second", due_date: null };

function setup(initialTasks: Task[], result?: CreateTaskResult | Error) {
  const createTask = vi.fn<(input: CreateTaskInput) => Promise<CreateTaskResult>>(async () => {
    if (result instanceof Error) throw result;
    return result ?? { ok: true, task: { id: "9", title: "Write report", due_date: "2026-12-01" } };
  });
  render(<TaskBoard initialTasks={initialTasks} createTask={createTask} />);
  return createTask;
}

function form() {
  return screen.getByRole("form", { name: "Create task" });
}

function fill(title: string, date = "") {
  fireEvent.change(within(form()).getByRole("textbox", { name: "Title" }), { target: { value: title } });
  fireEvent.change(within(form()).getByLabelText("Due date"), { target: { value: date } });
}

function submit() {
  fireEvent.click(within(form()).getByRole("button", { name: "Add task" }));
}

describe("TaskBoard", () => {
  it("AC-001.1 lists every task in the given order with its title and due date or 'No due date'", () => {
    setup([t1, t2]);
    const items = within(screen.getByRole("list", { name: "Tasks" })).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("First");
    expect(items[0]).toHaveTextContent("2026-01-02");
    expect(items[0]).not.toHaveTextContent("No due date");
    expect(items[1]).toHaveTextContent("Second");
    expect(items[1]).toHaveTextContent("No due date");
  });

  it("AC-001.2 shows 'No tasks yet' with no list, and the form with title and due date fields", () => {
    setup([]);
    expect(screen.getByText("No tasks yet")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(within(form()).getByRole("textbox", { name: "Title" })).toBeInTheDocument();
    expect(within(form()).getByLabelText("Due date")).toHaveAttribute("type", "date");
    expect(within(form()).getByRole("button", { name: "Add task" })).toBeInTheDocument();
  });

  it("AC-001.3 sends the entered values, appends the returned task at the end and clears the form", async () => {
    const createTask = setup([t1]);
    fill("Write report", "2026-12-01");
    submit();
    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(2));
    expect(createTask).toHaveBeenCalledWith({ title: "Write report", due_date: "2026-12-01" });
    const items = screen.getAllByRole("listitem");
    expect(items[1]).toHaveTextContent("Write report");
    expect(items[1]).toHaveTextContent("2026-12-01");
    expect(within(form()).getByRole("textbox", { name: "Title" })).toHaveValue("");
    expect(within(form()).getByLabelText("Due date")).toHaveValue("");
  });

  it("AC-001.3 replaces the empty state by the list when the first task is created", async () => {
    setup([]);
    fill("Write report", "2026-12-01");
    submit();
    expect(await screen.findByRole("list", { name: "Tasks" })).toBeInTheDocument();
    expect(screen.queryByText("No tasks yet")).not.toBeInTheDocument();
  });

  it("AC-001.3 sends due_date null when the date is empty", async () => {
    const createTask = setup([]);
    fill("Only title");
    submit();
    await waitFor(() => expect(createTask).toHaveBeenCalled());
    expect(createTask).toHaveBeenCalledWith({ title: "Only title", due_date: null });
  });

  it("AC-001.4 blocks an empty or whitespace title, keeps the values and shows 'Title is required' next to the field", () => {
    const createTask = setup([t1]);
    fill("   ", "2026-12-01");
    submit();
    expect(createTask).not.toHaveBeenCalled();
    const field = within(form()).getByRole("textbox", { name: "Title" });
    expect(field).toHaveValue("   ");
    expect(within(form()).getByLabelText("Due date")).toHaveValue("2026-12-01");
    const error = screen.getByText("Title is required");
    expect(error).toHaveAttribute("id", "task-title-error");
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveAttribute("aria-describedby", "task-title-error");
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  it("AC-001.4 blocks a fully empty title", () => {
    const createTask = setup([]);
    submit();
    expect(createTask).not.toHaveBeenCalled();
    expect(screen.getByText("Title is required")).toBeInTheDocument();
  });

  it("AC-001.5 blocks a title over 200 characters, keeps the values and shows the length message", () => {
    const createTask = setup([]);
    const long = "a".repeat(201);
    fill(long, "2026-12-01");
    submit();
    expect(createTask).not.toHaveBeenCalled();
    expect(within(form()).getByRole("textbox", { name: "Title" })).toHaveValue(long);
    expect(within(form()).getByLabelText("Due date")).toHaveValue("2026-12-01");
    expect(screen.getByText("Title must be at most 200 characters")).toHaveAttribute("id", "task-title-error");
  });

  it("AC-001.5 does not limit input length in the field itself", () => {
    setup([]);
    const field = within(form()).getByRole("textbox", { name: "Title" });
    expect(field).not.toHaveAttribute("maxlength");
    expect(field).not.toBeRequired();
  });

  it("AC-001.6 shows the server's title message, keeps the values and adds no task", async () => {
    setup([t1], { ok: false, field: "title", message: "Title must be at most 200 characters" });
    fill("Write report", "2026-12-01");
    submit();
    expect(await screen.findByText("Title must be at most 200 characters")).toHaveAttribute("id", "task-title-error");
    expect(within(form()).getByRole("textbox", { name: "Title" })).toHaveValue("Write report");
    expect(within(form()).getByLabelText("Due date")).toHaveValue("2026-12-01");
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  it("AC-001.6 shows 'Title is required' from the server", async () => {
    setup([], { ok: false, field: "title", message: "Title is required" });
    fill("x");
    submit();
    expect(await screen.findByText("Title is required")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("AC-001.8 shows the save-failed alert inside the form, keeps the values and the list", async () => {
    setup([t1], { ok: false, field: null, message: "Task could not be saved. Try again." });
    fill("Write report", "2026-12-01");
    submit();
    const alert = await within(form()).findByRole("alert");
    expect(alert).toHaveTextContent("Task could not be saved. Try again.");
    expect(within(form()).getByRole("textbox", { name: "Title" })).toHaveValue("Write report");
    expect(within(form()).getByLabelText("Due date")).toHaveValue("2026-12-01");
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  it("AC-001.8 shows the save-failed alert when createTask rejects", async () => {
    setup([t1], new Error("network"));
    fill("Write report", "2026-12-01");
    submit();
    expect(await within(form()).findByRole("alert")).toHaveTextContent("Task could not be saved. Try again.");
    expect(within(form()).getByRole("textbox", { name: "Title" })).toHaveValue("Write report");
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  it("AC-001.8 clears the save message on the next submit", async () => {
    const createTask = setup([], { ok: false, field: null, message: "Task could not be saved. Try again." });
    fill("x");
    submit();
    await within(form()).findByRole("alert");
    createTask.mockResolvedValue({ ok: true, task: { id: "9", title: "x", due_date: null } });
    submit();
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });
});
