"use client";

import { useActionState, useEffect, useRef } from "react";
import { createTaskAction, updateTaskAction } from "@/lib/actions";
import { PRIORITY_LABEL, PRIORITY_ORDER, STATUS_LABEL, STATUS_ORDER } from "@/lib/labels";
import { IDLE_FORM_STATE } from "@/lib/types";
import type { FormState, TaskDTO } from "@/lib/types";
import { FieldError, FormMessage, SubmitButton, fieldErrorsOf } from "@/components/form-parts";

type TaskFormProps = {
  projectId: string;
  task?: TaskDTO;
};

export function TaskForm({ projectId, task }: TaskFormProps) {
  const isEdit = task !== undefined;
  const action = isEdit ? updateTaskAction : createTaskAction;
  const [state, formAction] = useActionState<FormState, FormData>(action, IDLE_FORM_STATE);
  const formRef = useRef<HTMLFormElement>(null);
  const errors = fieldErrorsOf(state);

  useEffect(() => {
    if (!isEdit && state.status === "success") {
      formRef.current?.reset();
    }
  }, [isEdit, state]);

  return (
    <form ref={formRef} action={formAction} className="card space-y-4">
      <div>
        <h2 className="text-base font-semibold text-white">
          {isEdit ? "Edit task" : "Add task"}
        </h2>
      </div>

      <input type="hidden" name="projectId" value={projectId} />
      {isEdit ? <input type="hidden" name="taskId" value={task.id} /> : null}

      <div>
        <label className="label" htmlFor="task-title">
          Title
        </label>
        <input
          id="task-title"
          name="title"
          className="field"
          defaultValue={task?.title ?? ""}
          placeholder="Draft the homepage copy"
          maxLength={140}
          required
        />
        <FieldError errors={errors} name="title" />
      </div>

      <div>
        <label className="label" htmlFor="task-description">
          Details
        </label>
        <textarea
          id="task-description"
          name="description"
          className="field min-h-20 resize-y"
          defaultValue={task?.description ?? ""}
          maxLength={1000}
        />
        <FieldError errors={errors} name="description" />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="task-status">
            Status
          </label>
          <select
            id="task-status"
            name="status"
            className="field"
            defaultValue={task?.status ?? "TODO"}
          >
            {STATUS_ORDER.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABEL[status]}
              </option>
            ))}
          </select>
          <FieldError errors={errors} name="status" />
        </div>

        <div>
          <label className="label" htmlFor="task-priority">
            Priority
          </label>
          <select
            id="task-priority"
            name="priority"
            className="field"
            defaultValue={task?.priority ?? "MEDIUM"}
          >
            {PRIORITY_ORDER.map((priority) => (
              <option key={priority} value={priority}>
                {PRIORITY_LABEL[priority]}
              </option>
            ))}
          </select>
          <FieldError errors={errors} name="priority" />
        </div>

        <div>
          <label className="label" htmlFor="task-due">
            Due date
          </label>
          <input
            id="task-due"
            name="dueDate"
            type="date"
            className="field"
            defaultValue={task?.dueDate ?? ""}
          />
          <FieldError errors={errors} name="dueDate" />
        </div>
      </div>

      <FormMessage state={state} />

      <SubmitButton label={isEdit ? "Save task" : "Add task"} />
    </form>
  );
}
