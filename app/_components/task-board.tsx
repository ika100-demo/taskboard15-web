"use client";

import { useState, useTransition } from "react";
import type { FormEvent } from "react";

import { MSG_NO_DUE_DATE, MSG_NO_TASKS, MSG_SAVE_FAILED } from "@/lib/tasks/types";
import type { CreateTaskInput, CreateTaskResult, Task } from "@/lib/tasks/types";
import { validateTitle } from "@/lib/tasks/validate";

export type TaskBoardProps = {
  initialTasks: Task[];
  createTask: (input: CreateTaskInput) => Promise<CreateTaskResult>;
};

export function TaskBoard({ initialTasks, createTask }: TaskBoardProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [titleError, setTitleError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveError(null);
    const invalid = validateTitle(title);
    if (invalid !== null) {
      setTitleError(invalid);
      return;
    }
    startTransition(async () => {
      let result: CreateTaskResult;
      try {
        result = await createTask({ title, due_date: dueDate === "" ? null : dueDate });
      } catch {
        setSaveError(MSG_SAVE_FAILED);
        return;
      }
      if (result.ok) {
        setTasks((current) => [...current, result.task]);
        setTitle("");
        setDueDate("");
        setTitleError(null);
      } else if (result.field === "title") {
        setTitleError(result.message);
      } else {
        setSaveError(MSG_SAVE_FAILED);
      }
    });
  }

  return (
    <div>
      {tasks.length === 0 ? (
        <p>{MSG_NO_TASKS}</p>
      ) : (
        <ul aria-label="Tasks">
          {tasks.map((task) => (
            <li key={task.id}>
              <span>{task.title}</span> <span>{task.due_date ?? MSG_NO_DUE_DATE}</span>
            </li>
          ))}
        </ul>
      )}
      <form aria-label="Create task" noValidate onSubmit={onSubmit}>
        <label htmlFor="task-title">Title</label>
        <input
          id="task-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-invalid={titleError ? "true" : undefined}
          aria-describedby={titleError ? "task-title-error" : undefined}
        />
        {titleError ? <p id="task-title-error">{titleError}</p> : null}
        <label htmlFor="task-due-date">Due date</label>
        <input id="task-due-date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        {saveError ? <p role="alert">{saveError}</p> : null}
        <button type="submit" disabled={pending}>
          Add task
        </button>
      </form>
    </div>
  );
}
