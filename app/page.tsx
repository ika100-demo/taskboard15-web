import { createTaskAction } from "@/app/actions";
import { TaskBoard } from "@/app/_components/task-board";
import { listTasks } from "@/lib/tasks/api";
import { MSG_LOAD_FAILED } from "@/lib/tasks/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const result = await listTasks();

  return (
    <section className="board">
      <h1>Tasks</h1>
      {result.ok ? (
        <TaskBoard initialTasks={result.tasks} createTask={createTaskAction} />
      ) : (
        <p role="alert">{MSG_LOAD_FAILED}</p>
      )}
    </section>
  );
}
