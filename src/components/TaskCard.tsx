"use client";

import Link from "next/link";
import { useTransition } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { deleteTaskAction, setTaskStatusAction } from "@/lib/actions";
import {
  PRIORITY_CLASS,
  PRIORITY_LABEL,
  STATUS_CLASS,
  STATUS_LABEL,
  STATUS_ORDER,
  formatDate,
  isOverdue,
} from "@/lib/labels";
import type { TaskDTO } from "@/lib/types";

type TaskCardProps = {
  task: TaskDTO;
};

export function TaskCard({ task }: TaskCardProps) {
  const [isPending, startTransition] = useTransition();
  const overdue = isOverdue(task.dueDate, task.status);

  function handleStatusChange(event: ChangeEvent<HTMLSelectElement>): void {
    const form = event.currentTarget.form;
    if (form === null) {
      return;
    }
    startTransition(() => {
      form.requestSubmit();
    });
  }

  function confirmDelete(event: FormEvent<HTMLFormElement>): void {
    if (!window.confirm(`Delete "${task.title}"? This cannot be undone.`)) {
      event.preventDefault();
    }
  }

  return (
    <article
      className={`card space-y-3 transition ${isPending ? "opacity-60" : "opacity-100"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold leading-snug text-white">{task.title}</h3>
        <span className={`chip ${PRIORITY_CLASS[task.priority]}`}>
          {PRIORITY_LABEL[task.priority]}
        </span>
      </div>

      {task.description === null ? null : (
        <p className="text-sm leading-relaxed text-slate-400">{task.description}</p>
      )}

      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span className={`chip ${STATUS_CLASS[task.status]}`}>{STATUS_LABEL[task.status]}</span>
        {task.dueDate === null ? (
          <span>No due date</span>
        ) : (
          <span className={overdue ? "font-medium text-rose-400" : ""}>
            Due {formatDate(task.dueDate)}
            {overdue ? " · overdue" : ""}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-edge pt-3">
        <form action={setTaskStatusAction} className="flex items-center gap-2">
          <input type="hidden" name="taskId" value={task.id} />
          <label className="sr-only" htmlFor={`status-${task.id}`}>
            Change status
          </label>
          <select
            id={`status-${task.id}`}
            name="status"
            className="field w-auto py-1.5 text-xs"
            defaultValue={task.status}
            onChange={handleStatusChange}
            disabled={isPending}
          >
            {STATUS_ORDER.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABEL[status]}
              </option>
            ))}
          </select>
          <noscript>
            <button type="submit" className="btn-ghost py-1.5 text-xs">
              Apply
            </button>
          </noscript>
        </form>

        <Link
          href={`/projects/${task.projectId}/tasks/${task.id}`}
          className="btn-ghost py-1.5 text-xs"
        >
          Edit
        </Link>

        <form action={deleteTaskAction} onSubmit={confirmDelete}>
          <input type="hidden" name="taskId" value={task.id} />
          <button type="submit" className="btn-danger py-1.5 text-xs">
            Delete
          </button>
        </form>
      </div>
    </article>
  );
}
